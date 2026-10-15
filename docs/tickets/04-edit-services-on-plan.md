# 04 — Edit services on the plan page

**What to build:** On the plan page, the customer clicks Edit on the Services section, ticks or unticks services, and saves. Adding a service makes it a gap with its own card. Removing one removes its card and its set budget. A service that has a pending or confirmed booking can't be removed.

**Blocked by:** 03

**Status:** done

- [x] Edit opens a picker with one checkbox per category; Save and Cancel work
- [x] Adding a service shows a new "What's missing" card, and budget shares are rescaled over the event's own services
- [x] Removing a service with no active booking removes its card, its dashboard missing entry and its set budget
- [x] A service with a pending or confirmed booking is checked, disabled and marked "Has a booking"
- [x] Trying to remove a booked service shows "Can't remove {services}: they have a booking." and nothing is saved, even when other services were added in the same save
- [x] At least one service must stay checked; Save is disabled otherwise
- [x] An empty list, an unknown category or a duplicate is rejected and nothing is saved (checked in the API and on the live database)
- [x] Choosing services makes no AI call (the save itself calls no AI; the cards reload afterwards and their text still comes from the AI)
- [x] Works on the live URL

**Notes (2026-10-15):** Built in `7c38b34`, review fixes in `0f4aab2`, branch `feature/event-services`. Checked on the live database, with every change rolled back: removing a booked service is refused and the list is unchanged; duplicate, empty and null lists are refused; removing a service also removes its set budget. Marked done by the team on 2026-10-15.
