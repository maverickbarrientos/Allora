-- 014_blocked_dates: vendors block dates they are unavailable on (docs/SPEC-availability.md, ticket 08).
-- Safe to run more than once. Run after 005 (vendor policies) and 009 (availability).
-- Needs public.current_user_role() from 001.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.vendor_blocked_dates (
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  primary key (vendor_id, date)
);

alter table public.vendor_blocked_dates enable row level security;
revoke all on public.vendor_blocked_dates from anon;
-- No UPDATE: a blocked date is added or removed, never changed.
revoke update on public.vendor_blocked_dates from authenticated;

-- The owning vendor only. Customers and other vendors see nothing.
drop policy if exists "vendor_blocked_dates: read own" on public.vendor_blocked_dates;
create policy "vendor_blocked_dates: read own"
  on public.vendor_blocked_dates for select
  to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())));

drop policy if exists "vendor_blocked_dates: insert own" on public.vendor_blocked_dates;
create policy "vendor_blocked_dates: insert own"
  on public.vendor_blocked_dates for insert
  to authenticated
  with check (
    (select public.current_user_role()) = 'vendor'
    and exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid()))
  );

drop policy if exists "vendor_blocked_dates: delete own" on public.vendor_blocked_dates;
create policy "vendor_blocked_dates: delete own"
  on public.vendor_blocked_dates for delete
  to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())));

-- Trigger 3 (spec): a date with a confirmed booking can't be blocked. Locks the
-- vendor row first, so blocking and confirming for one vendor run one at a time.
-- Security definer: vendors can't read events, but the check needs event dates.
create or replace function public.check_blocked_date_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

-- Only the trigger calls it.
revoke execute on function public.check_blocked_date_free() from public, anon, authenticated;

drop trigger if exists vendor_blocked_dates_check_free on public.vendor_blocked_dates;
create trigger vendor_blocked_dates_check_free
  before insert on public.vendor_blocked_dates
  for each row execute function public.check_blocked_date_free();

-- Block a batch of dates for the caller's own vendor, all or nothing (spec:
-- 1 to 62 unique dates; already blocked dates are ignored). Checks every date
-- first, so the error lists all the dates that have a confirmed booking.
-- Returns the dates that were actually added.
-- Security definer (it reads event dates); it only ever acts on the vendor
-- owned by auth.uid(), and only for vendor-role callers.
create or replace function public.block_vendor_dates(p_dates date[])
returns setof date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendor uuid;
  v_conflicts text;
begin
  if (select public.current_user_role()) is distinct from 'vendor' then
    raise exception 'forbidden';
  end if;
  select v.id into v_vendor from public.vendors v where v.owner = (select auth.uid());
  if v_vendor is null then
    raise exception 'vendor_not_linked';
  end if;
  if p_dates is null
    or cardinality(p_dates) not between 1 and 62
    or array_position(p_dates, null) is not null
    or (select count(distinct d) from unnest(p_dates) as d) <> cardinality(p_dates)
  then
    raise exception 'invalid_dates';
  end if;

  perform 1 from public.vendors v where v.id = v_vendor for update;

  select string_agg(distinct e.date::text, ', ' order by e.date::text) into v_conflicts
  from public.bookings b
  join public.events e on e.id = b.event_id
  where b.vendor_id = v_vendor and b.status = 'confirmed' and e.date = any (p_dates);
  if v_conflicts is not null then
    raise exception 'date_has_confirmed_booking' using errcode = 'P0001', detail = v_conflicts;
  end if;

  return query
    insert into public.vendor_blocked_dates (vendor_id, date)
    select v_vendor, d from unnest(p_dates) as d
    on conflict (vendor_id, date) do nothing
    returning vendor_blocked_dates.date;
end;
$$;

revoke execute on function public.block_vendor_dates(date[]) from public, anon;
grant execute on function public.block_vendor_dates(date[]) to authenticated;
