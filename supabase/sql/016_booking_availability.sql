-- 016_booking_availability: customers can't book a vendor on a taken date
-- (docs/SPEC-availability.md, ticket 09). Safe to run more than once.
-- Run after 009 (read functions) and 014 (vendor_blocked_dates).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- A vendor is unavailable on a date they blocked, or a date with one of their
-- confirmed bookings. Pending and declined bookings never block. The rule
-- lives in vendor_is_available; the read functions below return the same set
-- of dates for a range or for all vendors at once.

create or replace function public.vendor_is_available(
  p_vendor_id uuid,
  p_date date,
  p_except_booking uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
      select 1 from public.vendor_blocked_dates bd
      where bd.vendor_id = p_vendor_id and bd.date = p_date
    )
    and not exists (
      select 1
      from public.bookings b
      join public.events e on e.id = b.event_id
      where b.vendor_id = p_vendor_id
        and b.status = 'confirmed'
        and e.date = p_date
        and (p_except_booking is null or b.id <> p_except_booking)
    )
$$;

revoke execute on function public.vendor_is_available(uuid, date, uuid) from public, anon;
grant execute on function public.vendor_is_available(uuid, date, uuid) to authenticated;

-- Replaces 009: blocked dates now count too. Same signature, so the routes
-- don't change. Only dates are returned, never reasons.
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
  select d from (
    select bd.date as d
    from public.vendor_blocked_dates bd
    where bd.vendor_id = p_vendor_id and bd.date between p_from and p_to
    union
    select e.date
    from public.bookings b
    join public.events e on e.id = b.event_id
    where b.vendor_id = p_vendor_id and b.status = 'confirmed' and e.date between p_from and p_to
  ) x
  order by d
$$;

-- Replaces 009: vendors who blocked p_date are unavailable too. One query for
-- the whole vendor list.
create or replace function public.vendors_unavailable_on(p_date date)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select bd.vendor_id from public.vendor_blocked_dates bd where bd.date = p_date
  union
  select b.vendor_id
  from public.bookings b
  join public.events e on e.id = b.event_id
  where b.status = 'confirmed' and e.date = p_date
$$;

revoke execute on function public.vendor_unavailable_dates(uuid, date, date) from public, anon;
grant execute on function public.vendor_unavailable_dates(uuid, date, date) to authenticated;
revoke execute on function public.vendors_unavailable_on(date) from public, anon;
grant execute on function public.vendors_unavailable_on(date) to authenticated;

-- Trigger 1 (spec): a booking can't be created on a date the vendor is not
-- available. Locks the vendor row first, so this check and a block or a
-- confirm for the same vendor run one at a time.
create or replace function public.check_booking_vendor_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  -- Postgres runs this before RLS checks the row. A caller who doesn't own
  -- the event is left to RLS, which refuses the insert; nothing is locked.
  if (select auth.uid()) is not null
    and not exists (select 1 from public.events e where e.id = new.event_id and e.owner = (select auth.uid()))
  then
    return new;
  end if;

  -- Spec: `already_booked` takes priority. Let the partial unique index refuse it.
  if exists (
    select 1 from public.bookings b
    where b.event_id = new.event_id and b.vendor_id = new.vendor_id and b.status in ('pending', 'confirmed')
  ) then
    return new;
  end if;

  perform 1 from public.vendors v where v.id = new.vendor_id for update;

  select e.date into v_date from public.events e where e.id = new.event_id;
  if v_date is not null and not public.vendor_is_available(new.vendor_id, v_date) then
    raise exception 'vendor_unavailable' using errcode = 'P0001', detail = v_date::text;
  end if;
  return new;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.check_booking_vendor_available() from public, anon, authenticated;

drop trigger if exists bookings_check_vendor_available on public.bookings;
create trigger bookings_check_vendor_available
  before insert on public.bookings
  for each row execute function public.check_booking_vendor_available();
