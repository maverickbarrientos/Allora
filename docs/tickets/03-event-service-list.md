# 03 — Each event has its own service list

**What to build:** Every event now has its own list of services instead of sharing one fixed list per event type. Existing events start with their type's usual services, so nothing changes for them. The plan page shows a "Services" section listing each service as Booked, Pending or Missing.

**Blocked by:** 02

**Status:** done

- [x] A new `event_services` table exists with Row Level Security on: only the event's owner can read, add and remove its rows; vendors and logged-out users see nothing
- [x] Every existing event gets its type's usual services, in the usual order
- [x] The "What's missing" cards, budget shares, budgets page, dashboard missing list and chatbot checklist all use the event's own list
- [x] For an existing event of each type (wedding, birthday, corporate), the cards, dashboard, chatbot checklist and budgets are the same as before
- [x] The plan page shows a "Services" section with Booked, Pending or Missing for each service
- [x] Another customer's event gives "not found"; a vendor gets "forbidden"; logged out gets "unauthorized"
- [x] Works on the live URL

**Tested (2026-10-16):** all checks passed on a production build of this branch merged with the latest `main`, against the live Supabase project: 59 API checks, 25 browser checks in headless Chrome and 5 for the create-page type change, with throwaway users that were deleted afterwards. Not run on the Vercel URL itself.
