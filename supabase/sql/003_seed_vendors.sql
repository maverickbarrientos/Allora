-- 003_seed_vendors: PLACEHOLDER vendor data.
-- Assumption: to be replaced once the real service categories are defined.
-- Run after 002_events_vendors_bookings.sql. Safe to re-run: a vendor is
-- only inserted if no vendor with the same name and category exists.

insert into public.vendors (name, category, price, owner)
select v.name, v.category, v.price, null
from (values
  ('Grand Garden Hall',      'venue',       150000),
  ('Seaside Pavilion',       'venue',        95000),
  ('The Loft Events Space',  'venue',        60000),
  ('Savory Table Catering',  'catering',     80000),
  ('Home Kitchen Feasts',    'catering',     35000),
  ('Golden Spoon Banquets',  'catering',    120000),
  ('Lumen Photo Studio',     'photography',  40000),
  ('Candid Frames',          'photography',  18000),
  ('Brass and Strings Band', 'music',        30000),
  ('DJ Nightshift',          'music',        12000),
  ('Petal and Ribbon',       'decoration',   25000),
  ('Simple Blooms',          'decoration',    8000),
  ('Luxe Event Styling',     'decoration',   55000)
) as v(name, category, price)
where not exists (
  select 1 from public.vendors x
  where x.name = v.name and x.category = v.category
);
