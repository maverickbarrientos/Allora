# 04 — Edit services on the plan page

**What to build:** On the plan page, the customer clicks Edit on the Services section, ticks or unticks services, and saves. Adding a service makes it a gap with its own card. Removing one removes its card and its set budget. A service that has a pending or confirmed booking can't be removed.

**Blocked by:** 03

**Status:** todo

- [ ] Edit opens a picker with one checkbox per category; Save and Cancel work
- [ ] Adding a service shows a new "What's missing" card, and budget shares are rescaled over the event's own services
- [ ] Removing a service with no active booking removes its card, its dashboard missing entry and its set budget
- [ ] A service with a pending or confirmed booking is checked, disabled and marked "Has a booking"
- [ ] Trying to remove a booked service shows "Can't remove {services}: they have a booking." and nothing is saved, even when other services were added in the same save
- [ ] At least one service must stay checked; Save is disabled otherwise
- [ ] An empty list, an unknown category or a duplicate is rejected and nothing is saved
- [ ] Choosing services makes no AI call
- [ ] Works on the live URL
