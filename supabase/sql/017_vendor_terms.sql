-- 017_vendor_terms: a vendor's own terms (cancellation, deposit, what's
-- included), shown to customers before booking (docs/SPEC-booking-documents.md,
-- ticket 16). Run after 015 (vendor about and location). Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

alter table public.vendors add column if not exists terms text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendors_terms_length') then
    alter table public.vendors
      add constraint vendors_terms_length check (terms is null or char_length(terms) <= 4000);
  end if;
end $$;

-- Column-level: the owner may now also update terms. The existing policy
-- "vendors: vendor update own" (005) still limits updates to the vendor's own
-- record. Reading stays as before: any signed-in user, since customers read the
-- terms before booking.
grant update (terms) on public.vendors to authenticated;
