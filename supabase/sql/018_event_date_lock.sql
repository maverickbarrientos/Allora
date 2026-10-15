-- 018_event_date_lock: an event's date is locked once it has a confirmed
-- booking (docs/SPEC-availability.md, ticket 11). Safe to run more than once.
-- Run after 017 (confirm check).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- Trigger 4 (spec): changing the date of an event with a confirmed booking is
-- refused with date_has_confirmed_bookings; the whole update is refused, so no
-- other field in it is saved either. Other edits still work.
--
-- Locking: the UPDATE already holds this event's row lock when the trigger
-- runs. A confirm (017) takes the vendor lock and then this same event row
-- lock, so the two can't interleave: if the confirm commits first, this check
-- sees the confirmed booking and refuses; if the date change commits first,
-- the confirm re-reads the event and checks the new date. The vendor rows are
-- not locked here (unlike the spec's wording) because taking them after the
-- event row, in the opposite order to 017, could deadlock.

create or replace function public.check_event_date_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.bookings b
  where b.event_id = new.id and b.status = 'confirmed';
  if v_count > 0 then
    raise exception 'date_has_confirmed_bookings' using errcode = 'P0001', detail = v_count::text;
  end if;
  return new;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.check_event_date_change() from public, anon, authenticated;

drop trigger if exists events_check_date_change on public.events;
create trigger events_check_date_change
  before update of date on public.events
  for each row
  when (new.date is distinct from old.date)
  execute function public.check_event_date_change();
