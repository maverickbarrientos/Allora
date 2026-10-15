# 05 — More service categories

**What to build:** Customers can add five new services to an event (florist, cake, lighting, transport, makeup), and vendors can register under them. Each new service has its own budget share, and a few placeholder vendors exist for each so the new cards show vendors.

**Blocked by:** 04

**Status:** done

- [x] The service picker shows the five new categories after the original five
- [x] Each new category has its own budget weight, set in one config place
- [x] Adding florist to an event shows a florist card with up to 3 ranked vendors
- [x] A vendor can create or edit their profile under a new category, and then appears on the matching card
- [x] Placeholder vendors exist for each new category
- [x] Works on the live URL

**Tested (2026-10-16):** all checks passed on a production build of this branch merged with the latest `main`, against the live Supabase project: 59 API checks, 25 browser checks in headless Chrome and 5 for the create-page type change, with throwaway users that were deleted afterwards. Not run on the Vercel URL itself.
