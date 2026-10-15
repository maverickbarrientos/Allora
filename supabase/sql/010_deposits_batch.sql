-- 010_deposits_batch: every deposit amount in one call.
-- Run after 008_payments.sql. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- The deposit rule stays in deposit_for (008). This only applies it to a list
-- of prices, so the API needs one request instead of one per distinct price.

create or replace function public.deposits_for(prices numeric[])
returns table (price numeric, deposit numeric)
language sql
immutable
set search_path = ''
as $$
  select distinct u.p, public.deposit_for(u.p)
  from unnest(prices) as u(p)
  where u.p is not null
$$;

revoke execute on function public.deposits_for(numeric[]) from public, anon;
grant execute on function public.deposits_for(numeric[]) to authenticated;
