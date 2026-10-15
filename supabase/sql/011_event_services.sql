-- 011_event_services: each event's own list of services (docs/SPEC-event-services.md).
-- Safe to run more than once. Run after 007 (event_budgets). Needs public.current_user_role() from 001.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.event_services (
  event_id   uuid not null references public.events (id) on delete cascade,
  category   text not null,
  position   int  not null,
  created_at timestamptz not null default now(),
  primary key (event_id, category)
);

-- Category slugs only (lowercase letters and underscores). The API checks the
-- category is a known one; this stops junk written straight through the client.
alter table public.event_services drop constraint if exists event_services_category_format;
alter table public.event_services
  add constraint event_services_category_format check (category ~ '^[a-z_]{1,40}$');

alter table public.event_services enable row level security;
revoke all on public.event_services from anon;

-- Owner of the event only. Vendors have no access.
drop policy if exists "event_services: read own" on public.event_services;
create policy "event_services: read own"
  on public.event_services for select
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

drop policy if exists "event_services: insert own" on public.event_services;
create policy "event_services: insert own"
  on public.event_services for insert
  to authenticated
  with check (
    (select public.current_user_role()) = 'customer'
    and exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid()))
  );

-- Only the position changes on update (the order of the list).
drop policy if exists "event_services: update own" on public.event_services;
create policy "event_services: update own"
  on public.event_services for update
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

drop policy if exists "event_services: delete own" on public.event_services;
create policy "event_services: delete own"
  on public.event_services for delete
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

revoke update on public.event_services from authenticated;
grant update (position) on public.event_services to authenticated;

-- A service with a pending or confirmed booking can't be removed. Removing one
-- also removes its set budget. When the whole event is being deleted the event
-- row is already gone, so the check is skipped and the cascade goes ahead.
-- Runs with the caller's rights (not security definer).
create or replace function public.check_event_service_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = old.event_id
      and b.category = old.category
      and b.status in ('pending', 'confirmed')
  ) then
    raise exception 'service_has_active_booking' using detail = old.category;
  end if;

  delete from public.event_budgets b
  where b.event_id = old.event_id and b.category = old.category;
  return old;
end;
$$;

drop trigger if exists event_services_check_removal on public.event_services;
create trigger event_services_check_removal
  before delete on public.event_services
  for each row execute function public.check_event_service_removal();

-- Replace an event's whole list in ONE transaction (a function call is one
-- transaction): all of it applies or none of it does. security invoker, so RLS
-- and the trigger above apply. p_categories is the new list, in order.
-- If any removed service has an active booking, nothing changes and the error
-- detail lists every blocked category, comma separated. A bad list (empty, over 20,
-- a null or a duplicate) raises invalid_services.
create or replace function public.set_event_services(p_event_id uuid, p_categories text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_blocked text;
begin
  -- 1 to 20 categories, no nulls, no duplicates.
  if p_categories is null
    or cardinality(p_categories) not between 1 and 20
    or array_position(p_categories, null) is not null
    or (select count(distinct c) from unnest(p_categories) as c) <> cardinality(p_categories)
  then
    raise exception 'invalid_services';
  end if;

  select string_agg(s.category, ', ' order by s.position) into v_blocked
  from public.event_services s
  where s.event_id = p_event_id
    and s.category <> all (p_categories)
    and exists (
      select 1 from public.bookings b
      where b.event_id = s.event_id
        and b.category = s.category
        and b.status in ('pending', 'confirmed')
    );
  if v_blocked is not null then
    raise exception 'service_has_active_booking' using detail = v_blocked;
  end if;

  delete from public.event_services s
  where s.event_id = p_event_id and s.category <> all (p_categories);

  insert into public.event_services (event_id, category, position)
  select p_event_id, c.category, c.ord::int
  from unnest(p_categories) with ordinality as c (category, ord)
  on conflict (event_id, category) do update set position = excluded.position;
end;
$$;

revoke execute on function public.set_event_services(uuid, text[]) from public, anon;
grant execute on function public.set_event_services(uuid, text[]) to authenticated;

-- Backfill: every event that has no services yet gets its type's default list
-- (DEFAULT_SERVICES in the matching config), so existing events behave as before.
-- Events that already have a list are left alone, so a rerun never re-adds a removed service.
insert into public.event_services (event_id, category, position)
select e.id, d.category, d.ord::int
from public.events e
cross join lateral unnest(
  case e.type
    when 'wedding'   then array['venue', 'catering', 'photography', 'music', 'decoration']
    when 'birthday'  then array['venue', 'catering', 'decoration', 'music']
    when 'corporate' then array['venue', 'catering', 'photography']
  end
) with ordinality as d (category, ord)
where not exists (select 1 from public.event_services s where s.event_id = e.id)
on conflict (event_id, category) do nothing;
