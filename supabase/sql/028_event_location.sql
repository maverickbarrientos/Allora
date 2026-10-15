-- 028_event_location: an event's location, and vendor locations limited to the
-- same list of areas (docs/SPEC-event-location.md, tickets 16 and 17).
-- Run after 006 (event details) and 015 (vendor location). Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- The area list must match AREAS in src/lib/areas.ts; change both together.

alter table public.events add column if not exists location text;

-- Existing free-text vendor locations, mapped once: an area name in any case
-- becomes that area, a Metro Manila city becomes Metro Manila, anything else
-- is cleared. A second run finds nothing to change.
update public.vendors v
set location = a.area
from (values
  ('Metro Manila'), ('Bulacan'), ('Pampanga'), ('Rizal'), ('Cavite'), ('Laguna'),
  ('Batangas'), ('Benguet'), ('Cebu'), ('Iloilo'), ('Davao')
) as a(area)
where v.location is not null
  and v.location <> a.area
  and lower(regexp_replace(v.location, '\s+', '', 'g')) = lower(replace(a.area, ' ', ''));

update public.vendors
set location = 'Metro Manila'
where location is not null
  and location <> 'Metro Manila'
  and regexp_replace(lower(location), '\s+|city', '', 'g') in (
    'ncr', 'manila', 'quezon', 'qc', 'makati', 'taguig', 'pasig', 'mandaluyong',
    'sanjuan', 'marikina', 'caloocan', 'malabon', 'navotas', 'valenzuela',
    'pasay', 'paranaque', 'parañaque', 'laspinas', 'laspiñas', 'muntinlupa', 'pateros', 'bgc'
  );

update public.vendors
set location = null
where location is not null
  and location not in (
    'Metro Manila', 'Bulacan', 'Pampanga', 'Rizal', 'Cavite', 'Laguna',
    'Batangas', 'Benguet', 'Cebu', 'Iloilo', 'Davao'
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_location_area') then
    alter table public.events
      add constraint events_location_area check (location is null or location in (
        'Metro Manila', 'Bulacan', 'Pampanga', 'Rizal', 'Cavite', 'Laguna',
        'Batangas', 'Benguet', 'Cebu', 'Iloilo', 'Davao'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vendors_location_area') then
    alter table public.vendors
      add constraint vendors_location_area check (location is null or location in (
        'Metro Manila', 'Bulacan', 'Pampanga', 'Rizal', 'Cavite', 'Laguna',
        'Batangas', 'Benguet', 'Cebu', 'Iloilo', 'Davao'
      ));
  end if;
end $$;

-- Column-level: the owner may now also update location. The existing
-- "events: update own" policy still limits rows. vendors.location is already
-- updatable by its owner (015).
grant update (location) on public.events to authenticated;
