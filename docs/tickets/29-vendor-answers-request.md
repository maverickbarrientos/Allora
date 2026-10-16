# 29 — Vendor answers a cancellation request

**What to build:** A vendor sees bookings the customer asked to cancel in their own group and either approves the cancellation or keeps the booking.

**Blocked by:** 28

**Status:** done

- [x] The vendor's bookings page has a "Cancellation requested" group with "Approve cancellation" and "Keep booking"
- [x] Approving (after a confirm dialog) makes the booking cancelled; a paid deposit becomes "Deposit refunded"
- [x] Keeping the booking clears the request and leaves its status as it was
- [x] Approving a booking with no open request is refused and changes nothing
- [x] Only the booking's own vendor can answer; other vendors get 404
- [x] Works on the live URL
