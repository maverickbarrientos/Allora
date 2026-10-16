-- 031_seed_panay_vendors: real service providers in Panay Island (Iloilo City, Roxas City, Boracay).
-- Replaces the placeholder seed vendors of 003 and 013. Found by web search on 2026-10-16.
-- Names, places and categories come from public listings; PRICES ARE ESTIMATES (almost no
-- source published a price) and each vendor's about text says so. Check every vendor before
-- relying on it. Run after 028. Safe to re-run: a vendor is only inserted if no vendor with
-- the same name and category exists. Does not delete anything.

insert into public.vendors (name, category, price, area, about, owner)
select v.name, v.category, v.price, v.area, v.about || ' Price is an estimate; ask the vendor for a quote.', null
from (values
  -- Venues, Iloilo City
  ('Iloilo Convention Center',        'venue',       150000, 'Iloilo City', 'Convention venue in Mandurriao: a main hall for 3,700, 500-seat function rooms and a rooftop.'),
  ('Courtyard by Marriott Iloilo',    'venue',       120000, 'Iloilo City', 'Hotel ballrooms in Iloilo Business Park; the largest holds about 220 guests.'),
  ('Park Inn by Radisson Iloilo',     'venue',       100000, 'Iloilo City', 'Hotel function room that can be split into three or opened up for up to 360 guests.'),
  ('Richmonde Hotel Iloilo',          'venue',       110000, 'Iloilo City', 'Hotel with banquet rooms and a pre-wedding photo package.'),
  ('Circle Inn Iloilo',               'venue',        80000, 'Iloilo City', 'Hotel with a grand ballroom of about 400 square metres; function space seats about 300.'),
  ('Waterfront Garden Iloilo',        'venue',        60000, 'Iloilo City', 'Garden and event space on General Luna Street for up to 120 to 150 guests.'),
  ('The Venue Iloilo',                'venue',        50000, 'Iloilo City', 'Event venue in The Avenue Complex, Mandurriao, for up to 200 guests.'),
  ('Seda Atria Iloilo',               'venue',       120000, 'Iloilo City', 'Hotel with wedding and event facilities.'),
  ('Hotel del Rio',                   'venue',        70000, 'Iloilo City', 'Riverside hotel with wedding and event facilities.'),
  ('Jardin de Miramar',               'venue',        90000, 'Iloilo City', 'Garden venue in Mandurriao for up to about 500 guests.'),
  ('Casa Mariquit',                   'venue',        70000, 'Iloilo City', 'Heritage house for events of up to about 200 guests.'),
  ('Royal Garden Hall',               'venue',        60000, 'Iloilo City', 'Function hall offering wedding and event menus.'),
  -- Catering
  ('Royal Garden Hall',               'catering',     40000, 'Iloilo City', 'Sit-down menu of about 400 per head: appetizer or soup, two mains, two sides, dessert and a soft drink. The price shown is for about 100 guests.'),
  -- Venues, Roxas City (Capiz)
  ('El Circulo Convention Center',    'venue',        70000, 'Roxas City',  'Convention and wedding venue at Pueblo de Panay, Lawaan, with sound and audio-visual equipment.'),
  ('San Antonio Resort',              'venue',        60000, 'Roxas City',  'Resort in Baybay used for wedding receptions.'),
  ('Espacio Verde Resort',            'venue',        50000, 'Roxas City',  'Resort in Dayao with several event areas and wedding packages. Phone listed: +63 36 620 3734.'),
  -- Venues, Boracay (Aklan)
  ('Astoria Boracay',                 'venue',       250000, 'Boracay',     'Beachfront resort in Balabag with in-house catering and an outdoor reception space.'),
  ('Crown Regency Courtyard Resort',  'venue',       300000, 'Boracay',     'Resort in Balabag with in-house catering, gardens and an outdoor reception space.'),
  ('Shangri-La Boracay',              'venue',       600000, 'Boracay',     'Beach resort with a private beach for ceremonies, wedding planners and bespoke menus.'),
  -- Photography
  ('Love Train Studios',              'photography',  45000, 'Iloilo City', 'Wedding, prenup and family photography; many weddings in Boracay.'),
  ('RR Production',                   'photography',  35000, 'Iloilo City', 'Wedding and prenup photo and video, at Young Arcade Building, Mandurriao.'),
  ('Imahe Collective Studios',        'photography',  40000, 'Iloilo City', 'Wedding photography studio.'),
  ('Amular Creative Photography',     'photography',  30000, 'Iloilo City', 'Photography studio in Mandurriao.'),
  ('Creative Box',                    'photography',  28000, 'Iloilo City', 'Photography studio in Iloilo City.'),
  ('Wedding Dream Studios',           'photography',  35000, 'Iloilo City', 'Creative wedding photography by Dhan Barredo.'),
  ('Donnie Magbanua Photography',     'photography',  60000, 'Boracay',     'Boracay-based wedding photographer.'),
  ('Enrico Nepomuceno Photography',   'photography',  60000, 'Boracay',     'Boracay-based wedding photographer.'),
  -- Decoration (stylists and coordinators)
  ('Faybe Weddings and Events',       'decoration',   60000, 'Iloilo City', 'Wedding planning, coordination and styling.'),
  ('The Wedding Concierge Iloilo',    'decoration',   55000, 'Iloilo City', 'Wedding coordination and styling.'),
  ('Not Just A Box Events',           'decoration',   40000, 'Iloilo City', 'Event coordination and styling.'),
  ('Tukod Events Styling and Coordination', 'decoration', 45000, 'Iloilo City', 'Event styling and coordination.'),
  ('Kristrav Events and Wedding Concepts', 'decoration',  35000, 'Iloilo City', 'Event and wedding styling.'),
  ('Wedding Solutions Roxas',         'decoration',   30000, 'Roxas City',  'Event planner in Roxas City.'),
  -- Florist
  ('ABANGAN''s Flower Shoppe',        'florist',       8000, 'Iloilo City', 'Flower shop in Iloilo City listed in the Kasal.com wedding directory.'),
  -- Makeup
  ('Makeup Studio Boracay',           'makeup',       12000, 'Boracay',     'Makeup artists for weddings in Boracay.')
) as v (name, category, price, area, about)
where not exists (
  select 1 from public.vendors x where x.name = v.name and x.category = v.category
);
