# 19 — Receipt page with PDF download

**What to build:** Each booking on the event plan has a Receipt link. It opens a summary of the booking: event type, date and guest count, vendor, service, price and booking status. If a deposit was paid it adds "Deposit paid: <amount> on <date>", and if it was refunded, "Deposit refunded". A Download PDF button opens the browser's print dialog, and the printout shows only the receipt, without the app's navigation.

**Blocked by:** None (independent of 18; whichever lands second reuses the print layout and the plan-row links the other built)

**Status:** todo

- [ ] Every booking row on the plan has a Receipt link
- [ ] The receipt shows the event, vendor, service, price and status, with status in words, not only colour
- [ ] A paid deposit shows its amount and date; a refunded one shows "Deposit refunded"; no deposit shows no deposit line
- [ ] Download PDF produces a clean one-document printout with no navigation or buttons
- [ ] Another customer, a vendor, or a made-up booking id gets "not found"; logged-out visitors go to login
- [ ] No AI is called
- [ ] Works on a phone at 375px wide
- [ ] Works on the live URL
