-- Saved groups (docs/data-model.md, sections 4.2, 5.1, 5.2).
--
-- A user's named, ranked room groups (1.1) and curriculum groups (1.3).
-- Array order in items is the rank (index 0 = first choice).
-- "Change and save under a new name" inserts a new row.

create type public.saved_group_kind as enum ('room', 'curriculum');

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
    check (case when jsonb_typeof(items) = 'array'
           then jsonb_array_length(items) between 1 and 200
           else false end)
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
