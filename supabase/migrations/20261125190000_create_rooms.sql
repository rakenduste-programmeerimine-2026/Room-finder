-- Room catalogue (docs/data-model.md, section 4.1).
--
-- Every signed-in user reads it; only seed data and server code with the
-- service role write it.

-- Shared helpers ---------------------------------------------------------------

-- Keeps updated_at current; used by every table.
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- True when there are at most max_count labels and every label is non-null,
-- trimmed and 1..max_length characters long. (A check cannot use a subquery.)
create function public.is_valid_label_array(
  labels text[], max_length integer, max_count integer
) returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(cardinality(labels), 0) <= max_count
     and not exists (
       select 1 from unnest(labels) as l
       where l is null
          or char_length(l) not between 1 and max_length
          or l <> btrim(l)
     )
$$;

-- rooms -----------------------------------------------------------------------

create type public.room_acquisition_complexity as enum (
  'google_form',
  'institute_permission',
  'university_permission',
  'contact_owner',
  'other'
);

create table public.rooms (
  code                  text primary key,
  capacity              integer not null,
  bookable_for_teaching boolean not null default false,
  aliases               text[] not null default '{}',
  complexity            public.room_acquisition_complexity not null default 'other',
  event_types           text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint rooms_code_format
    check (char_length(code) between 1 and 32 and code = btrim(code)),
  constraint rooms_capacity_positive
    check (capacity > 0),
  constraint rooms_aliases_valid
    check (public.is_valid_label_array(aliases, 100, 20)),
  constraint rooms_event_types_valid
    check (public.is_valid_label_array(event_types, 60, 20))
);

comment on table public.rooms is
  'Room catalogue. Read-only for clients; written by seed data and the service role.';
comment on column public.rooms.aliases is
  'Name variants for search. Many aliases -> one room; an alias belongs to one room only (case-insensitive).';
comment on column public.rooms.event_types is
  'Event types the room suits (Unconfirmed, docs/data-model.md Q4).';

create index rooms_aliases_idx on public.rooms using gin (aliases);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- Many to one: reject an alias that already belongs to another room.
-- Writes come only from seed data and the service role, so the race between
-- two concurrent inserts is accepted.
create function public.rooms_aliases_unique() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  _taken text;
begin
  select a into _taken
  from public.rooms r, unnest(r.aliases) as a
  where r.code <> (case when tg_op = 'UPDATE' then old.code else new.code end)
    and lower(a) in (select lower(n) from unnest(new.aliases) as n)
  limit 1;

  if _taken is not null then
    raise exception 'alias "%" already belongs to another room', _taken
      using errcode = 'unique_violation';
  end if;
  return new;
end
$$;

create trigger rooms_aliases_unique
  before insert or update of aliases on public.rooms
  for each row execute function public.rooms_aliases_unique();

-- Row level security ------------------------------------------------------------
-- Supabase grants ALL on new public tables to anon/authenticated by default.
-- Narrow it down so that even a wrong policy cannot expose too much.

alter table public.rooms enable row level security;

revoke all on table public.rooms from anon, authenticated;
grant select on table public.rooms to authenticated;

create policy "rooms: signed-in users can read"
  on public.rooms for select to authenticated
  using (true);
