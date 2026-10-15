-- 028_event_area: an event's area and a vendor's area, used to filter vendors
-- (docs/SPEC-event-location.md, tickets 24 to 27). Run after 015 (vendor location).
-- Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- `area` is free text of 1 to 60 characters on both tables. The live project
-- already had these two columns; the first draft of this feature added a fixed
-- list in `events.location` instead. This file keeps `area` and removes that draft
-- (events.location was never filled; vendors.location is the free-text profile
-- location from 015 and stays as it is).

alter table public.events add column if not exists area text;
alter table public.vendors add column if not exists area text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_area_length') then
    alter table public.events
      add constraint events_area_length check (area is null or (char_length(area) between 1 and 60));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vendors_area_length') then
    alter table public.vendors
      add constraint vendors_area_length check (area is null or (char_length(area) between 1 and 60));
  end if;
end $$;

-- The draft's fixed-list checks and its events.location column.
alter table public.vendors drop constraint if exists vendors_location_area;
alter table public.events drop constraint if exists events_location_area;
alter table public.events drop column if exists location;

-- Column-level: the owner may update area. The existing owner-only policies still apply.
grant update (area) on public.events to authenticated;
grant update (area) on public.vendors to authenticated;
