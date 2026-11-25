-- Event types ordered by popularity (docs/data-model.md, section 4.4).
--
-- Counts searches.event_type over ALL users (case-insensitive, showing the
-- most common spelling) and adds every rooms.event_types value with count 0,
-- so seeded types such as "koosolek" exist before the first search.
--
-- event_type is free text, so a type typed by one user must not leak to others.
-- A type is returned only when it is
--   * seeded (in rooms.event_types), or
--   * used by at least 2 different owners, or
--   * used by the caller (owner_id = auth.uid()).
-- use_count still counts the searches of all users. (Unconfirmed decision.)
--
-- security definer: it must count rows that row level security hides from the
-- caller. It therefore takes no parameters and returns only aggregates
-- (event_type, use_count): never ids, owners, names or times.

create function public.event_type_popularity()
returns table (event_type text, use_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with used as (
    select lower(s.event_type)                          as key,
           mode() within group (order by s.event_type)  as event_type,
           count(*)                                     as use_count,
           count(distinct s.owner_id)                   as owner_count,
           bool_or(s.owner_id = (select auth.uid()))    as used_by_caller
    from public.searches s
    group by lower(s.event_type)
  ),
  seeded as (
    select distinct on (lower(t.event_type))
           lower(t.event_type) as key,
           t.event_type
    from public.rooms r
    cross join unnest(r.event_types) as t (event_type)
    order by lower(t.event_type), t.event_type
  )
  select coalesce(u.event_type, sd.event_type) as event_type,
         coalesce(u.use_count, 0)              as use_count
  from used u
  full join seeded sd on sd.key = u.key
  where sd.key is not null
     or u.owner_count >= 2
     or u.used_by_caller
  order by 2 desc, 1
$$;

comment on function public.event_type_popularity() is
  'Event types (seeded, used by 2+ owners, or by the caller) with their use count over all users, most popular first. Aggregates only.';

-- Functions are executable by PUBLIC by default, and Supabase also grants new
-- functions to anon. Only signed-in (anonymous sign-in) users may call it.
revoke execute on function public.event_type_popularity() from public, anon;
grant execute on function public.event_type_popularity() to authenticated;
