-- 013_seed_vendors_extra: PLACEHOLDER vendors for the added services
-- (florist, cake, lighting, transport, makeup; docs/SPEC-event-services.md).
-- Run after 003_seed_vendors.sql. Safe to re-run: a vendor is only inserted
-- if no vendor with the same name and category exists. No table or RLS changes.

insert into public.vendors (name, category, price, owner)
select v.name, v.category, v.price, null
from (values
  ('Bloom and Stem',          'florist',    15000),
  ('Wildflower Corner',       'florist',     6000),
  ('Sugar Tier Bakery',       'cake',        9000),
  ('Little Crumb Cakes',      'cake',        3500),
  ('Glow Event Lighting',     'lighting',   20000),
  ('Fairy Lights Co.',        'lighting',    8000),
  ('Classic Car Rentals',     'transport',  12000),
  ('Party Shuttle Vans',      'transport',   5000),
  ('Glam Studio Artists',     'makeup',     10000),
  ('Fresh Face Makeup',       'makeup',      4000)
) as v(name, category, price)
where not exists (
  select 1 from public.vendors x
  where x.name = v.name and x.category = v.category
);
