-- 024_availability_review_fixes: review fixes for the availability rules (021-023).
-- Safe to run more than once. Run after 023.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- 1. No early-return bypass. The booking (021) and confirm (022) rules skip
--    their check when another active booking exists for the same event and
--    vendor, so the unique index gives already_booked / conflicting_booking
--    first. That other row is now locked while checking: if it is being
--    declined at the same moment, we wait, see it declined, and run the check.
-- 2. No deadlock between a confirm and an event delete (011 locks the event,
--    then its bookings). The confirm no longer locks the event row. Instead the
--    date-change rule (023) locks the event's bookings before counting, in the
--    same order as 011, so a confirm and a date change still run one at a time.
-- 3. vendor_is_available is only needed by these rules (they run as its owner),
--    so signed-in users can no longer call it directly.

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
  perform 1 from public.bookings b
  where b.event_id = new.event_id and b.vendor_id = new.vendor_id and b.status in ('pending', 'confirmed')
  for update;
  if found then
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

create or replace function public.check_confirm_vendor_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  -- Spec order: `conflicting_booking` comes before `date_unavailable`. Another
  -- active booking for the same event and vendor is left to the unique index.
  perform 1 from public.bookings b
  where b.event_id = new.event_id and b.vendor_id = new.vendor_id
    and b.id <> new.id and b.status in ('pending', 'confirmed')
  for update;
  if found then
    return new;
  end if;

  perform 1 from public.vendors v where v.id = new.vendor_id for update;
  -- No lock on the event row (see 2 above); a date change waits on this booking instead.
  select e.date into v_date from public.events e where e.id = new.event_id;

  if v_date is not null and not public.vendor_is_available(new.vendor_id, v_date, new.id) then
    raise exception 'date_unavailable' using
      errcode = 'P0001',
      detail = v_date::text,
      hint = case
        when exists (
          select 1 from public.vendor_blocked_dates bd where bd.vendor_id = new.vendor_id and bd.date = v_date
        ) then 'blocked'
        else 'booked'
      end;
  end if;
  return new;
end;
$$;

create or replace function public.check_event_date_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Event (held by this UPDATE), then its bookings: the same order as 011. A
  -- confirm in progress holds its booking row, so this waits for it and then
  -- counts it; a confirm that comes later waits here and then reads the new date.
  perform 1 from public.bookings b where b.event_id = new.id for share;

  select count(*) into v_count
  from public.bookings b
  where b.event_id = new.id and b.status = 'confirmed';
  if v_count > 0 then
    raise exception 'date_has_confirmed_bookings' using errcode = 'P0001', detail = v_count::text;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_booking_vendor_available() from public, anon, authenticated;
revoke execute on function public.check_confirm_vendor_available() from public, anon, authenticated;
revoke execute on function public.check_event_date_change() from public, anon, authenticated;
revoke execute on function public.vendor_is_available(uuid, date, uuid) from public, anon, authenticated;
