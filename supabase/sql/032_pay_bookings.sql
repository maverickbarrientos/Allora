-- 032_pay_bookings: pay several confirmed bookings in one transaction (docs/SPEC-bulk-payment.md).
-- Run AFTER 029. Safe to run more than once. No new table.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- Pays every booking in p_booking_ids by calling pay_booking() for each, so the
-- deposit rule (deposit_for), ownership, "confirmed only" and "already paid"
-- checks stay in one place. All or nothing: if one booking is refused the whole
-- batch is rolled back and the error names that booking in `detail`.
--
-- p_plan is 'deposit' or 'full'. A booking whose deposit is already paid pays
-- its balance instead, whatever p_plan says. Each payment gets the reference
-- p_reference || '-' || n (n counts from 1 in id order).
create or replace function public.pay_bookings(p_booking_ids uuid[], p_reference text, p_plan text default 'deposit')
returns setof public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_n     int := 0;
  v_kind  text;
  v_row   public.payments;
begin
  if (select auth.uid()) is null or public.current_user_role() is distinct from 'customer' then
    raise exception 'booking_not_found';
  end if;
  if p_plan is null or p_plan not in ('deposit', 'full') then
    raise exception 'invalid_plan';
  end if;
  if p_reference is null or btrim(p_reference) = '' then
    raise exception 'invalid_reference';
  end if;
  if p_booking_ids is null
     or cardinality(p_booking_ids) < 1
     or cardinality(p_booking_ids) > 20
     or exists (select 1 from unnest(p_booking_ids) as x(id) where x.id is null)
     or (select count(distinct x.id) from unnest(p_booking_ids) as x(id)) <> cardinality(p_booking_ids) then
    raise exception 'invalid_booking_ids';
  end if;

  -- Always in id order, so two batches that overlap cannot wait on each other.
  for v_id in select x.id from unnest(p_booking_ids) as x(id) order by x.id loop
    v_n := v_n + 1;
    begin
      -- Lock first, so the deposit check below cannot go stale. pay_booking()
      -- takes the same lock again and refuses a booking that is not the caller's.
      perform 1
      from public.bookings b
      join public.events e on e.id = b.event_id
      where b.id = v_id and e.owner = (select auth.uid())
      for update of b;

      v_kind := case
        when exists (
          select 1 from public.payments p
          where p.booking_id = v_id and p.status = 'paid' and p.kind = 'deposit'
        ) then 'balance'
        else p_plan
      end;

      select * into v_row from public.pay_booking(v_id, p_reference || '-' || v_n, v_kind);
      return next v_row;
    exception when others then
      -- Same message and code, plus the booking that failed. Rolls the batch back.
      raise exception '%', sqlerrm using detail = v_id::text, errcode = sqlstate;
    end;
  end loop;

  return;
end;
$$;

revoke execute on function public.pay_bookings(uuid[], text, text) from public, anon;
grant execute on function public.pay_bookings(uuid[], text, text) to authenticated;
