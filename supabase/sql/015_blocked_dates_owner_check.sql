-- 015_blocked_dates_owner_check: review fix for 014 (ticket 08).
-- Safe to run more than once. Run after 014.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- Postgres runs BEFORE ROW triggers before RLS checks the new row, so the 014
-- trigger locked the vendor row even for a caller inserting someone else's
-- vendor_id, before RLS refused the insert. The trigger now checks ownership
-- first and touches nothing for a caller who doesn't own the vendor (RLS then
-- refuses the insert as before). Calls without a user (the SQL Editor) are
-- still checked against confirmed bookings.

create or replace function public.check_blocked_date_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not exists (select 1 from public.vendors v where v.id = new.vendor_id and v.owner = (select auth.uid()))
  then
    return new;
  end if;

  -- Serialises blocking for one vendor. Confirming a booking takes the same
  -- lock from ticket 10 on, so a block and a confirm for one vendor then run
  -- one at a time.
  perform 1 from public.vendors v where v.id = new.vendor_id for update;

  if exists (
    select 1
    from public.bookings b
    join public.events e on e.id = b.event_id
    where b.vendor_id = new.vendor_id and b.status = 'confirmed' and e.date = new.date
  ) then
    raise exception 'date_has_confirmed_booking' using errcode = 'P0001', detail = new.date::text;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_blocked_date_free() from public, anon, authenticated;
