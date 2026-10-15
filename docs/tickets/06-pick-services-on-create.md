# 06 — Pick services when creating an event

**What to build:** The new event form has a Services picker below the event type, prefilled with that type's usual services. The customer can change it before saving, and the event is created with exactly the services they chose.

**Blocked by:** 04

**Status:** todo

- [ ] The picker is prefilled from the chosen type's template
- [ ] Changing the type replaces the selection only if the customer hasn't changed it yet
- [ ] Creating an event without changing the picker gives the type's usual services
- [ ] Creating an event with a custom list gives exactly that list, in that order
- [ ] An empty or invalid list is rejected and no event is created
- [ ] Works on the live URL

**Notes (2026-10-15):** Built in `724f8ec`, review fixes in `def757b`, branch `feature/event-services`. Lint and build pass. Not yet checked against the live database or the preview URL, so no box is ticked.
