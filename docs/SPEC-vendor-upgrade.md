# SPEC-vendor-upgrades.md

## Goal
Three vendor-side additions: (A) a vendor creates and edits their own profile, (B) a vendor can change an accept or decline later, (C) a vendor sees the customer's name and the event budget on each booking.

## Supersedes (SPEC-vendor-portal.md)
- Its out-of-scope items "vendor self-serve onboarding", "changing a decision" and "customer name or budget" are now in scope.
- 409 `already_decided` is replaced by `status_unchanged` and `conflicting_booking`.
- `VendorBooking` gains `customerName` and `event.budget`. Acceptance criterion 1 (no budget or customer identity in responses) is replaced by this spec's.
- The `/vendor` "not linked" state becomes profile creation. Vendors linked by SQL keep working.

## Out of scope
Deleting or deactivating a vendor, claiming seeded vendors, images, notifications or messaging, customer email, budget shares, changing a decision back to pending.

## Rules
- Allowed categories = the categories in the feature 4 config (src/lib/matching/config.ts), exposed by GET /api/categories. Assumption.
- Profile validation: name trimmed, 1 to 80 characters. Category must be in the allowed list (checked only when it differs from the current value). Price a number above 0, at most 100,000,000, at most 2 decimals. Unknown body fields are ignored. `owner` is never accepted from the client.
- Assumption: category cannot change while the vendor has any pending or confirmed booking (409 `category_locked`). Name and price can always change.
- Assumption: bookings don't snapshot price, so the plan shows the vendor's current price.
- Assumption: a vendor can change confirmed to declined and declined to confirmed at any time, no deadline. Never back to pending.

## User flow
1. A vendor user with no vendor record opens `/vendor` and is redirected to `/vendor/profile` to create one, then lands on `/vendor`.
2. A linked vendor sees their profile summary on `/vendor` with "Edit profile", opening `/vendor/profile` in edit mode.
3. `/vendor` bookings show customer name, event type, date, guest count and budget. Pending: Accept and Decline. Confirmed: "Decline instead". Declined: "Accept instead". Each opens a confirmation saying the customer will see the change on their plan.
4. The customer's plan shows the new status on reload. Confirmed to declined makes the category a gap again (the feature 4 card returns). Declined to confirmed removes the gap.

## Data and tables
- No new tables. Vendor rows created by vendor users have `owner` = their profile id.
- Replace `vendor_incoming_bookings()` (drop and recreate, security definer, empty search_path, uses `auth.uid()`, execute only for authenticated). It also returns the customer's name (profiles.name through events.owner) and the event's budget. It never returns email, profile ids, owner or budget shares.
- Trigger on `vendors` before update of category: if the category changes and the vendor has any pending or confirmed booking, raise an error the handler maps to 409 `category_locked`.

## RLS
- `vendors`: INSERT with check `owner = auth.uid()` and the caller's profile role is vendor. UPDATE using `owner = auth.uid()` with check `owner = auth.uid()`. Revoke UPDATE from anon and authenticated, then grant UPDATE (name, category, price) to authenticated. No DELETE policy. SELECT for any signed-in user is unchanged. The unique index on `vendors(owner)` from feature 3 keeps it to one vendor per user.
- `bookings` (vendor side): replace the feature 3 UPDATE policy. Using: vendor owned by `auth.uid()` (any status). With check: vendor owned by `auth.uid()` and status in ('confirmed','declined'). Only the status column is grantable for update, as in feature 3. The partial unique index on (event_id, vendor_id) for pending and confirmed rows still applies.
- Customers still have no UPDATE policy on bookings. Vendors still cannot read `events` or `profiles` directly.

## Shared shapes
- `Vendor` as in SPEC-events-booking.md.
- `VendorProfile` = `{ vendor: Vendor, categoryLocked: boolean }`
- `VendorBooking` = `{ id, category, status: "pending" | "confirmed" | "declined", createdAt, customerName: string, event: { type, date: "YYYY-MM-DD", guestCount: number, budget: number } }`
- Error body, 401 `unauthorized` as in SPEC-setup-and-auth.md. Customer-role callers get 403 `forbidden` on all vendor routes.

## API
All routes require a session. Logged-out requests return 401 `unauthorized`.

### GET /api/categories
- 200: `{ categories: string[] }`, in config order. Any signed-in user.
- 500 `server_error`

### GET /api/vendor/profile
- 200: `VendorProfile`
- 403 `forbidden`, 404 `vendor_not_linked`, 500 `server_error`

### POST /api/vendor/profile
- Body: `{ name, category, price }`
- 201: `{ vendor: Vendor, categoryLocked: false }`
- 400 `validation_error` (per the Rules)
- 403 `forbidden`
- 409 `profile_exists`: the user already has a vendor record, including one linked by SQL
- 500 `server_error`

### PATCH /api/vendor/profile
- Body: any of `{ name, category, price }`, at least one.
- 200: `VendorProfile`
- 400 `validation_error`, including an empty body
- 403 `forbidden`, 404 `vendor_not_linked`
- 409 `category_locked`
- 500 `server_error`

### GET /api/vendor/bookings
- Same as SPEC-vendor-portal.md, with the new `VendorBooking` shape.

### PATCH /api/vendor/bookings/:id
- Body: `{ status: "confirmed" | "declined" }`
- 200: `{ booking: VendorBooking }`
- 400 `validation_error`: status missing or not one of the two values (including "pending")
- 403 `forbidden`
- 404 `booking_not_found`: missing, not addressed to this vendor, or malformed id
- 409 `status_unchanged`: the booking already has that status
- 409 `conflicting_booking`: setting confirmed while another pending or confirmed booking exists for the same event and vendor
- 500 `server_error`
- Two simultaneous requests with the same status: one 200, the other 409 `status_unchanged`.

## UI screens and states
- `/vendor/profile`:
  - Loading.
  - Create mode (when GET returns `vendor_not_linked`): name, category (select from GET /api/categories), price, submitting, field errors, generic error.
  - Edit mode: same fields filled in, a "Saved" message on success. If `categoryLocked`, the category select is disabled with a short note. A `category_locked` error shows on the field.
  - A customer-role user is redirected to `/`.
- `/vendor`: an unlinked vendor is redirected to `/vendor/profile`. Rows show customer name, event type, date, guests, budget, category and a status badge. Confirmed and declined rows show the switch action. Dialog text is not "final". `status_unchanged` and `conflicting_booking` show a short message and reload the list. Other states as in the feature 3 spec.
- Customer name and all API text render as plain text, never HTML.
- Prices and budgets are plain numbers, no currency symbol.

## Acceptance criteria
1. An unlinked vendor creates a profile, appears in the customer's browse list under the chosen category, and sees `/vendor`. A second create returns 409. A SQL-linked vendor gets 409 on create and can edit.
2. Edits to name and price show in the customer's browse list and plan. Invalid input returns 400 with field errors.
3. A category change succeeds with no pending or confirmed bookings and returns 409 `category_locked` otherwise, including through a direct Supabase client update (the trigger blocks it). Changing name or price while locked works.
4. Vendors can switch confirmed to declined and declined to confirmed. Same status returns 409. Pending is rejected. The customer's plan shows the new status on reload.
5. Flipping declined to confirmed while the customer has a newer pending or confirmed booking for the same event and vendor returns 409 `conflicting_booking`.
6. Feature 4 effect: after confirmed to declined, the card for that category returns on the next load. After declined to confirmed it is gone.
7. A vendor sees only their own bookings, each with customer name and event budget. Responses never include customer email, profile ids, owner or budget shares.
8. RLS: vendor B cannot update vendor A's profile or bookings, change `owner`, delete a vendor or insert a vendor owned by someone else. A customer cannot insert or update vendors, or update bookings. A vendor cannot read `events` or `profiles` directly.
9. Customer-role users get 403 on every vendor route. Logged-out requests get 401.
10. No `service_role` key in the repo. No new tables.