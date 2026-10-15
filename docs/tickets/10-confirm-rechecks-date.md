# 10 — Confirming a booking rechecks the date

**What to build:** A vendor can't confirm a booking on a date they're already unavailable on, whether that's a new request or "Accept instead" on one they declined earlier. The row shows "You already have a confirmed booking on {date}." and keeps its status; declining still works.

**Blocked by:** 09

**Status:** todo

- [x] Two customers can both hold pending bookings for the same vendor and date
- [x] After the vendor confirms one, confirming the other is refused with the message on that row, and declining it works
- [x] Confirming on a blocked date is refused the same way
- [x] "Accept instead" on a declined booking rechecks the date
- [x] Two confirms for the same vendor and date at the same moment: exactly one succeeds
- [x] A confirm and a block for the same date at the same moment never leave a confirmed booking on a blocked date
- [ ] Works on the live URL

**Notes (2026-10-16):** Built in `11b4b96` on `feature/availability-blocking`; `017_confirm_availability.sql` applied to the live project (run twice). Tested on a production build against the live project with throwaway accounts (deleted afterwards): 25 API checks (two customers on one date, second confirm refused and declinable, date then unavailable to customers, Accept instead rechecks, blocked-day wording, error order status_unchanged then conflicting_booking then date_unavailable, three rounds of simultaneous confirms with exactly one winner, three rounds of confirm against block never both, declining on a blocked date) and 10 browser checks (row message and status at 1280px and 375px, declining clears it). Changed during testing: the row message writes the date like the row does. Still to check on the preview URL.
