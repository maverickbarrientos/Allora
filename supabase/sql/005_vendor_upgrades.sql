-- 005_vendor_upgrades: vendor profiles, changing a decision, customer details.
-- Run AFTER 001 to 004. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- A. Vendor profile ---------------------------------------------------

-- INSERT: a vendor-role user creates their own vendor record. The unique
-- index vendors_owner_unique (004) keeps it to one per user.
drop policy if exists "vendors: vendor insert own" on public.vendors;
create policy "vendors: vendor insert own"
  on public.vendors for insert
  to authenticated
  with check (
    owner = (select auth.uid())
    and (select public.current_user_role()) = 'vendor'
  );

-- UPDATE: own record only, and owner can't be handed to someone else.
drop policy if exists "vendors: vendor update own" on public.vendors;
create policy "vendors: vendor update own"
  on public.vendors for update
  to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

-- Column-level: only name, category and price are updatable. No DELETE policy.
revoke update on public.vendors from anon, authenticated;
grant update (name, category, price) on public.vendors to authenticated;

-- Category can't change while the vendor has a pending or confirmed booking.
-- The API maps this error to 409 category_locked.
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

drop trigger if exists vendors_category_lock on public.vendors;
create trigger vendors_category_lock
  before update of category on public.vendors
  for each row execute function public.vendors_category_lock();

-- B. Change a decision ------------------------------------------------

-- Replaces the feature 3 policy "bookings: vendor decides pending": a vendor
-- may update any of their own bookings (any current status), but only to
-- confirmed or declined, never back to pending. The partial unique index
-- bookings_event_vendor_active_uniq (002) still blocks a second active booking.
drop policy if exists "bookings: vendor decides pending" on public.bookings;
drop policy if exists "bookings: vendor decides" on public.bookings;
create policy "bookings: vendor decides"
  on public.bookings for update
  to authenticated
  using (
    vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  )
  with check (
    status in ('confirmed', 'declined')
    and vendor_id in (select v.id from public.vendors v where v.owner = (select auth.uid()))
  );

-- Column-level, as in 004: status is the only updatable column on bookings.
revoke update on public.bookings from anon, authenticated;
grant update (status) on public.bookings to authenticated;

-- C. Customer details -------------------------------------------------

-- Replaces the feature 3 function (drop and recreate: the return columns
-- change). Adds the customer's name (profiles.name via events.owner) and the
-- event's budget. Never returns email, profile ids, owner or budget shares.
-- Vendors still never read events or profiles directly.
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
  customer_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.category, b.status, b.created_at,
         e.type, e.date, e.guest_count, e.budget, coalesce(p.name, '')
  from public.bookings b
  join public.vendors v on v.id = b.vendor_id
  join public.events e on e.id = b.event_id
  left join public.profiles p on p.id = e.owner
  where v.owner = (select auth.uid())
$$;

revoke execute on function public.vendor_incoming_bookings() from public, anon;
grant execute on function public.vendor_incoming_bookings() to authenticated;
