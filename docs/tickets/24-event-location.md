# 24 — Events have an area

**What to build:** When creating or editing an event, a customer can type the area where it takes place, change it later or clear it. The plan shows it.

**Blocked by:** None

**Status:** done

- [x] The create and edit forms have an "Area (optional)" text field (up to 60 characters); a template leaves it empty, like the date
- [x] The area is saved, changed and cleared; the edit page sends it only when it changed
- [x] An area over 60 characters is refused with the error naming `area`, and nothing is saved
- [x] The database itself refuses an area over 60 characters
- [x] The plan header shows the area after the date when it is set
- [x] Events that already have an area keep it; events with none keep working
- [x] Works at phone width

**Tests (2026-10-16):** `028_event_area.sql` run on the live project twice with no errors; existing `area` data unchanged (2 events, 1 vendor). 58 API checks on a local production build against the live database and 41 checks in headless Chrome, all passing; my throwaway accounts, vendors and events deleted afterwards. Create form: text input with a 60-character limit, label and hint, the wedding template leaves it empty, a created event shows `Wedding · date · Laguna`. Edit: the saved area is shown, change and clear save and show on the plan, an unchanged form says "No changes to save". API: 60 characters (accented) accepted; 61, numbers, objects, arrays and booleans refused naming `area`; trimmed; a field left out stays; clear with "" and null; area on the list, plan and dashboard; vendor 403; logged out 401; and the database refusing 61 characters through the Supabase client. 375px: no overflow on create, edit, vendor list and plan.
