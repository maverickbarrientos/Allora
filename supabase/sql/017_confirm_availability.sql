-- 017_confirm_availability: confirming a booking rechecks the date
-- (docs/SPEC-availability.md, ticket 10). Safe to run more than once.
-- Run after 016 (vendor_is_available).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- Trigger 2 (spec): when a booking becomes confirmed (a new acceptance, or
-- "Accept instead" on a declined one), the vendor must be available on the
-- event's date, not counting this booking. Locks the vendor row, then the
-- event row, so two confirms, or a confirm and a block, for one vendor run one
-- at a time, and the event's date can't change underneath.
-- The error says why in its hint: 'booked' (another confirmed booking that
-- day) or 'blocked' (the vendor blocked the day).

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
  if exists (
    select 1 from public.bookings b
    where b.event_id = new.event_id and b.vendor_id = new.vendor_id
      and b.id <> new.id and b.status in ('pending', 'confirmed')
  ) then
    return new;
  end if;

  perform 1 from public.vendors v where v.id = new.vendor_id for update;
  select e.date into v_date from public.events e where e.id = new.event_id for update;

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

-- Only the trigger calls it.
revoke execute on function public.check_confirm_vendor_available() from public, anon, authenticated;

-- Fires only when the status changes to confirmed; declining is never checked.
drop trigger if exists bookings_check_confirm_available on public.bookings;
create trigger bookings_check_confirm_available
  before update of status on public.bookings
  for each row
  when (new.status = 'confirmed' and old.status is distinct from 'confirmed')
  execute function public.check_confirm_vendor_available();
