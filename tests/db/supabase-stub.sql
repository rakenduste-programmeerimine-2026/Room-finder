-- Minimal stand-in for the parts of a Supabase database our migrations use.
-- Lets us run the real migrations in PGlite (Postgres in WASM) in unit tests
-- and CI, without Docker or a hosted project.
--
-- Mirrors Supabase behaviour for: roles, auth.users and auth.uid().

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- auth -----------------------------------------------------------------------
create schema auth;

create table auth.users (
  id           uuid primary key,
  is_anonymous boolean not null default true
);

-- Same lookup order as Supabase's auth.uid().
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- public: Supabase's default privileges on new tables and functions ----------
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
