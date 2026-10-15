# 18 — Contract page with PDF download

**What to build:** Each booking on the event plan has a Contract link. It opens the booking's contract: event, vendor, service, price, the frozen terms, and "Agreed by <customer name> on <date>". If the booking has no terms, it says "No terms provided by vendor". A Download PDF button opens the browser's print dialog, and the printout shows only the contract, without the app's navigation.

**Blocked by:** 17

**Status:** todo

- [x] Every booking row on the plan has a Contract link
- [x] The contract shows the booking facts, the frozen terms with their line breaks, the customer's name and the agreement date and time
- [x] A booking without terms (old bookings, or vendors with none) shows "No terms provided by vendor"
- [x] Download PDF produces a clean one-document printout with no navigation or buttons
- [x] Another customer, a vendor, or a made-up booking id gets "not found"; logged-out visitors go to login
- [x] No AI is called
- [x] Works on a phone at 375px wide
- [ ] Works on the live URL

**Notes (2026-10-16):** Built on `feature/booking-documents`; no new SQL. New `GET /api/bookings/:id/contract` returns the booking facts, the frozen terms, the customer's name and the agreement time, only for the customer who owns the event: another customer, the booking's own vendor and a made-up id all get 404, logged out gets 401. New page `/events/[id]/bookings/[bookingId]/contract` with a Download PDF button (the browser's print dialog); the app shell (sidebar, top bar) gets `print:` classes so the printout is only the contract, and the page's own buttons are hidden in print. A booking without terms shows "No terms provided by vendor." and no "Agreed by" line. Every plan row has a Contract link. Tested on a local production build against the live project with throwaway accounts (deleted afterwards): 13 API checks and 19 headless Chrome checks, all passing (print view hides the sidebar and buttons, the PDF is one page, 375px has no sideways scrolling, HTML-looking event names stay text). Two checks first failed because the test searched for lowercase text after CSS uppercasing; fixed in the test, not the page. The price shown is the vendor's current price, not a frozen one (the spec freezes only the terms); the page says so. Still to check on the preview URL.
