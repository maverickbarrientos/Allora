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
