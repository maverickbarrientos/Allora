-- 016_vendor_contacts: a vendor's phone, email and website
-- (docs/SPEC-vendor-profiles.md, tickets 14 and 15). Safe to run more than once.
-- Run after 005 (vendor profiles). Separate from vendors on purpose: every
-- signed-in user can read vendors, but contact details are only for the vendor
-- and for customers with a confirmed booking with them.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.vendor_contacts (
  vendor_id  uuid primary key references public.vendors (id) on delete cascade,
  phone      text,
  email      text,
  website    text,
  updated_at timestamptz not null default now()
);

-- The same rules as the API, so nothing else slips in through the client.
-- Website must be http(s), so a stored link can never run code when clicked.
alter table public.vendor_contacts drop constraint if exists vendor_contacts_phone_format;
alter table public.vendor_contacts
  add constraint vendor_contacts_phone_format check (phone is null or phone ~ '^[0-9+(). -]{5,30}$');
alter table public.vendor_contacts drop constraint if exists vendor_contacts_email_format;
alter table public.vendor_contacts
  add constraint vendor_contacts_email_format
  check (email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
alter table public.vendor_contacts drop constraint if exists vendor_contacts_website_format;
alter table public.vendor_contacts
  add constraint vendor_contacts_website_format
  check (website is null or (char_length(website) <= 200 and website ~* '^https?://[^[:space:]]+$'));

alter table public.vendor_contacts enable row level security;
revoke all on public.vendor_contacts from anon;
revoke all on public.vendor_contacts from authenticated;
grant select, insert on public.vendor_contacts to authenticated;
grant update (phone, email, website, updated_at) on public.vendor_contacts to authenticated;
-- No DELETE: clearing every field is enough, and the row goes with the vendor.

-- Read: the vendor's owner.
drop policy if exists "vendor_contacts: owner read" on public.vendor_contacts;
create policy "vendor_contacts: owner read"
  on public.vendor_contacts for select
  to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())));

-- Read: a customer who owns an event with a confirmed booking with this vendor.
-- Runs with the caller's rights, so the bookings and events rules apply too.
drop policy if exists "vendor_contacts: confirmed customer read" on public.vendor_contacts;
create policy "vendor_contacts: confirmed customer read"
  on public.vendor_contacts for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.events e on e.id = b.event_id
      where b.vendor_id = vendor_contacts.vendor_id
        and b.status = 'confirmed'
        and e.owner = (select auth.uid())
    )
  );

-- Insert and update: only the vendor's owner.
drop policy if exists "vendor_contacts: owner insert" on public.vendor_contacts;
create policy "vendor_contacts: owner insert"
  on public.vendor_contacts for insert
  to authenticated
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())));

drop policy if exists "vendor_contacts: owner update" on public.vendor_contacts;
create policy "vendor_contacts: owner update"
  on public.vendor_contacts for update
  to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())))
  with check (exists (select 1 from public.vendors v where v.id = vendor_id and v.owner = (select auth.uid())));
