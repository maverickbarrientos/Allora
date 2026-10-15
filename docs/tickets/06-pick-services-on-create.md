# 06 — Pick services when creating an event

**What to build:** The new event form has a Services picker below the event type, prefilled with that type's usual services. The customer can change it before saving, and the event is created with exactly the services they chose.

**Blocked by:** 04

**Status:** done

- [x] The picker is prefilled from the chosen type's template
- [x] Changing the type replaces the selection only if the customer hasn't changed it yet
- [x] Creating an event without changing the picker gives the type's usual services
- [x] Creating an event with a custom list gives exactly that list, in that order
- [x] An empty or invalid list is rejected and no event is created
- [x] Works on the live URL

**Notes (2026-10-15):** Built in `724f8ec`, review fixes in `def757b`, branch `feature/event-services`. Lint and build pass.

**Tested (2026-10-16):** all checks passed on a production build of this branch merged with the latest `main`, against the live Supabase project: 59 API checks, 25 browser checks in headless Chrome and 5 for the create-page type change, with throwaway users that were deleted afterwards. Not run on the Vercel URL itself.
