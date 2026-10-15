# SPEC-vendor-profiles.md

## Goal
Vendors describe themselves beyond a name, category and price: a short "about" text, a location, and contact details. Customers see the full profile on a vendor detail page. Contact details are shown to a customer only after the vendor has confirmed one of their bookings.

## Supersedes
- SPEC-events-booking.md: `Vendor` gains `location`.
- SPEC-vendor-upgrades.md: `VendorProfile` gains `contact`, and the profile endpoints accept the new fields. Its out-of-scope "images" stays out of scope.

## Out of scope
Photos or image uploads, matching or filtering by location, maps or addresses, reviews, messaging, showing contact details before a confirmed booking, sending about, location or contact details to the LLM, placeholder text for seeded vendors, new dependencies.

## Rules
- All new fields are optional. An empty string or `null` clears a field. Text is trimmed before saving.
- About: up to 1,000 characters. Location: free text, up to 80 characters (for example "Quezon City" or "Metro Manila").
- Phone: 5 to 30 characters, only digits, spaces and `+ ( ) - .`.
- Email: the same format check as sign-up, up to 254 characters.
- Website: up to 200 characters. It must be an `http://` or `https://` URL, so a stored link can never run code when clicked.
- Contact details are visible to the vendor who owns them, and to a customer with at least one **confirmed** booking with that vendor on any of their events. If that booking is later declined or cancelled, they are hidden again. Pending and declined bookings never show them.
- Matching, ranking and the "What's missing" cards don't change. The LLM never receives about, location or contact details.
- All text is shown as plain text. The website is the only link, opened in a new tab with `rel="noopener noreferrer"`.

## Data and tables
SQL `015_vendor_profiles.sql`, safe to re-run. 014 is the blocked-dates work on another branch; renumber at merge if needed.
- `vendors` gains `about text` and `location text`, both nullable, with length checks (1,000 and 80). Column grant: the vendor owner may also update `about` and `location`; the existing update policy (owner only) still applies.
- New table `vendor_contacts`:
  - Columns: `vendor_id` (primary key, references the vendor, removed with it), `phone`, `email`, `website` (all nullable, with length checks), `updated_at`.
  - Row Level Security:
    - Read: the vendor's owner; or a signed-in user who owns an event that has a confirmed booking with this vendor.
    - Insert and update: only the vendor's owner.
    - No delete policy; clearing every field is enough.
    - Logged-out users get nothing.
- No change to `bookings`, `events` or `profiles`.

## Shared shapes
- `Vendor` = `{ id, name, category, price, location: string | null }` (plus `availableOnEventDate` when an event is given, as before).
- `VendorDetail` = `Vendor` plus `about: string | null`.
- `VendorContact` = `{ phone: string | null, email: string | null, website: string | null }`.
- `VendorProfile` = `{ vendor: VendorDetail, contact: VendorContact, categoryLocked: boolean }`.
- Error body, 401 and 403 as in earlier specs.

## API
Every route requires a session; logged-out requests get 401 `unauthorized`.

### GET /api/vendors/:id (new)
- Query: optional `eventId`. With it, the vendor gets `availableOnEventDate`, as on the list.
- Any signed-in user may call it.
- 200: `{ vendor: VendorDetail, contact: VendorContact | null, contactVisible: boolean }`.
  - `contactVisible` is true for the owner and for a customer with a confirmed booking. Then `contact` holds the details; it can be all nulls if none were added.
  - Otherwise `contact` is `null`.
- 404 `vendor_not_found`: missing or malformed id. 404 `event_not_found`: as on the list. 500 `server_error`.

### GET /api/vendors (changed)
- Each vendor includes `location`. Nothing else changes.

### GET, POST and PATCH /api/vendor/profile (changed)
- Responses are `VendorProfile`.
- POST and PATCH also accept `about`, `location`, `phone`, `email` and `website`. On PATCH, a field that isn't sent stays unchanged.
- 400 `validation_error` names each bad field (`Invalid fields: phone, website.`), as before. Nothing is saved when any field is invalid.
- `category_locked`, `profile_exists` and `vendor_not_linked` stay as they are.

## UI screens and states
- **`/vendor/profile`** (vendor):
  - Under the existing fields: Location, then About (textarea with a counter from 900).
  - Then a "Contact details" section with Phone, Email and Website, and the line "Customers see these only after you confirm their booking."
  - One Save for everything. Errors appear next to each field.
- **`/events/[id]/vendors/[vendorId]`** (customer, new):
  - Shows: back link to the vendor list; image placeholder; category label; name in serif; location; price; availability on the event's date; About ("No description yet." when empty).
  - Book button: opens the existing "Check availability" dialog; shows "Booked" when this event already has a pending or confirmed booking with them.
  - Contact section:
    - When visible: phone (a `tel:` link), email (a `mailto:` link) and website. A field with no value is left out. "This vendor hasn't added contact details yet." when all are empty.
    - When hidden: "Contact details appear here once {vendor} confirms your booking."
  - States: loading skeleton, error with Retry, 404 page. A vendor-role user is sent to `/vendor`.
- **Vendor cards** on `/events/[id]/vendors`: show the location under the name when set. The card's name links to the detail page.
- **Plan** (`/events/[id]`) and the "What's missing" cards: vendor names link to the detail page for that event.
- Works at 375px.

## Acceptance criteria
1. A vendor can add, change and clear about, location, phone, email and website, and they are saved exactly (trimmed).
2. Invalid values get 400 naming the fields, and nothing is saved: about over 1,000, location over 80, a phone with letters, a bad email, a `javascript:` or `ftp:` website.
3. Customers see about and location on the detail page, and location on the vendor cards.
4. A customer with no booking or only a pending booking with the vendor gets `contact: null`, and the page explains when contact details appear.
5. After the vendor confirms, that customer sees the contact details. After the vendor declines or cancels, they are hidden again.
6. A direct Supabase query on `vendor_contacts` returns nothing for another customer, for another vendor and when logged out. Only the owner can insert or update their row.
7. Matching results and the LLM input are unchanged, and contain none of the new fields.
8. Auth: logged-out 401; a customer calling the vendor profile endpoints gets 403; an unknown vendor id gets 404.
9. No `service_role` key, no new dependency, RLS on the new table.
