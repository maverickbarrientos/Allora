# SPEC-vendor-portal.md

## Goal
A vendor sees the bookings addressed to them and accepts or declines each one. The new status shows on the customer's plan. Vendor side only.

## Out of scope
Vendor self-serve onboarding (creating or claiming a vendor record), editing vendor name, category or price, changing a decision, notifications, showing customer name or budget to vendors, "What's missing" cards, matching, chatbot.

## Setup
- Assumption: a vendor user is linked to a vendor record in the database, one per user:
  `update vendors set owner = '<profiles.id>' where id = '<vendors.id>';`
- Unique index on `vendors(owner)` where owner is not null.

## User flow
1. A vendor-role user logs in and lands on `/vendor`. `/` redirects vendor-role users there. Customer-role users who open `/vendor` are redirected to `/`.
2. `/vendor`: vendor name and category, then bookings in three sections (Pending, Confirmed, Declined), newest first.
3. Accept or Decline on a pending booking, with a confirmation step saying the decision is final. The booking moves to its section.
4. The customer's plan shows the new status the next time it loads.

## Data and tables
- No new tables. Uses `vendors.owner` and `bookings.status`.
- Function `vendor_incoming_bookings()`: security definer, empty search_path, uses `auth.uid()`. Returns bookings whose vendor is owned by the caller, joined with the event's type, date and guest_count. It never returns budget or owner.
- Assumption: vendors never read `events` directly.

## RLS (bookings, vendor side, added next to the customer policies from feature 2)
- SELECT: the booking's vendor is owned by `auth.uid()`.
- UPDATE using: vendor owned by `auth.uid()` and status = 'pending'. With check: vendor owned by `auth.uid()` and status in ('confirmed','declined').
- Column-level: revoke UPDATE on `bookings` from `anon` and `authenticated`, then grant UPDATE (status) to `authenticated`.
- No vendor INSERT or DELETE policy. Customers still have no UPDATE policy.

## Shared shapes
- `VendorBooking` = `{ id, category, status: "pending" | "confirmed" | "declined", createdAt, event: { type: "wedding" | "birthday" | "corporate", date: "YYYY-MM-DD", guestCount: number } }`
- `Vendor` as defined in SPEC-events-booking.md.
- Error body and 401 `unauthorized` as in SPEC-setup-and-auth.md. Customer-role callers get 403 `forbidden`.

## API
All routes require a session. Logged-out requests return 401 `unauthorized`.

### GET /api/vendor/bookings
- 200: `{ vendor: Vendor, bookings: VendorBooking[] }`, ordered by createdAt descending. Empty list is valid.
- 403 `forbidden`
- 404 `vendor_not_linked`: the vendor user has no linked vendor record
- 500 `server_error`

### PATCH /api/vendor/bookings/:id
- Body: `{ status: "confirmed" | "declined" }`
- 200: `{ booking: VendorBooking }`
- 400 `validation_error`: status missing or not one of the two allowed values
- 403 `forbidden`
- 404 `booking_not_found`: missing, not addressed to this vendor, or malformed id
- 409 `already_decided`: the booking is no longer pending
- 500 `server_error`
- The update only applies while the status is pending.

## UI screens and states
- `/vendor`:
  - Loading.
  - Not linked: "Your account isn't linked to a service yet" with a short note to contact the Allora team.
  - Empty: "No bookings yet".
  - Loaded: three sections with counts, and Accept and Decline buttons on pending rows only. Each row shows category, event type, date, guest count and a status badge.
  - Confirmation dialog stating the decision is final.
  - Action in progress: the row's buttons are disabled.
  - `already_decided`: show a short message and reload the list.
  - Error with retry.
- Redirects: `/` sends vendor-role users to `/vendor`, and `/vendor` sends customer-role users to `/`.

## Acceptance criteria
1. A linked vendor sees only bookings addressed to them, with category, status and event type, date and guest count. Budget and customer identity never appear in the API response.
2. Accept sets the booking to confirmed and Decline sets it to declined. The booking moves to the right section.
3. The customer's plan shows the new status after reload.
4. A second PATCH on a decided booking returns 409 `already_decided`.
5. RLS: vendor B cannot read or update vendor A's bookings (404). A vendor cannot change any column except status, and cannot set pending. A vendor cannot read `events` directly. A customer cannot update booking status.
6. An unlinked vendor user gets 404 `vendor_not_linked` and sees the not-linked state.
7. Customer-role users get 403 on both vendor endpoints.
8. No `service_role` key in the repo.