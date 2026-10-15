-- 009_availability: read-only vendor availability, derived from bookings.
-- Safe to run more than once. Run AFTER 002 (events, bookings), 004 and 005 (vendor_incoming_bookings).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- No new table, trigger or policy. A vendor is unavailable on a date when they
-- have a CONFIRMED booking whose event is on that date. Pending and declined
-- bookings never block. The only things returned are dates (or vendor ids),
-- never customers, budgets or other bookings. The functions are security
-- definer because customers cannot read other customers' events or bookings.

-- Dates in [p_from, p_to] on which one vendor has a confirmed booking.
create or replace function public.vendor_unavailable_dates(
  p_vendor_id uuid,
  p_from date,
  p_to date
)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.date
  from public.bookings b
  join public.events e on e.id = b.event_id
  where b.vendor_id = p_vendor_id
    and b.status = 'confirmed'
    and e.date between p_from and p_to
  order by 1
$$;

-- Ids of all vendors with a confirmed booking on p_date: one query for the
-- whole vendor list.
create or replace function public.vendors_unavailable_on(p_date date)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct b.vendor_id
  from public.bookings b
  join public.events e on e.id = b.event_id
  where b.status = 'confirmed'
    and e.date = p_date
$$;

revoke execute on function public.vendor_unavailable_dates(uuid, date, date) from public, anon;
grant execute on function public.vendor_unavailable_dates(uuid, date, date) to authenticated;
revoke execute on function public.vendors_unavailable_on(date) from public, anon;
grant execute on function public.vendors_unavailable_on(date) to authenticated;
