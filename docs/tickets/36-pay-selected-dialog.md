# 36 — Pay the ticked bookings

**What to build:** The Pay button on the bar opens a dialog with each ticked booking and its amount, the total, the demo notice, a Deposit / Pay in full choice and an Approve / Decline test outcome. Confirm calls `POST /api/events/:id/payments`. On success the rows and totals update and the ticks clear; a decline keeps the ticks; a refused booking shows the vendor and the reason. See `docs/SPEC-bulk-payment.md`.

**Blocked by:** 34, 35

**Status:** done

- [x] One click on Confirm pays all ticked bookings with one request (double click sends one)
- [x] Rows and totals update from the response, with receipt links
- [x] Decline keeps the ticks and allows a retry
- [x] A refused booking shows the vendor name and pays nothing
- [ ] Works on the live URL (only the local production build was tested)
