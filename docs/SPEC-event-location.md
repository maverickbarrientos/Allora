# SPEC-event-location.md

## Goal
An event has an area, and vendors say which area they serve. The customer can then see only the vendors in their event's area, and the "What's missing" cards suggest only those vendors.

## Supersedes
- SPEC-events-booking.md and SPEC-event-upgrades: `Event` gains `area`.
- SPEC-vendor-profiles.md: a vendor gains `area` next to `location`. `location` (free text, up to 80 characters, shown on vendor cards and the vendor page) is unchanged. Its out-of-scope "matching or filtering by location" is now in scope, through `area`.
- SPEC-matching.md: vendors outside the event's area are left out before ranking.

## Out of scope
Maps, addresses, distance or travel fees, a vendor serving more than one area, a fixed list of areas, matching "Makati" to "Metro Manila" (areas are compared as text), filtering the chatbot's or the dashboard's numbers by area, sending any area to the LLM, placeholder areas for seeded vendors, new dependencies.

## Rules
- `area` is free text, 1 to 60 characters after trimming, on both events and vendors. Both are optional. An empty string or `null` clears it.
- Two areas are the same when they are equal ignoring upper and lower case, accents and extra spaces ("Parañaque" = "paranaque").
- **A vendor is in an event's area** when the event has no area, or the vendor has no area, or both are the same area. Vendors with no area are never hidden, so nothing disappears for vendors (or seeded data) that haven't set one.
- Matching is deterministic and done in code. Only the vendor list changes; the ranking rule, the match % and the budget shares are the same as before. The AI never sees any area.
- `vendors.location` is not used for matching.

## Data and tables
SQL `028_event_area.sql`, safe to re-run. (Numbered after the availability and messages SQL on `main`.)
- `events.area` and `vendors.area`: nullable text with a check of 1 to 60 characters. The live project already had both columns; the file adds them only when missing and keeps their data.
- The column-level UPDATE grant on `events` and `vendors` includes `area`; existing owner-only policies still apply.
- The file also removes this feature's first draft, which used a fixed list in `events.location`: that column and its two check constraints are dropped (nothing was stored in them).
- No new tables; RLS unchanged.

## Shared shapes
- `Event` = earlier shape plus `area: string | null`.
- `CreateEventInput` and `UpdateEventInput` gain an optional `area?: string | null`.
- `Vendor` gains `area: string | null`; `location` keeps its shape.
- `VendorProfileInput` gains an optional `area`.

## API
### POST /api/events, PATCH /api/events/:id (changed)
- Accept an optional `area`: text up to 60 characters, `null` or `""` (clears). A longer value or a non-string is 400 `validation_error` naming `area`. Left out on PATCH: unchanged. Left out on POST: null.
- Every endpoint returning an `Event` includes `area` (events list, plan, dashboard, create, update).

### GET /api/vendors (changed)
- New optional query `area`. When set, only vendors in that area or with no area are returned (same-area rule above). An empty value means no filter. A value over 60 characters is 400 `validation_error`.
- Works with `category` and `eventId` as before. Each vendor includes `area`.

### GET /api/events/:id/missing (changed)
- Before ranking, vendors outside the event's area are left out. With no event area, the output is the same as before.

### POST and PATCH /api/vendor/profile (changed), GET /api/vendors/:id
- Accept `area` with the same rule as events. Responses include it. `location` is validated as before.

## UI screens and states
- **Event form** (`/events/new`, `/events/[id]/edit`): an "Area (optional)" text field after Date, up to 60 characters, with the hint "Used to show vendors that serve your area." A template leaves it empty, like the date. The edit page sends it only when it changed.
- **Plan** (`/events/[id]`): the header line shows the area after the date when set (`Wedding · June 12, 2030 · Cavite`).
- **Vendor browse** (`/events/[id]/vendors`):
  - Event with an area: a checkbox "Only vendors in {area}", on by default. On, the list is fetched with `area`; a short note says vendors with no area set are included. Off, every vendor shows. The choice stays when switching category tabs.
  - When the filter leaves a category empty: "No vendors in {area} for this category" with a "Show vendors from every area" button that turns the filter off.
  - Event without an area: no checkbox; a line "Add an area to your event to see vendors in your area." linking to the edit page.
- **Vendor profile** (`/vendor/profile`): below Location, an "Area you serve (optional)" text field, up to 60 characters, with a hint that customers in that area see the vendor first.
- Works at 375px; keyboard and screen reader labels as on other forms.

## Acceptance criteria
1. A customer can set, change and clear an event's area on create and edit, and it shows on the plan.
2. An area over 60 characters, or a non-text value, is 400 naming `area` on event create and update and on the vendor profile, and nothing is saved. Surrounding spaces are trimmed.
3. A vendor can set, change and clear their area; `location` still works as before.
4. `GET /api/vendors?area=Cavite` returns exactly the vendors whose area is Cavite (any case or accents) and the vendors with no area; an empty `area` returns everyone; an area over 60 characters is 400.
5. On the browse page of an event in Cavite, the filter is on by default and hides vendors in other areas; turning it off shows them; it stays across tabs.
6. The "What's missing" cards of an event in Cavite never list a vendor from another area. With no event area the cards are identical to before.
7. A direct Supabase update setting an event's or vendor's area to 61 characters is refused by the database. Existing `area` values are not changed by the migration.
8. The LLM input contains no area.
9. Auth unchanged: 401 logged out, 403 for the wrong role, 404 for someone else's event. No `service_role` key, no new dependency.
