# 28 — Request cancellation

**What to build:** A customer taps "Request cancellation" on a pending or confirmed booking, confirms in a dialog, and the booking shows "Cancellation requested" while it waits for the vendor.

**Blocked by:** None

**Status:** done

- [x] The cancellation migration is run in Supabase
- [x] A pending or confirmed booking shows "Request cancellation"; confirming it changes the booking to "Cancellation requested" and removes the button
- [x] A booking with a request open still holds its service: the category is not a gap and the vendor can't be booked twice for the event
- [x] Asking twice, or on a declined or cancelled booking, shows a clear message and changes nothing
- [x] Another customer's booking, a malformed id and a logged-out caller are refused (404 / 401), and a customer still can't change a booking's status directly
- [x] Works on the live URL
