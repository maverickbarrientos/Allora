-- 032_pay_bookings: pay several confirmed bookings in one transaction (docs/SPEC-bulk-payment.md).
-- Run AFTER 029. Safe to run more than once. No new table.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- An earlier draft took (uuid[], text, text); drop it so only one version exists.
drop function if exists public.pay_bookings(uuid[], text, text);

-- Pays every booking in p_booking_ids by calling pay_booking() for each, so the
-- deposit rule (deposit_for), ownership, "confirmed only" and "already paid"
-- checks stay in one place. All or nothing: if one booking is refused the whole
-- batch is rolled back and the error names that booking in `detail`.
--
-- p_kinds[i] is the kind to pay for p_booking_ids[i]: 'deposit', 'full' or
-- 'balance'. The caller says it explicitly (the route reads what is already
-- paid), so two identical requests at the same time cannot both pay: the second
-- one finds the first one's payment and pay_booking() refuses it. Each payment
-- gets the reference p_reference || '-' || n (n counts from 1 in id order).
create or replace function public.pay_bookings(p_booking_ids uuid[], p_kinds text[], p_reference text)
returns setof public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_kind  text;
  v_n     int := 0;
  v_row   public.payments;
begin
  if (select auth.uid()) is null or public.current_user_role() is distinct from 'customer' then
    raise exception 'booking_not_found';
  end if;
  if p_reference is null or btrim(p_reference) = '' then
    raise exception 'invalid_reference';
  end if;
  if p_booking_ids is null
     or p_kinds is null
     or cardinality(p_booking_ids) < 1
     or cardinality(p_booking_ids) > 20
     or cardinality(p_kinds) <> cardinality(p_booking_ids)
     or exists (select 1 from unnest(p_booking_ids) as x(id) where x.id is null)
     or (select count(distinct x.id) from unnest(p_booking_ids) as x(id)) <> cardinality(p_booking_ids) then
    raise exception 'invalid_booking_ids';
  end if;
  if exists (
    select 1 from unnest(p_kinds) as k(kind)
    where k.kind is null or k.kind not in ('deposit', 'full', 'balance')
  ) then
    raise exception 'invalid_kind';
  end if;

  -- Always in id order, so two batches that overlap cannot wait on each other
  -- (pay_booking() locks each booking as it goes).
  for v_id, v_kind in
    select x.id, k.kind
    from unnest(p_booking_ids) with ordinality as x(id, i)
    join unnest(p_kinds) with ordinality as k(kind, i) using (i)
    order by x.id
  loop
    v_n := v_n + 1;
    begin
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

revoke execute on function public.pay_bookings(uuid[], text[], text) from public, anon;
grant execute on function public.pay_bookings(uuid[], text[], text) to authenticated;
