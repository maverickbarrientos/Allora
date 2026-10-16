# 35 — Totals and tick boxes on the plan

**What to build:** On the event plan, a totals strip (Total booked, Paid so far, Left to pay, Waiting for vendors) and a tick box on every confirmed booking that still owes money, with "Select all payable". A bar at the bottom shows how many are ticked, their total price and what is due now. See `docs/SPEC-bulk-payment.md`.

**Blocked by:** none (reads the plan data that already exists)

**Status:** not started

- [ ] Totals equal the sum of the rows, in cents, and ignore declined and cancelled
- [ ] Only payable rows have a tick box; pending rows say they can be paid once the vendor confirms
- [ ] The bar shows count, total price and due now, and is hidden with nothing ticked
- [ ] Works with the keyboard, at 375px with no sideways scroll, and with reduced motion
