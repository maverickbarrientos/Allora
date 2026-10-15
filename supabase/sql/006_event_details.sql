-- 006_event_details: event name and notes, and a column-level UPDATE grant.
-- Safe to run more than once. Run after 002 (events table).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

alter table public.events add column if not exists name text;
alter table public.events add column if not exists notes text;

-- Backfill existing events first ("<Type> on <date>", e.g. "Wedding on 2027-05-10").
-- A second run finds nothing to change.
update public.events
set name = initcap(type) || ' on ' || date::text
where name is null or btrim(name) = '';

alter table public.events alter column name set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_name_length') then
    alter table public.events
      add constraint events_name_length check (char_length(btrim(name)) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_notes_length') then
    alter table public.events
      add constraint events_notes_length check (notes is null or char_length(notes) <= 1000);
  end if;
end
$$;

-- The only columns anyone may update on events. owner, id and created_at are not
-- updatable through the client. The "events: update own" policy still limits rows.
revoke update on public.events from anon, authenticated;
grant update (name, type, date, budget, guest_count, notes) on public.events to authenticated;
