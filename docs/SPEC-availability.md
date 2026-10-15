# SPEC-availability.md

## Goal
Vendors block the dates they are unavailable on a calendar. Customers see a vendor's availability in a calendar when booking. Booking uses the event's date, and a vendor can only be booked, or confirm a booking, on a date they are available.

## Supersedes
- SPEC-events-booking.md: POST /api/bookings gains 409 `vendor_unavailable`. GET /api/vendors gains an optional `eventId` and field.
- SPEC-vendor-upgrades.md: PATCH /api/vendor/bookings/:id gains 409 `date_unavailable` when setting confirmed.
- SPEC-event-upgrades.md: PATCH /api/events/:id gains 409 `date_has_confirmed_bookings`.

## Already built (009, on `main`)
Not rebuilt. The work below extends it.
- `vendor_unavailable_dates(vendor, from, to)` and `vendors_unavailable_on(date)`: today they count confirmed bookings only.
- `GET /api/vendors/:id/availability` (customer) and `GET /api/vendor/availability` (vendor; `blocked` is always `[]` today).
- `availableOnEventDate` on `GET /api/vendors?eventId=`, for all vendors in one query.
- The "View calendar" dialog on vendor cards and "What's missing" cards. It already disables "Confirm booking" on an unavailable date and handles `vendor_unavailable`.
- The read-only `/vendor/calendar` (bookings by day, side panel) and the dashboard's "Month at a glance" (falls back without blocked days).

## To build
1. `vendor_blocked_dates` table and RLS.
2. `vendor_is_available`, and both read functions above also counting blocked dates.
3. The four triggers (see Data).
4. `POST /api/vendor/availability/block` and `/unblock`. `GET /api/vendor/availability` returns the real blocked dates.
5. 409 mappings in `POST /api/bookings`, `PATCH /api/vendor/bookings/:id` and `PATCH /api/events/:id`.
6. Blocking and unblocking on `/vendor/calendar`.
7. Book disabled on unavailable vendor cards, with the reason in text.
8. The messages on `/vendor/bookings` and `/events/[id]/edit` (see UI).

## Out of scope
Time slots, more than one booking per day, recurring unavailability, the customer picking a date, multi-day events, notifications, hiding or re-ranking unavailable vendors in "What's missing" cards, calendar export, cleaning up existing conflicts, new dependencies.

## Rules
- Dates are plain "YYYY-MM-DD" strings. No timezone conversion anywhere: database date columns, string comparison, and the UI builds dates from year, month and day.
- A vendor is unavailable on a date if they blocked it, or if they have a confirmed booking whose event is on that date. Pending and declined bookings never block. At most one confirmed booking per vendor per date, for new writes.
- The rule lives in `vendor_is_available`. Triggers and endpoints use it, and nothing recomputes it.
- Customers see only dates, never reasons, customer names or other bookings.
- Ranges: `from` and `to` are valid dates, from <= to, at most 400 days apart.
- Block and unblock: 1 to 62 unique dates, all or nothing. Blocking an already blocked date and unblocking an open date are ignored. Assumption: past dates can be blocked.
- Existing conflicts (two or more confirmed bookings for one vendor on one date, 14 such dates on 2026-10-16) are left as they are. They show as unavailable, and the triggers stop new ones.

## Data and tables
- `vendor_blocked_dates`:
  - `vendor_id` (references vendors, on delete cascade)
  - `date` (date, not null)
  - `created_at`
  - primary key (vendor_id, date)
- `vendor_is_available(p_vendor_id uuid, p_date date, p_except_booking uuid default null) returns boolean`: security definer, empty search_path.
- `vendor_unavailable_dates(p_vendor_id, p_from, p_to)` and `vendors_unavailable_on(p_date)` are replaced to include blocked dates. Signatures stay the same, so the routes don't change.
- All three functions: execute revoked from public and anon, granted to authenticated.
- Triggers (security definer, empty search_path). Each first locks the vendor's row (`select ... for update`), so checks and writes for one vendor run one at a time:
  1. Before insert on `bookings`: if the vendor is not available on the event's date, raise `vendor_unavailable`.
  2. Before update of `status` on `bookings`, when the new status is confirmed and the old one is not: lock the event row. Then, if the vendor is not available on the event's date (excluding this booking), raise `date_unavailable`.
  3. Before insert on `vendor_blocked_dates`: if the vendor has a confirmed booking on that date, raise `date_has_confirmed_booking`.
  4. Before update of `date` on `events`, when the date changes: lock the event's confirmed bookings' vendors. If the event has any confirmed booking, raise `date_has_confirmed_bookings`.
- `block_vendor_dates(p_dates date[]) returns setof date` (014, ticket 08): blocks a batch for the caller's own vendor, all or nothing. It checks every date first, so the 409 names all the dates with a confirmed booking; trigger 3 stays as the backstop for direct inserts. Security definer, vendor-role callers only.
- The raised messages are exactly those codes, and handlers map them to the errors below.
- SQL starts at **014** (`main` has 001 to 013), one file per ticket if that keeps slices separate. Safe to rerun. Never edit earlier files.

## RLS
- `vendor_blocked_dates`:
  - Enable RLS.
  - SELECT, INSERT and DELETE where the vendor is owned by `auth.uid()`. INSERT also requires the caller's role to be vendor.
  - No UPDATE, and no customer access.

## Shared shapes
- `Date` = "YYYY-MM-DD"
- `Vendor` (browse) gains `availableOnEventDate?: boolean`, present only when `eventId` is given. Already built.
- `VendorCalendar` = `{ from, to, blocked: Date[], bookings: [{ bookingId, date, status: "pending" | "confirmed", eventType, customerName }] }`. Declined bookings are not included.
- `VendorAvailability` = `{ vendorId, from, to, unavailable: Date[] }`
- Error body, 401 and 403 as in earlier specs.

## API
All routes require a session. Logged-out requests return 401 `unauthorized`.

### GET /api/vendors?category=&eventId= (built; result changes)
- `availableOnEventDate` now also reflects blocked dates. Nothing else changes.

### GET /api/vendors/:id/availability?from=&to= (built; result changes)
- `unavailable` now includes blocked dates. Customer-role only.
- 200: `VendorAvailability`.
- 400 `validation_error`, 403 `forbidden` (vendor-role), 404 `vendor_not_found`, 500 `server_error`.

### GET /api/vendor/availability?from=&to= (built; `blocked` becomes real)
- 200: `VendorCalendar`. Vendor-role only.
- 400 `validation_error`, 403 `forbidden`, 404 `vendor_not_linked`, 500.

### POST /api/vendor/availability/block and POST /api/vendor/availability/unblock (new)
- Body: `{ dates: Date[] }`
- 200: `{ changed: Date[] }` (the dates actually blocked or unblocked)
- 400 `validation_error`: dates missing, not an array, empty, over 62, duplicates, invalid dates or wrong types
- 403 `forbidden`, 404 `vendor_not_linked`
- 409 `date_has_confirmed_booking` (block only): the message lists the dates. Nothing changes.
- 500 `server_error`

### POST /api/bookings (changed)
- Adds 409 `vendor_unavailable` when the vendor is not available on the event's date. Nothing is created. `already_booked` takes priority.

### PATCH /api/vendor/bookings/:id (changed)
- Adds 409 `date_unavailable` when setting confirmed and the date is taken.
- Order of checks: `status_unchanged`, `conflicting_booking`, `date_unavailable`. Declining is never blocked.

### PATCH /api/events/:id (changed)
- Adds 409 `date_has_confirmed_bookings` when the date changes and the event has a confirmed booking. Other fields in the same request are not saved either.

## UI screens and states
- `/vendor/calendar`:
  - Loading, and error with retry.
  - A month grid with previous, next and Today. Weeks start on Sunday.
  - Days show text-labeled states (Blocked, Confirmed, Pending) with a pattern or icon, not only color, and a legend below.
  - Click or Space toggles a day's selection, with "Block selected" and "Unblock selected" buttons showing the count. Days with a confirmed booking can't be selected for blocking.
  - A day with bookings opens a side panel listing customer name, event type and status (built).
  - Saving state. `date_has_confirmed_booking` and other errors show a message and keep the selection. Success clears the selection and refreshes.
  - Redirects: customer-role to `/dashboard` (`/` is the public landing page), unlinked vendor to `/vendor/profile`.
  - Also: a "Clear selection" button; days read "Open" when nothing is on them and "· Selected" when picked; a line counts days picked in other months; clicks wait until the month has loaded.
- `/vendor` (dashboard): "Month at a glance" shows blocked days once the route returns them. Its fallback stays.
- `/vendor/bookings`:
  - A confirm, or "Accept instead", that hits `date_unavailable` shows "You already have a confirmed booking on {date}." on that row, or "You blocked {date} on your calendar. Unblock it to accept this booking." when the day is blocked (the error's hint says which). The date is written the way the row writes it.
  - The row keeps its status, and declining still works.
- `/events/[id]/vendors`:
  - Each vendor card shows "Available on {date}" or "Unavailable on {date}" in text (built).
  - If unavailable, the Book button is disabled, with "Not available on your event date" next to it.
  - "View calendar" opens the read-only month grid dialog (built).
  - `vendor_unavailable` on booking shows a message and refreshes availability. Booking from a "What's missing" card shows the same message on the card.
- `/events/[id]/edit`:
  - `date_has_confirmed_bookings` shows next to the date field: "This event has confirmed bookings, so its date can't change."
  - The other fields keep what was typed.
- Dates display as written, never converted. Plain text only.

## Acceptance criteria
1. A vendor blocks and unblocks dates, they persist across reloads, and a batch applies all or nothing.
2. The vendor calendar distinguishes blocked, confirmed and pending, and doesn't show declined bookings.
3. Blocking a date with a confirmed booking returns 409 `date_has_confirmed_booking` and changes nothing, including through a direct client insert.
4. A customer's vendor cards show availability on the event's date, and Book is disabled when the vendor is unavailable. The calendar dialog shows only unavailable dates and highlights the event's date, with no reasons or other customers' details.
5. Booking on a blocked date, or on one with another confirmed booking, returns 409 `vendor_unavailable` and creates nothing, also through a direct client insert. Pending bookings on the same date don't block.
6. Two customers can both hold pending bookings for the same vendor and date. After the vendor confirms one, confirming the other returns 409 `date_unavailable`, and declining it works. The date now shows as unavailable to customers.
7. Two simultaneous confirms for the same vendor and date: exactly one succeeds. A confirm and a block for the same date at the same time: one wins, never a confirmed booking on a blocked date.
8. Flipping a declined booking to confirmed rechecks availability.
9. Changing an event's date when it has a confirmed booking returns 409 `date_has_confirmed_bookings`. A date change and a confirm at the same time never leave a confirmed booking on a date different from its event's.
10. RLS:
    - Vendor B cannot read or write vendor A's blocked dates.
    - Customers have no direct access.
    - Vendors cannot read events.
    - Availability responses contain only dates.
11. Customer-role gets 403 on vendor endpoints, vendor-role gets 403 on the customer availability endpoint, and logged-out gets 401.
12. Dates never shift by a day in any timezone.
13. Old double-confirmed dates still load on both calendars and show as unavailable, and nothing crashes.
14. No `service_role` key in the repo and no new dependency.
