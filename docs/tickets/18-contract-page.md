# 18 — Contract page with PDF download

**What to build:** Each booking on the event plan has a Contract link. It opens the booking's contract: event, vendor, service, price, the frozen terms, and "Agreed by <customer name> on <date>". If the booking has no terms, it says "No terms provided by vendor". A Download PDF button opens the browser's print dialog, and the printout shows only the contract, without the app's navigation.

**Blocked by:** 17

**Status:** todo

- [ ] Every booking row on the plan has a Contract link
- [ ] The contract shows the booking facts, the frozen terms with their line breaks, the customer's name and the agreement date and time
- [ ] A booking without terms (old bookings, or vendors with none) shows "No terms provided by vendor"
- [ ] Download PDF produces a clean one-document printout with no navigation or buttons
- [ ] Another customer, a vendor, or a made-up booking id gets "not found"; logged-out visitors go to login
- [ ] No AI is called
- [ ] Works on a phone at 375px wide
- [ ] Works on the live URL
