# 17 — Customers agree to terms before booking

**What to build:** When a customer books a vendor that has terms, the booking dialog shows the terms and a required "I agree to the vendor's terms" tick. Book stays disabled until it is ticked. The booking keeps a frozen copy of the terms and the time the customer agreed, so later edits by the vendor never change it. Vendors without terms book as before.

**Blocked by:** 16

**Status:** todo

- [x] The tick and the terms appear when booking from browse and from a "What's missing" card
- [x] Book is disabled until the tick is checked, and the tick is reachable and usable by keyboard
- [x] A vendor with no terms shows no tick, and booking works as before
- [x] The database copies the vendor's current terms and the agreement time onto the booking; a copy sent by the browser is ignored
- [x] Booking a vendor that has terms without agreeing is refused by the database, also when tried through the Supabase client directly, with a clear message in the dialog
- [x] Nobody can change a booking's terms copy or agreement time afterwards; vendors can still only accept or decline
- [x] The vendor edits their terms: an existing booking keeps the old copy, a new booking gets the new terms
- [ ] Works on the live URL

**Notes (2026-10-16):** Built on `feature/booking-documents`. `018_booking_terms.sql` adds `terms_snapshot` and `terms_accepted_at` on `bookings` and a before-insert trigger, `bookings_freeze_terms()`, that decides both: no terms on the vendor means both are empty; otherwise the insert must say the customer agreed and carry the exact terms they read, or it is refused (`terms_not_accepted`, or `terms_changed` when the vendor edited their terms in between), and the database stores its own copy and time. Run twice on the live project. The booking API takes an optional `agreedTerms` (400 `terms_not_accepted`, 409 `terms_changed`). The shared booking dialog (browse, vendor page and "What's missing" cards) loads the vendor's terms, shows them in a scrollable box with an "I agree" tick, and keeps Confirm disabled until it is ticked; if the terms changed, it shows a message, loads the new terms and clears the tick. Tested on a local production build against the live project with throwaway accounts (deleted afterwards): 31 API and direct-database checks and 26 headless Chrome checks, all passing (one phone check first failed because the test's own text was over the 4,000 limit; fixed in the test and rerun). Still to check on the preview URL.
