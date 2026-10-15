# SPEC-events-booking.md

## Goal
A customer creates events, browses vendors by category, books vendors, and views the plan with booking status. Customer side only.

## Out of scope
Vendor RLS on bookings, vendor portal, vendor-user linking, changing booking status, "What's missing" cards, matching, chatbot, editing or deleting events, cancelling bookings.

## User flow
1. Customer opens `/`: list of their events and a "Create event" button.
2. `/events/new`: type, date, budget, guest count. On success go to `/events/[id]`.
3. `/events/[id]` (the plan): event details, bookings with status badges, "Add vendor" button.
4. `/events/[id]/vendors`: vendors with category tabs ("All" by default). "Book" creates a pending booking, then the button shows "Booked" and the plan includes it.
5. Vendor-role users keep the feature 1 placeholder at `/` and get 403 from these endpoints.

## Data and tables
- `vendors`: id (uuid PK), name (text, not null), category (text, not null), price (numeric, not null, >= 0), owner (uuid, nullable, references profiles).
- `events`: id (uuid PK), owner (uuid, not null, default `auth.uid()`, references profiles, on delete cascade), type (text, check in wedding, birthday, corporate), date (date, not null), budget (numeric, not null, > 0), guest_count (int, not null, > 0), created_at.
- `bookings`: id (uuid PK), event_id (references events, on delete cascade), vendor_id (references vendors), category (text, not null), status (text, not null, default 'pending', check in pending, confirmed, declined), created_at. Partial unique index on (event_id, vendor_id) where status in ('pending','confirmed').
- Seed: `supabase/sql/003_seed_vendors.sql`, placeholder data: 5 categories (venue, catering, photography, music, decoration), 2 to 3 vendors each, varied prices, owner null. Assumption: placeholder, to be replaced when categories are defined.
- Assumption: categories are free text, so there is no check constraint.
- Assumption: DB columns are snake_case, the API is camelCase.

## RLS
- `vendors`: enable RLS. SELECT for any signed-in user. No INSERT, UPDATE or DELETE policy.
- `events`: enable RLS. SELECT, UPDATE and DELETE where `owner = auth.uid()`. INSERT with check `owner = auth.uid()` and the caller's profile role is customer (Assumption).
- `bookings`: enable RLS. SELECT where the booking's event is owned by `auth.uid()`. INSERT with check: event owned by `auth.uid()`, status = 'pending', caller's role is customer. No customer UPDATE or DELETE policy (Assumption: status changes belong to vendors in feature 3, which adds its own policies).

## Shared shapes
- `Event` = `{ id, type: "wedding" | "birthday" | "corporate", date: "YYYY-MM-DD", budget: number, guestCount: number }`
- `Vendor` = `{ id, name, category, price }` (no owner)
- `PlanBooking` = `{ id, eventId, vendorId, vendorName, category, price, status: "pending" | "confirmed" | "declined", createdAt }`
- Error body and `unauthorized` (401) as defined in SPEC-setup-and-auth.md. Vendor-role callers get 403 `forbidden`.

## API
All routes require a session (feature 1 route protection). Logged-out requests return 401 `unauthorized`.

### POST /api/events
- Body: `{ type, date, budget, guestCount }`
- 201: `{ event: Event }`
- 400 `validation_error`: type not allowed, invalid date, budget not above 0, guestCount not an integer above 0
- 403 `forbidden`, 500 `server_error`

### GET /api/events
- 200: `{ events: Event[] }`, the caller's own events, ordered by date ascending. Empty list is valid.
- 403 `forbidden`, 500 `server_error`

### GET /api/events/:id/plan
- 200: `{ event: Event, bookings: PlanBooking[] }`, bookings ordered by createdAt ascending. Empty list is valid.
- 404 `event_not_found`: missing, not the caller's, or malformed id
- 403 `forbidden`, 500 `server_error`

### GET /api/vendors?category=
- `category` is optional. Without it, all vendors. An unknown category returns an empty list. Ordered by name.
- 200: `{ vendors: Vendor[] }`
- 500 `server_error`

### POST /api/bookings
- Body: `{ eventId, vendorId }`. The server reads the vendor, copies its category and sets status to pending.
- 201: `{ booking: PlanBooking }`
- 400 `validation_error`: missing or malformed ids
- 404 `event_not_found` (missing or not the caller's), 404 `vendor_not_found`
- 409 `already_booked`: same vendor already pending or confirmed for this event
- 403 `forbidden`, 500 `server_error`

## UI screens and states
- `/`: loading, empty ("No events yet" with create button), list (type, date, budget, guests), error with retry.
- `/events/new`: idle, submitting (button disabled), field errors from `validation_error`, generic error.
- `/events/[id]`: loading, empty bookings ("Nothing booked yet" with "Add vendor"), loaded (status badges for pending, confirmed, declined), 404 page, error with retry.
- `/events/[id]/vendors`: loading, empty (no vendors in the category), loaded (category tabs built from the distinct categories of the unfiltered list; vendors already booked for this event show "Booked"), booking in progress, `already_booked` handled as "Booked", error with retry.
- Assumption: prices and budgets are plain numbers with thousands separators, no currency symbol.

## Acceptance criteria
1. A customer creates events of each type and sees them on `/`. Invalid input returns 400 with field errors in the UI.
2. Vendors can be browsed by category. Each category tab shows only its vendors.
3. Booking creates a pending booking with the vendor's category, and it appears on the plan. Booking the same vendor again returns 409. A declined booking, set manually in the DB, allows booking again.
4. The plan shows pending, confirmed and declined correctly.
5. RLS: customer A cannot read B's events, plan or bookings, and cannot book into B's event. A customer cannot update a booking's status or write to `vendors`. Any signed-in user can read vendors.
6. A vendor-role user gets 403 on events and bookings endpoints.
7. Logged-out requests return 401. No `service_role` key in the repo.