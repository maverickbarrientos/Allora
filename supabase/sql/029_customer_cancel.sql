-- 029_customer_cancel: a customer asks to cancel a booking; the vendor approves
-- or keeps it (docs/SPEC-customer-cancel.md). Safe to run more than once.
-- Run after 028. Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- A request is a flag, not a status: bookings.cancel_requested_at. The booking
-- stays pending or confirmed while the vendor decides, so every existing rule
-- (date, contact details, event date lock, budget, one active booking per
-- vendor and event) keeps treating it as the booking it is.
--   Customer: request_booking_cancellation() sets the flag (pending or confirmed only).
--   Vendor:   approve = status cancelled (the 005 policy, widened below);
--             keep    = keep_booking() clears the flag; the status is untouched.
-- Approving refunds a paid deposit (section 4). cancelled is inactive like
-- declined, so its service becomes a gap again.

-- 1. Column and statuses ---------------------------------------------------

alter table public.bookings add column if not exists cancel_requested_at timestamptz;

-- An earlier version of this file used a cancel_requested status. Fold any
-- such rows into the flag before the constraint stops allowing it.
update public.bookings
   set status = 'confirmed', cancel_requested_at = coalesce(cancel_requested_at, now())
 where status = 'cancel_requested';

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'cancelled'));

drop index if exists public.bookings_event_vendor_active_uniq;
create unique index bookings_event_vendor_active_uniq
  on public.bookings (event_id, vendor_id)
  where status in ('pending', 'confirmed');

-- 2. Vendor policy: may also set cancelled -----------------------------------
-- Column grants stay as in 005: status is the only column a signed-in user can
-- update. The flag changes only through the two functions below.

drop policy if exists "bookings: vendor decides" on public.bookings;
create policy "bookings: vendor decides"
  on public.bookings for update
  to authenticated
  using (
    vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  )
  with check (
    status in ('confirmed', 'declined', 'cancelled')
    and vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  );

-- 3. The request, the answer ---------------------------------------------------

-- Returns the time of the request, or null when the booking is not the caller's,
-- is not pending or confirmed, or already has a request open.
-- The old function returned text, so it is dropped first.
drop function if exists public.request_booking_cancellation(uuid);
create function public.request_booking_cancellation(p_booking uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  update public.bookings b
     set cancel_requested_at = now()
   where b.id = p_booking
     and b.status in ('pending', 'confirmed')
     and b.cancel_requested_at is null
     and exists (
       select 1 from public.events e
       where e.id = b.event_id and e.owner = (select auth.uid())
     )
  returning b.cancel_requested_at into v_at;
  return v_at;
end;
$$;

revoke execute on function public.request_booking_cancellation(uuid) from public, anon;
grant execute on function public.request_booking_cancellation(uuid) to authenticated;

-- The vendor keeps the booking: clears the request. Returns true if there was
-- one. Only the booking's own vendor can do it.
create or replace function public.keep_booking(p_booking uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.bookings b
     set cancel_requested_at = null
   where b.id = p_booking
     and b.cancel_requested_at is not null
     and b.status in ('pending', 'confirmed')
     and b.vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  returning b.id into v_id;
  return v_id is not null;
end;
$$;

revoke execute on function public.keep_booking(uuid) from public, anon;
grant execute on function public.keep_booking(uuid) to authenticated;

-- A request is answered when the status changes: accepting or declining a
-- pending booking clears it; approving (cancelled) keeps it as the record.
create or replace function public.bookings_clear_cancel_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    new.cancel_requested_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_clear_cancel_request on public.bookings;
create trigger bookings_clear_cancel_request
  before update of status on public.bookings
  for each row execute function public.bookings_clear_cancel_request();

-- The vendor's list (005) also returns the flag. Return type changes, so drop first.
drop function if exists public.vendor_incoming_bookings();
create function public.vendor_incoming_bookings()
returns table (
  id uuid,
  category text,
  status text,
  created_at timestamptz,
  event_type text,
  event_date date,
  guest_count integer,
  event_budget numeric,
  customer_name text,
  cancel_requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.category, b.status, b.created_at,
         e.type, e.date, e.guest_count, e.budget, coalesce(p.name, ''),
         b.cancel_requested_at
  from public.bookings b
  join public.vendors v on v.id = b.vendor_id
  join public.events e on e.id = b.event_id
  left join public.profiles p on p.id = e.owner
  where v.owner = (select auth.uid())
$$;

revoke execute on function public.vendor_incoming_bookings() from public, anon;
grant execute on function public.vendor_incoming_bookings() to authenticated;

-- 4. Refund when cancelled (008) ---------------------------------------------

create or replace function public.refund_payment_on_decline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('declined', 'cancelled') then
    update public.payments
       set status = 'refunded', refunded_at = now()
     where booking_id = new.id
       and status = 'paid';
  end if;
  return null;
end;
$$;

revoke execute on function public.refund_payment_on_decline() from public, anon, authenticated;

-- 5. Restore the rules an earlier version of this file widened ---------------------
-- (it made cancel_requested a status). They are back to their 005 / 012 / 024 / 025
-- bodies, which already treat only pending and confirmed as active. Safe on a fresh database too.

-- 005: vendor category lock.
create or replace function public.vendors_category_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category is distinct from old.category
     and exists (
       select 1 from public.bookings b
       where b.vendor_id = old.id
         and b.status in ('pending', 'confirmed')
     ) then
    raise exception 'category_locked'
      using errcode = 'P0001',
            detail = 'Category cannot change while there are pending or confirmed bookings.';
  end if;
  return new;
end;
$$;
revoke execute on function public.vendors_category_lock() from public, anon, authenticated;

-- 012: removing an event service.
create or replace function public.check_event_service_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = old.event_id
      and b.category = old.category
      and b.status in ('pending', 'confirmed')
  ) then
    raise exception 'service_has_active_booking' using detail = old.category;
  end if;

  delete from public.event_budgets b
  where b.event_id = old.event_id and b.category = old.category;
  return old;
end;
$$;

create or replace function public.set_event_services(p_event_id uuid, p_categories text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_blocked text;
begin
  if p_categories is null
    or cardinality(p_categories) not between 1 and 20
    or array_position(p_categories, null) is not null
    or (select count(distinct c) from unnest(p_categories) as c) <> cardinality(p_categories)
  then
    raise exception 'invalid_services';
  end if;

  select string_agg(s.category, ', ' order by s.position) into v_blocked
  from public.event_services s
  where s.event_id = p_event_id
    and s.category <> all (p_categories)
    and exists (
      select 1 from public.bookings b
      where b.event_id = s.event_id
        and b.category = s.category
        and b.status in ('pending', 'confirmed')
    );
  if v_blocked is not null then
    raise exception 'service_has_active_booking' using detail = v_blocked;
  end if;

  delete from public.event_services s
  where s.event_id = p_event_id and s.category <> all (p_categories);

  insert into public.event_services (event_id, category, position)
  select p_event_id, c.category, c.ord::int
  from unnest(p_categories) with ordinality as c (category, ord)
  on conflict (event_id, category) do update set position = excluded.position;
end;
$$;

-- 024: booking and confirm availability checks (same bodies, wider status list).
create or replace function public.check_booking_vendor_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if (select auth.uid()) is not null
    and not exists (select 1 from public.events e where e.id = new.event_id and e.owner = (select auth.uid()))
  then
    return new;
  end if;

  perform 1 from public.bookings b
  where b.event_id = new.event_id and b.vendor_id = new.vendor_id
    and b.status in ('pending', 'confirmed')
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
  perform 1 from public.bookings b
  where b.event_id = new.event_id and b.vendor_id = new.vendor_id
    and b.id <> new.id and b.status in ('pending', 'confirmed')
  for update;
  if found then
    return new;
  end if;

  perform 1 from public.vendors v where v.id = new.vendor_id for update;
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
revoke execute on function public.check_confirm_vendor_available() from public, anon, authenticated;

-- 025: the chat stays open while a request is open.
create or replace function public.conversation_is_open(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_conversation_participant(p_conversation_id) and exists (
    select 1
    from public.conversations c
    join public.events e on e.owner = c.customer_id
    join public.bookings b on b.event_id = e.id and b.vendor_id = c.vendor_id
    where c.id = p_conversation_id
      and b.status in ('pending', 'confirmed')
  )
$$;
