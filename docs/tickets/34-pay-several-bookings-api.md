# 34 — Pay several bookings in one request (API)

**What to build:** `pay_bookings()` in SQL (`032_pay_bookings.sql`) and `POST /api/events/:id/payments`. The customer sends the ids of confirmed bookings of one event, a plan (deposit or full) and a test outcome. All of them are paid in one transaction through `pay_booking()`, or none are. A booking whose deposit is already paid pays its balance. See `docs/SPEC-bulk-payment.md`.

**Blocked by:** 31, 32, 33

**Status:** done

- [x] A batch of confirmed bookings is paid in one request with the right amounts
- [x] A refused booking (pending, declined, already paid, someone else's, another event) refuses the whole batch and names the vendor
- [x] 0, 21, duplicate and invalid ids, bad plan and bad testMethod return 400
- [x] A decline returns 402 and records nothing
- [x] Repeating the request returns 409; two at once: one succeeds
- [x] Logged out 401, vendor 403, no direct payment inserts
