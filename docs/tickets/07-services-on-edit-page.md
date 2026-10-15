# 07 — Services on the edit page

**What to build:** The event edit page has the same Services picker, with its own Save. Changing the event's type no longer changes or blocks its services, so the old type-change warning goes away.

**Blocked by:** 04

**Status:** done

- [x] The edit page shows the Services picker with the event's current services and locked booked ones
- [x] Saving works the same as on the plan page, including the "Can't remove" message
- [x] Changing the event type keeps its services
- [x] The warning shown before a type change and the old "budgets outside checklist" error are gone
- [x] Works on the live URL

**Tested (2026-10-16):** all checks passed on a production build of this branch merged with the latest `main`, against the live Supabase project: 59 API checks, 25 browser checks in headless Chrome and 5 for the create-page type change, with throwaway users that were deleted afterwards. Not run on the Vercel URL itself.
