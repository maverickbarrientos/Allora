-- 015_vendor_about_location: a vendor's "about" text and location
-- (docs/SPEC-vendor-profiles.md, ticket 12). Run after 005 (vendor profiles).
-- Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

alter table public.vendors add column if not exists about text;
alter table public.vendors add column if not exists location text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendors_about_length') then
    alter table public.vendors
      add constraint vendors_about_length check (about is null or char_length(about) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vendors_location_length') then
    alter table public.vendors
      add constraint vendors_location_length check (location is null or char_length(location) <= 80);
  end if;
end $$;

-- Column-level: the owner may now also update about and location. The
-- existing policy "vendors: vendor update own" (005) still limits updates to
-- the vendor's own record. Reading stays as before: any signed-in user.
grant update (about, location) on public.vendors to authenticated;
