-- 018_booking_terms: each booking keeps a frozen copy of the vendor's terms
-- and the time the customer agreed (docs/SPEC-booking-documents.md, ticket 17).
-- Run after 017 (vendor terms). Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

alter table public.bookings add column if not exists terms_snapshot text;
alter table public.bookings add column if not exists terms_accepted_at timestamptz;

-- Before a booking is inserted, the database decides both columns:
--   * vendor without terms: both are null.
--   * vendor with terms: the insert must carry terms_accepted_at (the customer
--     ticked "I agree") and terms_snapshot equal to the vendor's current terms
--     (the text the customer read). Then terms_snapshot is the vendor's terms
--     and terms_accepted_at is now(); the values sent are never kept.
-- The vendor row is share-locked so its terms can't change mid-insert.
-- The API maps the errors to 400 terms_not_accepted and 409 terms_changed.
create or replace function public.bookings_freeze_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms text;
begin
  select v.terms into v_terms
  from public.vendors v
  where v.id = new.vendor_id
  for share;

  if v_terms is null then
    new.terms_snapshot := null;
    new.terms_accepted_at := null;
    return new;
  end if;

  if new.terms_accepted_at is null then
    raise exception 'terms_not_accepted'
      using errcode = 'P0001',
            detail = 'The customer must agree to the vendor''s terms before booking.';
  end if;
  if new.terms_snapshot is distinct from v_terms then
    raise exception 'terms_changed'
      using errcode = 'P0001',
            detail = 'The vendor''s terms changed since the customer read them.';
  end if;

  new.terms_snapshot := v_terms;
  new.terms_accepted_at := now();
  return new;
end;
$$;

revoke execute on function public.bookings_freeze_terms() from public, anon, authenticated;

drop trigger if exists bookings_freeze_terms on public.bookings;
create trigger bookings_freeze_terms
  before insert on public.bookings
  for each row execute function public.bookings_freeze_terms();

-- Nothing else changes: as granted in 005, status is the only booking column
-- anyone may update, so terms_snapshot and terms_accepted_at can't be edited
-- after the insert. Reading stays as before (the event's customer and the
-- booking's vendor).
