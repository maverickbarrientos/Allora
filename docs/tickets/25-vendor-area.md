# 25 — Vendors pick the area they serve

**What to build:** A vendor's location is no longer free text: on their profile they pick the area they serve from the same list as events, or leave it unset. Existing free-text locations are mapped to an area where possible.

**Blocked by:** 24

**Status:** built; mapping rules not exercised

- [x] The profile page's Location field is a select labelled "Area you serve (optional)", with "Not set" and every area
- [x] Picking, changing and clearing the area saves; free text is refused with the error next to the field
- [x] The migration maps existing locations: an area name in any case becomes that area, a Metro Manila city becomes Metro Manila, anything else is cleared
- [x] The database itself refuses a vendor location outside the list
- [ ] Vendor cards and the vendor page show the area as before

**Notes (2026-10-16):** API checks: `Mars`, a number, `Quezon City` and wrong case refused with nothing saved; Cebu saved; other edits keep it; customer 403; the database refuses `Mars`. The mapping ran on the live project but all 59 vendors had no location, so it changed nothing there and its mapping rules were not exercised. Not checked in a browser: the select on `/vendor/profile` and the error next to it.

**Browser check (2026-10-16):** 39 checks in headless Chrome against a production build and the live project, all passing; throwaway accounts, vendors and events deleted afterwards. The profile Location field is a select with that label, the saved area is preselected, a change and a clear both persist after reload, 375px has no overflow. The browse cards were read in the list text (their area line is unchanged code from ticket 12); the vendor page was not opened. The old-location mapping rules still weren't exercised (no live vendor had a location).
