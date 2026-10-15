# 16 — Events have a location

**What to build:** When creating or editing an event, a customer can pick where it takes place from a fixed list of areas, change it later or clear it. The plan shows it.

**Blocked by:** None

**Status:** done

- [x] The create and edit forms have a "Location (optional)" select with "Not set" and every area; a template leaves it unset, like the date
- [x] The location is saved, changed and cleared; the edit page sends it only when it changed
- [x] A value that isn't an area is refused with the error naming `location`, and nothing is saved
- [x] The database itself refuses a location outside the list
- [x] The plan header shows the location after the date when it is set
- [x] Existing events keep working with no location
- [x] Works at phone width

**Notes (2026-10-16):** SQL `017_event_location.sql` run on the live project (twice, no errors). 44 API checks passed on a local production build against the live database (create, trim, change, clear with empty text and null, a field left out stays, bad values `Mars`, a number, wrong case, an object and an array refused with `location` named, location on the list, plan and dashboard, vendor 403, logged out 401, and the database refusing `Mars` through the Supabase client). Throwaway accounts and the test vendor deleted afterwards. Not checked in a browser yet: the form select on create and edit, the plan header line, and phone width. The edit page's only-send-what-changed logic is code only so far.

**Browser check (2026-10-16):** 39 checks in headless Chrome against a production build and the live project, all passing; throwaway accounts, vendors and events deleted afterwards. Create: the select has Not set and 11 areas, the wedding template leaves it unset, a created event shows `Wedding · date · Laguna`. Edit: the saved area is preselected, changing and clearing save and show on the plan, an unchanged form says "No changes to save". 375px: no horizontal overflow on create, edit, vendor list and plan; Tab reaches the select after the date and the focus ring shows.
