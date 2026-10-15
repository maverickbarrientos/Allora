# 03 — Each event has its own service list

**What to build:** Every event now has its own list of services instead of sharing one fixed list per event type. Existing events start with their type's usual services, so nothing changes for them. The plan page shows a "Services" section listing each service as Booked, Pending or Missing.

**Blocked by:** 02

**Status:** todo

- [ ] A new `event_services` table exists with Row Level Security on: only the event's owner can read, add and remove its rows; vendors and logged-out users see nothing
- [ ] Every existing event gets its type's usual services, in the usual order
- [ ] The "What's missing" cards, budget shares, budgets page, dashboard missing list and chatbot checklist all use the event's own list
- [ ] For an existing event of each type (wedding, birthday, corporate), the cards, dashboard, chatbot checklist and budgets are the same as before
- [ ] The plan page shows a "Services" section with Booked, Pending or Missing for each service
- [ ] Another customer's event gives "not found"; a vendor gets "forbidden"; logged out gets "unauthorized"
- [ ] Works on the live URL
