## Goal
Vendors block the dates they are unavailable on a calendar. Customers see a vendor's availability in a calendar when booking. Booking uses the event's date.

## Supersedes
- SPEC-events-booking.md: POST /api/bookings gains 409 `vendor_unavailable`. GET /api/vendors gains an optional `eventId` and field.
- SPEC-vendor-upgrades.md: PATCH /api/vendor/bookings/:id gains 409 `date_unavailable` when setting confirmed.
- SPEC-event-upgrades.md (only if merged): PATCH /api/events/:id gains 409 `date_has_confirmed_bookings`.

## Out of scope
Time slots, more than one booking per day, recurring unavailability, the customer picking a date, multi-day events, notifications, hiding or re-ranking unavailable vendors in "What's missing" cards, calendar export, new dependencies.

## Rules
- Dates are plain "YYYY-MM-DD" strings. No timezone conversion anywhere (database date columns, string comparison, the UI builds dates from year, month and day).
- A vendor is unavailable on a date if they blocked it, or they have a confirmed booking whose event is on that date. Pending and declined bookings never block. At most one confirmed booking per vendor per date.
- The rule lives in `vendor_is_available`. Triggers and endpoints use it, nothing recomputes it.
- Customers see only dates. Never reasons, customer names or other bookings.
- Ranges: `from` and `to` valid dates, from <= to, at most 400 days apart.
- Block and unblock: 1 to 62 unique dates, all or nothing. Blocking an already blocked date and unblocking an open date are ignored. Assumption: past dates can be blocked.

## Data and tables
- `vendor_blocked_dates`: vendor_id (references vendors, on delete cascade), date (date, not null), created_at, primary key (vendor_id, date).
- `vendor_is_available(p_vendor_id uuid, p_date date, p_except_booking uuid default null) returns boolean`: security definer, empty search_path.
- `vendor_unavailable_dates(p_vendor_id uuid, p_from date, p_to date) returns setof date`: blocked dates plus event dates of the vendor's confirmed bookings in the range. Security definer, empty search_path. Both functions: execute revoked from public and anon, granted to authenticated.
- Triggers (security definer, empty search_path). Each first locks the vendor's row (`select ... for update`), so checks and writes for one vendor run one at a time:
  1. Before insert on `bookings`: if the vendor is not available on the event's date, raise `vendor_unavailable`.
  2. Before update of `status` on `bookings`: when the new status is confirmed and the old one is not: lock the event row, then if the vendor is not available on the event's date (excluding this booking), raise `date_unavailable`.
  3. Before insert on `vendor_blocked_dates`: if the vendor has a confirmed booking on that date, raise `date_has_confirmed_booking`.
  4. Before update of `date` on `events`, when the date changes: if the event has any confirmed booking, raise `date_has_confirmed_bookings`.
- The raised messages are exactly those codes, and handlers map them to the errors below.
- Next free number in `supabase/sql/`. Safe to rerun. Never edit earlier files.

## RLS
- `vendor_blocked_dates`: enable RLS. SELECT, INSERT and DELETE where the vendor is owned by `auth.uid()`. INSERT also requires the caller's role to be vendor. No UPDATE. No customer access.

## Shared shapes
- `Date` = "YYYY-MM-DD"
- `Vendor` (browse) gains `availableOnEventDate?: boolean`, present only when `eventId` is given.
- `VendorCalendar` = `{ from, to, blocked: Date[], bookings: [{ bookingId, date, status: "pending" | "confirmed", eventType, customerName }] }` (declined bookings are not included)
- `VendorAvailability` = `{ vendorId, from, to, unavailable: Date[] }`
- Error body, 401 and 403 as in earlier specs.

## API
All routes require a session. Logged-out requests return 401 `unauthorized`.

### GET /api/vendors?category=&eventId= (changed)
- With `eventId`, every vendor gets `availableOnEventDate`, computed for all vendors in one query. 404 `event_not_found` if the event is missing, not the caller's or malformed. Without it, unchanged.

### GET /api/vendors/:id/availability?from=&to=
- 200: `VendorAvailability`. Customer-role only.
- 400 `validation_error`: missing or invalid dates, from after to, range over 400 days
- 403 `forbidden` (vendor-role), 404 `vendor_not_found` (missing or malformed id), 500 `server_error`

### GET /api/vendor/availability?from=&to=
- 200: `VendorCalendar`. Vendor-role only.
- 400 `validation_error` (as above), 403 `forbidden`, 404 `vendor_not_linked`, 500

### POST /api/vendor/availability/block and POST /api/vendor/availability/unblock
- Body: `{ dates: Date[] }`
- 200: `{ changed: Date[] }` (the dates actually blocked or unblocked)
- 400 `validation_error`: dates missing, not an array, empty, over 62, duplicates, invalid dates, wrong types
- 403 `forbidden`, 404 `vendor_not_linked`
- 409 `date_has_confirmed_booking` (block only): the message lists the dates. Nothing changes.
- 500 `server_error`

### POST /api/bookings (changed)
- Adds 409 `vendor_unavailable`: the vendor is not available on the event's date. Nothing is created. `already_booked` takes priority.

### PATCH /api/vendor/bookings/:id (changed)
- Adds 409 `date_unavailable` when setting confirmed and the date is taken. Order of checks: `status_unchanged`, `conflicting_booking`, `date_unavailable`. Declining is never blocked.

### PATCH /api/events/:id (only if it exists)
- Adds 409 `date_has_confirmed_bookings` when the date changes and the event has a confirmed booking.

## UI screens and states
- Sidebar (see DESIGN.md): all signed-in pages, both roles.
- `/vendor/calendar`:
  - Loading, error with retry.
  - A month grid with previous, next and Today. Weeks start on Sunday.
  - Days show text-labeled states (Blocked, Confirmed, Pending), with a pattern or icon, not only color. A legend below.
  - Click or Space toggles a day's selection. "Block selected" and "Unblock selected" with the count. Days with a confirmed booking can't be selected for blocking.
  - A day with bookings opens a side panel listing customer name, event type and status.
  - Saving state. `date_has_confirmed_booking` and other errors show a message and keep the selection. Success clears the selection and refreshes.
  - Redirects: customer-role to `/`, unlinked vendor to `/vendor/profile`.
- `/events/[id]/vendors`:
  - Each vendor card shows "Available on {date}" or "Unavailable on {date}" in text. If unavailable, the Book button is disabled with a short explanation.
  - "View calendar" opens a dialog with a read-only month grid: unavailable days marked in text and pattern, the event's date highlighted, month navigation, and a Book button that follows the same rule.
  - `vendor_unavailable` on booking shows a message and refreshes availability. Booking from a "What's missing" card shows the same message on the card.
- Dates display as written, never converted. Plain text only.

## Acceptance criteria
1. A vendor blocks and unblocks dates, they persist across reloads, and a batch applies all or nothing.
2. The vendor calendar distinguishes blocked, confirmed and pending, and doesn't show declined bookings.
3. Blocking a date with a confirmed booking returns 409 `date_has_confirmed_booking` and changes nothing, including through a direct client insert.
4. A customer's vendor cards show availability on the event's date. The calendar dialog shows only unavailable dates and highlights the event's date, with no reasons or other customers' details.
5. Booking on a blocked date, or one with another confirmed booking, returns 409 `vendor_unavailable` and creates nothing (also through a direct client insert). Pending bookings on the same date don't block.
6. Two customers can both hold pending bookings for the same vendor and date. After the vendor confirms one, confirming the other returns 409 `date_unavailable`, and declining it works. The date now shows as unavailable to customers.
7. Two simultaneous confirms for the same vendor and date: exactly one succeeds. A confirm and a block for the same date at the same time: one wins, never a confirmed booking on a blocked date.
8. Flipping a declined booking to confirmed rechecks availability.
9. If event upgrades are merged: changing an event's date with a confirmed booking returns 409 `date_has_confirmed_bookings`. A date change and a confirm at the same time never leave a confirmed booking on a date different from its event's.
10. RLS: vendor B cannot read or write vendor A's blocked dates. Customers have no direct access. Vendors cannot read events. Availability responses contain only dates.
11. Customer-role gets 403 on vendor endpoints, vendor-role gets 403 on the customer availability endpoint, and logged-out gets 401.
12. Dates never shift by a day in any timezone.
13. No `service_role` key in the repo and no new dependency.

