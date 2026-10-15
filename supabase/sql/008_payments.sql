-- 008_payments: demo deposits for confirmed bookings (docs/SPEC-payment.md).
-- Run AFTER 001 to 007. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
-- No real money and no card data: the only payment input is a test outcome.

-- Table ---------------------------------------------------------------

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  amount      numeric not null check (amount > 0),
  status      text not null check (status in ('paid', 'refunded')),
  reference   text not null,
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

-- At most one active (paid) payment per booking. Refunded ones don't count,
-- so a booking can be paid again after a refund.
create unique index if not exists payments_booking_paid_uniq
  on public.payments (booking_id) where status = 'paid';

-- RLS -----------------------------------------------------------------

alter table public.payments enable row level security;

-- Read only. Writes happen only inside pay_booking() and the refund trigger.
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

drop policy if exists "payments: customer reads own" on public.payments;
create policy "payments: customer reads own"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.events e on e.id = b.event_id
      where b.id = payments.booking_id
        and e.owner = (select auth.uid())
    )
  );

drop policy if exists "payments: vendor reads own" on public.payments;
create policy "payments: vendor reads own"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.vendors v on v.id = b.vendor_id
      where b.id = payments.booking_id
        and v.owner = (select auth.uid())
    )
  );

-- Deposit rule: the ONLY place it exists. 30% is a placeholder.

create or replace function public.deposit_for(price numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(price * 0.30, 2)
$$;

revoke execute on function public.deposit_for(numeric) from public, anon;
grant execute on function public.deposit_for(numeric) to authenticated;

-- Pay a booking -------------------------------------------------------
-- Called by POST /api/bookings/:id/pay after the demo provider approved.
-- Locks the booking row, so it runs one at a time with other payments and
-- with a vendor's decision on the same booking. Errors are mapped by the API.

create or replace function public.pay_booking(p_booking_id uuid, p_reference text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_price  numeric;
  v_owner  uuid;
  v_row    public.payments;
begin
  if (select auth.uid()) is null or public.current_user_role() is distinct from 'customer' then
    raise exception 'booking_not_found';
  end if;

  select b.status, v.price, e.owner
    into v_status, v_price, v_owner
  from public.bookings b
  join public.events e on e.id = b.event_id
  join public.vendors v on v.id = b.vendor_id
  where b.id = p_booking_id
  for update of b;

  if not found or v_owner is distinct from (select auth.uid()) then
    raise exception 'booking_not_found';
  end if;
  if v_status <> 'confirmed' then
    raise exception 'booking_not_confirmed';
  end if;
  if exists (select 1 from public.payments p where p.booking_id = p_booking_id and p.status = 'paid') then
    raise exception 'already_paid';
  end if;
  if p_reference is null or btrim(p_reference) = '' then
    raise exception 'invalid_reference';
  end if;

  insert into public.payments (booking_id, amount, status, reference)
  values (p_booking_id, public.deposit_for(v_price), 'paid', p_reference)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.pay_booking(uuid, text) from public, anon;
grant execute on function public.pay_booking(uuid, text) to authenticated;

-- Refund on decline ---------------------------------------------------
-- When a booking becomes declined, its paid payment is refunded in the same
-- transaction as the status change.

create or replace function public.refund_payment_on_decline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'declined' then
    update public.payments
       set status = 'refunded', refunded_at = now()
     where booking_id = new.id
       and status = 'paid';
  end if;
  return null;
end;
$$;

revoke execute on function public.refund_payment_on_decline() from public, anon, authenticated;

drop trigger if exists bookings_refund_on_decline on public.bookings;
create trigger bookings_refund_on_decline
  after update of status on public.bookings
  for each row execute function public.refund_payment_on_decline();
