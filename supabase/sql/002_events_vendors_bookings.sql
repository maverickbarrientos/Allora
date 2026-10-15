-- 002_events_vendors_bookings: vendors, events, bookings, RLS (customer side).
-- Run after 001_profiles.sql. Safe to re-run.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- Tables -----------------------------------------------------------

create table if not exists public.vendors (
  id       uuid primary key default gen_random_uuid(),
  name     text    not null,
  category text    not null,
  price    numeric not null check (price >= 0),
  owner    uuid    references public.profiles (id)
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid    not null default auth.uid()
                      references public.profiles (id) on delete cascade,
  type        text    not null check (type in ('wedding', 'birthday', 'corporate')),
  date        date    not null,
  budget      numeric not null check (budget > 0),
  guest_count int     not null check (guest_count > 0),
  created_at  timestamptz not null default now()
);

create table if not exists public.bookings (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  vendor_id  uuid not null references public.vendors (id),
  category   text not null,
  status     text not null default 'pending'
             check (status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);

-- One active (pending or confirmed) booking per vendor per event.
-- A declined booking does not block booking the same vendor again.
create unique index if not exists bookings_event_vendor_active_uniq
  on public.bookings (event_id, vendor_id)
  where status in ('pending', 'confirmed');

-- RLS: vendors -----------------------------------------------------

alter table public.vendors enable row level security;

-- SELECT: any signed-in user. No INSERT, UPDATE or DELETE policy.
drop policy if exists "vendors: read signed in" on public.vendors;
create policy "vendors: read signed in"
  on public.vendors for select
  to authenticated
  using (true);

-- RLS: events ------------------------------------------------------

alter table public.events enable row level security;

drop policy if exists "events: read own" on public.events;
create policy "events: read own"
  on public.events for select
  to authenticated
  using (owner = (select auth.uid()));

-- INSERT: own row, and only customers create events.
drop policy if exists "events: customer insert own" on public.events;
create policy "events: customer insert own"
  on public.events for insert
  to authenticated
  with check (
    owner = (select auth.uid())
    and (select public.current_user_role()) = 'customer'
  );

drop policy if exists "events: update own" on public.events;
create policy "events: update own"
  on public.events for update
  to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists "events: delete own" on public.events;
create policy "events: delete own"
  on public.events for delete
  to authenticated
  using (owner = (select auth.uid()));

-- RLS: bookings (customer side) ------------------------------------

alter table public.bookings enable row level security;

-- SELECT: bookings on the caller's own events.
drop policy if exists "bookings: customer read own events" on public.bookings;
create policy "bookings: customer read own events"
  on public.bookings for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = bookings.event_id
        and e.owner = (select auth.uid())
    )
  );

-- INSERT: into the caller's own event, as pending, customers only.
drop policy if exists "bookings: customer insert pending" on public.bookings;
create policy "bookings: customer insert pending"
  on public.bookings for insert
  to authenticated
  with check (
    status = 'pending'
    and (select public.current_user_role()) = 'customer'
    and exists (
      select 1 from public.events e
      where e.id = bookings.event_id
        and e.owner = (select auth.uid())
    )
  );

-- No customer UPDATE or DELETE policy: status changes belong to vendors
-- (feature 3 adds those policies).
