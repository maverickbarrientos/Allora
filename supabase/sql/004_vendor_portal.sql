-- 004_vendor_portal: vendor side of bookings. Safe to run more than once.
-- Run AFTER feature 2 (002 events/bookings, 003 seed vendors).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- Linking a vendor user to a vendor record (done by hand, one user per vendor):
--   update vendors set owner = '<profiles.id>' where id = '<vendors.id>';

-- One vendor record per user.
create unique index if not exists vendors_owner_unique
  on public.vendors (owner) where owner is not null;

-- Vendor policies on bookings (the customer policies from feature 2 are untouched).
drop policy if exists "bookings: vendor reads own" on public.bookings;
create policy "bookings: vendor reads own"
  on public.bookings for select
  to authenticated
  using (
    vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  );

drop policy if exists "bookings: vendor decides pending" on public.bookings;
create policy "bookings: vendor decides pending"
  on public.bookings for update
  to authenticated
  using (
    status = 'pending'
    and vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  )
  with check (
    status in ('confirmed', 'declined')
    and vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  );

-- Column-level: the only column anyone may update on bookings is status.
revoke update on public.bookings from anon, authenticated;
grant update (status) on public.bookings to authenticated;

-- Incoming bookings for the calling vendor, with the event's type, date and
-- guest count only (never budget or owner). Vendors never read events directly.
create or replace function public.vendor_incoming_bookings()
returns table (
  id uuid,
  category text,
  status text,
  created_at timestamptz,
  event_type text,
  event_date date,
  guest_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.category, b.status, b.created_at, e.type, e.date, e.guest_count
  from public.bookings b
  join public.vendors v on v.id = b.vendor_id
  join public.events e on e.id = b.event_id
  where v.owner = (select auth.uid())
$$;

revoke execute on function public.vendor_incoming_bookings() from public, anon;
grant execute on function public.vendor_incoming_bookings() to authenticated;
