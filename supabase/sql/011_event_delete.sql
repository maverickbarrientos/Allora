-- 011_event_delete: the rule for deleting an event (docs/SPEC-event-delete.md).
-- Safe to run more than once. Run AFTER 002 (events, bookings), 007 and 008.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- No new table. The rule lives only here, in a trigger, so it holds for the
-- API and for direct Supabase client deletes alike:
--   1. any pending booking blocks the delete      -> event_has_pending_bookings
--   2. else a confirmed booking blocks it while the event date is not before
--      current_date (today counts as not finished) -> event_not_finished
-- Declined bookings never block. Deleting relies on the existing cascades:
-- bookings.event_id, payments.booking_id and event_budgets.event_id are all
-- "on delete cascade", so the event's bookings (any status), their payments
-- and its service budgets go with it.

create or replace function public.check_event_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
  v_confirmed integer;
begin
  -- Lock the event row first, so a booking inserted at the same moment either
  -- commits before this count (and blocks the delete) or waits and then fails
  -- its foreign key check because the event is gone.
  perform 1 from public.events where id = old.id for update;
  -- Also lock the event's bookings, so a status change in flight (a vendor
  -- accepting, declining or flipping a decision) finishes first and is counted
  -- with its final status. Status changes don't touch the event row.
  perform 1 from public.bookings where event_id = old.id for update;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'confirmed')
  into v_pending, v_confirmed
  from public.bookings
  where event_id = old.id;

  if v_pending > 0 then
    raise exception 'event_has_pending_bookings' using detail = v_pending::text;
  end if;

  if v_confirmed > 0 and not (old.date < current_date) then
    raise exception 'event_not_finished' using detail = old.date::text;
  end if;

  return old;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.check_event_delete() from public, anon, authenticated;

drop trigger if exists events_check_delete on public.events;
create trigger events_check_delete
  before delete on public.events
  for each row execute function public.check_event_delete();

-- Owners may delete their own events (002 created this policy; recreated here
-- unchanged so this file stands on its own). The trigger still applies.
grant delete on public.events to authenticated;

drop policy if exists "events: delete own" on public.events;
create policy "events: delete own"
  on public.events for delete
  to authenticated
  using (owner = (select auth.uid()));
