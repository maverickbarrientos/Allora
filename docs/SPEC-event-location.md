# SPEC-event-location.md

## Goal
An event has a location, picked from a fixed list of areas. Vendors pick the area they serve from the same list. The customer can then see only the vendors in their event's area, and the "What's missing" cards suggest only those vendors.

## Supersedes
- SPEC-events-booking.md and SPEC-event-upgrades: `Event` gains `location`.
- SPEC-vendor-profiles.md: a vendor's `location` is no longer free text; it is one of the areas. Its out-of-scope "matching or filtering by location" is now in scope as described here.
- SPEC-matching.md: vendors outside the event's area are left out before ranking.

## Out of scope
Maps, addresses, distance or travel fees, a vendor serving more than one area, areas stored in a table or managed in an admin screen, filtering the chatbot's or the dashboard's numbers by area, sending any location to the LLM, placeholder areas for seeded vendors, new dependencies.

## Rules
- **Areas** are a fixed list in `src/lib/areas.ts` (placeholder values, like the matching config): Metro Manila, Bulacan, Pampanga, Rizal, Cavite, Laguna, Batangas, Benguet, Cebu, Iloilo, Davao. The same list is in the SQL check constraints; change both together.
- An event's location and a vendor's location are each one area or `null` (not set). Both are optional. An empty string or `null` clears it. Any other value is refused.
- **A vendor is in an event's area** when the event has no location, or the vendor has no location, or both are the same area. Vendors with no location are never hidden, so nothing disappears for vendors (or seeded data) that haven't picked one.
- Matching is deterministic and done in code. Only the vendor list changes; the ranking rule, the match % and the budget shares are the same as before. The AI never sees any location.
- Existing free-text vendor locations: one that names an area (ignoring case and spaces) becomes that area; a Metro Manila city (for example "Quezon City" or "Makati") becomes Metro Manila; anything else is cleared. This runs once in the migration.

## Data and tables
SQL `028_event_location.sql`, safe to re-run. (Written as 017 and renumbered at merge, after the availability and messages SQL on `main`.)
- `events` gains `location text`, nullable, with a check that it is one of the areas. The column-level UPDATE grant on `events` gains `location`.
- `vendors.location`: existing values are mapped as in Rules, then a check that it is null or one of the areas. The 80-character length check stays.
- No new tables; RLS unchanged.

## Shared shapes
- `Event` = earlier shape plus `location: string | null`.
- `CreateEventInput` and `UpdateEventInput` gain an optional `location?: string | null`.
- `Vendor.location` keeps its shape (`string | null`), now always an area or null.

## API
### POST /api/events, PATCH /api/events/:id (changed)
- Accept an optional `location`: an area, `null` or `""` (clears). Anything else is 400 `validation_error` naming `location`. Left out on PATCH: unchanged. Left out on POST: null.
- Every endpoint returning an `Event` includes `location` (events list, plan, dashboard, create, update).

### GET /api/vendors (changed)
- New optional query `location`. When set, only vendors in that area or with no location are returned. An empty value means no filter. A value that isn't an area is 400 `validation_error`.
- Works with `category` and `eventId` as before.

### GET /api/events/:id/missing (changed)
- Before ranking, vendors outside the event's area (Rules) are left out. With no event location, the output is the same as before.

### POST and PATCH /api/vendor/profile (changed)
- `location` must be an area, `null` or `""`. Anything else is 400 `validation_error` naming `location`.

## UI screens and states
- **Event form** (`/events/new`, `/events/[id]/edit`): a "Location (optional)" select after Date, with "Not set" and the areas. A template leaves it unset, like the date. The edit page sends it only when it changed.
- **Plan** (`/events/[id]`): the header line shows the location after the date when set (`Wedding · 12 June 2027 · Cavite`).
- **Vendor browse** (`/events/[id]/vendors`):
  - Event with a location: a checkbox "Only vendors in {area}", on by default. On, the list is fetched with `location`; a short note says vendors with no area set are included. Off, every vendor shows. The choice stays when switching category tabs.
  - When the filter leaves a category empty: "No vendors in {area} for this category" with a "Show vendors from every area" button that turns the filter off.
  - Event without a location: no checkbox; a line "Add a location to your event to see vendors in your area." linking to the edit page.
- **Vendor profile** (`/vendor/profile`): Location becomes a select ("Not set" and the areas) labelled "Area you serve (optional)".
- Vendor cards and the vendor page show the location as before.
- Works at 375px; keyboard and screen reader labels as on other forms.

## Acceptance criteria
1. A customer can set, change and clear an event's location on create and edit, and it shows on the plan.
2. An unknown location (`"Mars"`, `123`, `"cavite"` in the wrong case; surrounding spaces are trimmed first) is 400 naming `location` on event create and update and on the vendor profile, and nothing is saved.
3. A vendor can pick, change and clear their area; free text is refused.
4. `GET /api/vendors?location=Cavite` returns exactly the Cavite vendors and the vendors with no location; an empty `location` returns everyone; `location=Mars` is 400.
5. On the browse page of an event in Cavite, the filter is on by default and hides vendors in other areas; turning it off shows them; it stays across tabs.
6. The "What's missing" cards of an event in Cavite never list a vendor from another area. With no event location the cards are identical to before.
7. A direct Supabase update setting an event's or vendor's location to a value outside the list is refused by the database.
8. The LLM input contains no location.
9. Auth unchanged: 401 logged out, 403 for the wrong role, 404 for someone else's event. No `service_role` key, no new dependency.
