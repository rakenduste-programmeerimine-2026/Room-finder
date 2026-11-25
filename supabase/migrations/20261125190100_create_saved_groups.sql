-- Saved groups (docs/data-model.md, sections 4.2, 5.1, 5.2).
--
-- A user's named, ranked room groups (1.1) and curriculum groups (1.3).
-- Array order in items is the rank (index 0 = first choice).
-- "Change and save under a new name" inserts a new row.

create type public.saved_group_kind as enum ('room', 'curriculum');

-- True when obj[key] is a trimmed string of 1..max_length characters,
-- or when the key is absent and not required.
create function public.is_valid_json_text(
  obj jsonb, key text, max_length integer, required boolean
) returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when not (obj ? key) then not required
    else jsonb_typeof(obj -> key) = 'string'
         and char_length(obj ->> key) between 1 and max_length
         and obj ->> key = btrim(obj ->> key)
  end
$$;

-- Shape of a ranked item list; also used by searches.room_items and
-- searches.curricula. Friendly error messages are the application's job.
create function public.is_valid_group_items(kind public.saved_group_kind, items jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  _item   jsonb;
  _course jsonb;
begin
  if jsonb_typeof(items) is distinct from 'array'
     or jsonb_array_length(items) not between 1 and 200 then
    return false;
  end if;

  for _item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(_item) <> 'object' then
      return false;
    end if;

    if kind = 'room' then
      if not public.is_valid_json_text(_item, 'room_code', 32, true)
         or exists (select 1 from jsonb_object_keys(_item) k where k <> 'room_code') then
        return false;
      end if;
    else
      if not (public.is_valid_json_text(_item, 'university', 200, true)
          and public.is_valid_json_text(_item, 'building', 200, true)
          and public.is_valid_json_text(_item, 'institute', 200, true)
          and public.is_valid_json_text(_item, 'degree_level', 200, true)
          and public.is_valid_json_text(_item, 'programme', 200, true)
          and public.is_valid_json_text(_item, 'specialisation', 200, false)
          and public.is_valid_json_text(_item, 'asio_id', 64, false))
         or exists (
           select 1 from jsonb_object_keys(_item) k
           where k <> all (array['university', 'building', 'institute', 'degree_level',
                                 'programme', 'specialisation', 'asio_id', 'courses'])
         ) then
        return false;
      end if;

      if _item ? 'courses' then
        if jsonb_typeof(_item -> 'courses') <> 'array'
           or jsonb_array_length(_item -> 'courses') > 200 then
          return false;
        end if;
        for _course in select value from jsonb_array_elements(_item -> 'courses') loop
          if jsonb_typeof(_course) <> 'object'
             or not public.is_valid_json_text(_course, 'code', 64, true)
             or not public.is_valid_json_text(_course, 'name', 200, true)
             or exists (select 1 from jsonb_object_keys(_course) k where k not in ('code', 'name')) then
            return false;
          end if;
        end loop;
      end if;
    end if;
  end loop;

  return true;
end
$$;

create table public.saved_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  kind       public.saved_group_kind not null,
  name       text not null,
  items      jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target of the same-owner foreign keys from searches.
  constraint saved_groups_id_owner_unique unique (id, owner_id),
  constraint saved_groups_name_unique unique (owner_id, kind, name),
  constraint saved_groups_name_format
    check (char_length(name) between 1 and 100 and name = btrim(name)),
  constraint saved_groups_items_valid
    check (public.is_valid_group_items(kind, items))
);

comment on table public.saved_groups is
  'A user''s saved, named and ranked room or curriculum group. items order = rank.';

create trigger saved_groups_set_updated_at
  before update on public.saved_groups
  for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------------
-- Users never create an account: anonymous sign-in gives each browser its own
-- auth.uid() and the "authenticated" role. "anon" (no session) gets nothing.

alter table public.saved_groups enable row level security;

revoke all on table public.saved_groups from anon, authenticated;
grant select, insert, delete on table public.saved_groups to authenticated;
-- owner_id and kind never change after insert.
grant update (name, items) on table public.saved_groups to authenticated;

create policy "saved_groups: owner can select"
  on public.saved_groups for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "saved_groups: owner can insert"
  on public.saved_groups for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "saved_groups: owner can update"
  on public.saved_groups for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "saved_groups: owner can delete"
  on public.saved_groups for delete to authenticated
  using (owner_id = (select auth.uid()));
