# 10 — Confirming a booking rechecks the date

**What to build:** A vendor can't confirm a booking on a date they're already unavailable on, whether that's a new request or "Accept instead" on one they declined earlier. The row shows "You already have a confirmed booking on {date}." and keeps its status; declining still works.

**Blocked by:** 09

**Status:** todo

- [ ] Two customers can both hold pending bookings for the same vendor and date
- [ ] After the vendor confirms one, confirming the other is refused with the message on that row, and declining it works
- [ ] Confirming on a blocked date is refused the same way
- [ ] "Accept instead" on a declined booking rechecks the date
- [ ] Two confirms for the same vendor and date at the same moment: exactly one succeeds
- [ ] A confirm and a block for the same date at the same moment never leave a confirmed booking on a blocked date
- [ ] Works on the live URL
