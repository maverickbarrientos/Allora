# 17 — Customers agree to terms before booking

**What to build:** When a customer books a vendor that has terms, the booking dialog shows the terms and a required "I agree to the vendor's terms" tick. Book stays disabled until it is ticked. The booking keeps a frozen copy of the terms and the time the customer agreed, so later edits by the vendor never change it. Vendors without terms book as before.

**Blocked by:** 16

**Status:** todo

- [ ] The tick and the terms appear when booking from browse and from a "What's missing" card
- [ ] Book is disabled until the tick is checked, and the tick is reachable and usable by keyboard
- [ ] A vendor with no terms shows no tick, and booking works as before
- [ ] The database copies the vendor's current terms and the agreement time onto the booking; a copy sent by the browser is ignored
- [ ] Booking a vendor that has terms without agreeing is refused by the database, also when tried through the Supabase client directly, with a clear message in the dialog
- [ ] Nobody can change a booking's terms copy or agreement time afterwards; vendors can still only accept or decline
- [ ] The vendor edits their terms: an existing booking keeps the old copy, a new booking gets the new terms
- [ ] Works on the live URL
