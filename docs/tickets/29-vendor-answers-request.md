# 29 — Vendor answers a cancellation request

**What to build:** A vendor sees bookings the customer asked to cancel in their own group and either approves the cancellation or keeps the booking.

**Blocked by:** 28

**Status:** todo

- [ ] The vendor's bookings page has a "Cancellation requested" group with "Approve cancellation" and "Keep booking"
- [ ] Approving (after a confirm dialog) makes the booking cancelled; a paid deposit becomes "Deposit refunded"
- [ ] Keeping the booking returns it to confirmed
- [ ] Approving a booking with no open request is refused and changes nothing
- [ ] Only the booking's own vendor can answer; other vendors get 404
- [ ] Works on the live URL
