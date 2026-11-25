-- Searches (docs/data-model.md, sections 4.3, 5.3-5.5).
--
-- One search: a snapshot of every input and its status and result.
-- room_items and curricula are copies, not references: a saved group can change
-- later, but a search must stay exactly as it was run. source_*_group_id only
-- remembers where the copy came from.
-- The owner creates the row; the server code (service role) writes status,
-- result and error.

create type public.search_status as enum ('pending', 'running', 'done', 'failed');

-- An object whose keys are complexity classes and whose values are numbers
-- 0..1 with at most 2 decimals. A missing key means the code default.
-- Keys must match public.room_acquisition_complexity (tested).
create function public.is_valid_complexity_weights(weights jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(weights) is distinct from 'object' then false
    else not exists (
      select 1 from jsonb_each(weights) as w (key, value)
      where w.key <> all (array['google_form', 'institute_permission',
                                'university_permission', 'contact_owner', 'other'])
         or case
              when jsonb_typeof(w.value) <> 'number' then true
              else w.value::numeric not between 0 and 1
                or round(w.value::numeric, 2) <> w.value::numeric
            end
    )
  end
$$;

-- Nested time windows (section 5.4): period -> day -> range -> slot.
--
-- Every start and end is a JSON string in exactly one format:
--   ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$
-- (UTC, whole seconds; no milliseconds, no other offset). Within this one
-- fixed-width format, comparing the strings byte by byte (collation "C") orders
-- them exactly like the instants, so the checks below need no cast to
-- timestamptz, do not depend on the session time zone and are truly immutable.
-- Calendar validity (no 30 February) and sibling overlaps are the app's job.

create function public.is_utc_instant(value jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(value) = 'string'
      and (value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$',
    false
  )
$$;

-- One node: an object with only allowed_keys, valid start < end, inside its
-- parent (parent_start <= start, end <= parent_end) when it has one.
create function public.is_valid_time_node(
  node jsonb, allowed_keys text[], parent_start text, parent_end text
) returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(node) is distinct from 'object' then false
    when not (public.is_utc_instant(node -> 'start') and public.is_utc_instant(node -> 'end')) then false
    when exists (select 1 from jsonb_object_keys(node) k where k <> all (allowed_keys)) then false
    else (node ->> 'start') collate pg_catalog."C" < (node ->> 'end') collate pg_catalog."C"
     and (parent_start is null
          or parent_start collate pg_catalog."C" <= (node ->> 'start') collate pg_catalog."C")
     and (parent_end is null
          or (node ->> 'end') collate pg_catalog."C" <= parent_end collate pg_catalog."C")
  end
$$;

-- True when node[key] is an array of min_count..200 elements.
create function public.is_valid_time_children(node jsonb, key text, min_count integer)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(node -> key) is distinct from 'array' then false
    else jsonb_array_length(node -> key) between min_count and 200
  end
$$;

create function public.is_valid_time_windows(windows jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  _p jsonb;  -- level 1: period
  _d jsonb;  -- level 2: day
  _r jsonb;  -- level 3: range
  _s jsonb;  -- level 4: slot (optional)
begin
  if jsonb_typeof(windows) is distinct from 'array'
     or jsonb_array_length(windows) not between 1 and 50 then
    return false;
  end if;

  for _p in select value from jsonb_array_elements(windows) loop
    if not public.is_valid_time_node(_p, array['source', 'start', 'end', 'days'], null, null)
       or coalesce(_p ->> 'source', '') not in ('tool', 'csv')
       or not public.is_valid_time_children(_p, 'days', 1) then
      return false;
    end if;

    for _d in select value from jsonb_array_elements(_p -> 'days') loop
      if not public.is_valid_time_node(_d, array['start', 'end', 'ranges'], _p ->> 'start', _p ->> 'end')
         or not public.is_valid_time_children(_d, 'ranges', 1) then
        return false;
      end if;

      for _r in select value from jsonb_array_elements(_d -> 'ranges') loop
        if not public.is_valid_time_node(_r, array['start', 'end', 'slots'], _d ->> 'start', _d ->> 'end') then
          return false;
        end if;

        if _r ? 'slots' then
          if not public.is_valid_time_children(_r, 'slots', 0) then
            return false;
          end if;
          for _s in select value from jsonb_array_elements(_r -> 'slots') loop
            -- Only start and end: a fifth level is rejected here.
            if not public.is_valid_time_node(_s, array['start', 'end'], _r ->> 'start', _r ->> 'end') then
              return false;
            end if;
          end loop;
        end if;
      end loop;
    end loop;
  end loop;

  return true;
end
$$;

create table public.searches (
  id                         uuid primary key default gen_random_uuid(),
  owner_id                   uuid not null default auth.uid()
                               references auth.users (id) on delete cascade,
  name                       text,
  event_type                 text not null,
  duration_minutes           integer not null,
  attendees                  integer,
  room_items                 jsonb not null,
  source_room_group_id       uuid,
  complexity_weights         jsonb not null default '{}',
  time_windows               jsonb not null,
  curricula                  jsonb,
  source_curriculum_group_id uuid,
  csv_filename               text,
  status                     public.search_status not null default 'pending',
  result                     jsonb,
  error                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- Same owner: a search can only point to one of its owner's groups.
  constraint searches_source_room_group_fk
    foreign key (source_room_group_id, owner_id)
    references public.saved_groups (id, owner_id)
    on delete set null (source_room_group_id),
  constraint searches_source_curriculum_group_fk
    foreign key (source_curriculum_group_id, owner_id)
    references public.saved_groups (id, owner_id)
    on delete set null (source_curriculum_group_id),

  constraint searches_name_format
    check (name is null or (char_length(name) between 1 and 100 and name = btrim(name))),
  constraint searches_event_type_format
    check (char_length(event_type) between 1 and 60 and event_type = btrim(event_type)),
  constraint searches_duration_range
    check (duration_minutes between 5 and 1440),
  constraint searches_attendees_range
    check (attendees is null or attendees between 1 and 10000),
  constraint searches_room_items_valid
    check (public.is_valid_group_items('room', room_items)),
  constraint searches_curricula_valid
    check (curricula is null or public.is_valid_group_items('curriculum', curricula)),
  constraint searches_complexity_weights_valid
    check (public.is_valid_complexity_weights(complexity_weights)),
  constraint searches_time_windows_valid
    check (public.is_valid_time_windows(time_windows)),
  constraint searches_time_windows_size
    check (octet_length(time_windows::text) <= 262144),
  constraint searches_csv_filename_length
    check (csv_filename is null or char_length(csv_filename) between 1 and 255),
  constraint searches_result_matches_status
    check ((status = 'done') = (result is not null)
           and (result is null or jsonb_typeof(result) = 'object')),
  constraint searches_error_matches_status
    check ((status = 'failed') = (error is not null)),
  constraint searches_error_length
    check (error is null or char_length(error) between 1 and 1000)
);

comment on table public.searches is
  'One search: snapshot of the inputs, status and result. Result written by the service role only.';
comment on column public.searches.duration_minutes is
  'Event length (Unconfirmed, docs/data-model.md Q8).';
comment on column public.searches.attendees is
  'Expected attendees, compared with rooms.capacity (Unconfirmed, Q8).';

create index searches_owner_created_at_idx on public.searches (owner_id, created_at desc);

create trigger searches_set_updated_at
  before update on public.searches
  for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------------

alter table public.searches enable row level security;

revoke all on table public.searches from anon, authenticated;
grant select, insert, delete on table public.searches to authenticated;
-- The owner may only rename a search; status, result and error belong to the
-- server code (service role, bypasses RLS).
grant update (name) on table public.searches to authenticated;

create policy "searches: owner can select"
  on public.searches for select to authenticated
  using (owner_id = (select auth.uid()));

-- A client cannot fake a result: a new search is always pending and empty.
create policy "searches: owner can insert a pending search"
  on public.searches for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and result is null
    and error is null
  );

create policy "searches: owner can update"
  on public.searches for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "searches: owner can delete"
  on public.searches for delete to authenticated
  using (owner_id = (select auth.uid()));
