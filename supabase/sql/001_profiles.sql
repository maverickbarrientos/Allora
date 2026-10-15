-- 001_profiles: profiles table, signup trigger, RLS.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'vendor')),
  name text not null
);

alter table public.profiles enable row level security;

-- SELECT: own row only.
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Helper: the caller's current stored role. Security definer so the UPDATE
-- policy can read it without re-triggering RLS on profiles (which would
-- recurse infinitely).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- UPDATE: own row only, and role must stay unchanged.
create policy "profiles: update own, role immutable"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.current_user_role())
  );

-- No INSERT or DELETE policy: the trigger creates the row.

-- Trigger: create the profile from sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'name'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
