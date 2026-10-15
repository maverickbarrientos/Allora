-- 029_customer_cancel: a customer asks to cancel a booking; the vendor approves
-- or rejects (docs/SPEC-customer-cancel.md). Safe to run more than once.
-- Run after 028. Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- New booking statuses:
--   cancel_requested  still ACTIVE (holds its category and its vendor/event pair)
--   cancelled         INACTIVE, like declined, but tells a customer cancel apart
-- Customer: pending|confirmed -> cancel_requested, only through the function below.
-- Vendor:   cancel_requested -> cancelled (approve) or confirmed (reject).
-- Shortcut: the date and contact rules (014, 016, 020, 021, 023) look at
-- status = 'confirmed' only, so while a request is open the date and the
-- contact details are treated as free. Upgrade if that matters.

-- 1. Statuses ---------------------------------------------------------

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'cancel_requested', 'cancelled'));

drop index if exists public.bookings_event_vendor_active_uniq;
create unique index bookings_event_vendor_active_uniq
  on public.bookings (event_id, vendor_id)
  where status in ('pending', 'confirmed', 'cancel_requested');

-- 2. Vendor policy: may also set cancelled ---------------------------------

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

-- 3. Customer request ------------------------------------------------------
-- The customer has no UPDATE right on bookings; this is the only way in.
-- Returns the new status, or null when the booking is not theirs or is not
-- pending/confirmed (the API reads null as 404 or 409 using a second read).

create or replace function public.request_booking_cancellation(p_booking uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  update public.bookings b
     set status = 'cancel_requested'
   where b.id = p_booking
     and b.status in ('pending', 'confirmed')
     and exists (
       select 1 from public.events e
       where e.id = b.event_id and e.owner = (select auth.uid())
     )
  returning b.status into v_status;
  return v_status;
end;
$$;

revoke execute on function public.request_booking_cancellation(uuid) from public, anon;
grant execute on function public.request_booking_cancellation(uuid) to authenticated;

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

-- 5. cancel_requested counts as active in the existing rules ---------------------

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
         and b.status in ('pending', 'confirmed', 'cancel_requested')
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
      and b.status in ('pending', 'confirmed', 'cancel_requested')
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
        and b.status in ('pending', 'confirmed', 'cancel_requested')
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
    and b.status in ('pending', 'confirmed', 'cancel_requested')
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
    and b.id <> new.id and b.status in ('pending', 'confirmed', 'cancel_requested')
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
      and b.status in ('pending', 'confirmed', 'cancel_requested')
  )
$$;
