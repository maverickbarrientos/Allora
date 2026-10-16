-- 029_full_payment: pay the full amount, or the balance after a deposit (docs/SPEC-payment.md).
-- Run AFTER 008 and 010. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- kind: 'deposit' (30%), 'full' (whole price) or 'balance' (price minus the deposit paid).
alter table public.payments
  add column if not exists kind text not null default 'deposit'
  check (kind in ('deposit', 'full', 'balance'));

-- At most one active (paid) payment of each kind per booking.
drop index if exists public.payments_booking_paid_uniq;
create unique index if not exists payments_booking_kind_paid_uniq
  on public.payments (booking_id, kind) where status = 'paid';

drop function if exists public.pay_booking(uuid, text);

create or replace function public.pay_booking(p_booking_id uuid, p_reference text, p_kind text default 'deposit')
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_price   numeric;
  v_owner   uuid;
  v_paid    numeric;
  v_amount  numeric;
  v_row     public.payments;
begin
  if (select auth.uid()) is null or public.current_user_role() is distinct from 'customer' then
    raise exception 'booking_not_found';
  end if;
  if p_kind is null or p_kind not in ('deposit', 'full', 'balance') then
    raise exception 'invalid_kind';
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
  if p_reference is null or btrim(p_reference) = '' then
    raise exception 'invalid_reference';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p where p.booking_id = p_booking_id and p.status = 'paid';

  if p_kind = 'balance' then
    if not exists (select 1 from public.payments p where p.booking_id = p_booking_id and p.status = 'paid' and p.kind = 'deposit') then
      raise exception 'nothing_due';
    end if;
    if exists (select 1 from public.payments p where p.booking_id = p_booking_id and p.status = 'paid' and p.kind = 'balance') then
      raise exception 'already_paid';
    end if;
    v_amount := v_price - v_paid;
    if v_amount <= 0 then
      raise exception 'nothing_due';
    end if;
  else
    if v_paid > 0 then
      raise exception 'already_paid';
    end if;
    v_amount := case when p_kind = 'full' then v_price else public.deposit_for(v_price) end;
  end if;

  insert into public.payments (booking_id, amount, status, reference, kind)
  values (p_booking_id, v_amount, 'paid', p_reference, p_kind)
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.pay_booking(uuid, text, text) from public, anon;
grant execute on function public.pay_booking(uuid, text, text) to authenticated;
