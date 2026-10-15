# 25 — Vendors say which area they serve

**What to build:** On their profile a vendor can type the area they serve, change it or clear it. Their free-text location stays as it is.

**Blocked by:** 24

**Status:** done

- [x] The profile page has an "Area you serve (optional)" text field (up to 60 characters) below Location
- [x] Saving, changing and clearing the area works; one over 60 characters is refused with the error next to the field and nothing is saved
- [x] Location still saves, changes and clears as before
- [x] The database itself refuses a vendor area over 60 characters
- [x] An area already stored for a vendor is kept by the migration
- [x] Works at phone width

**Tests (2026-10-16):** `028_event_area.sql` run on the live project twice with no errors; existing `area` data unchanged (2 events, 1 vendor). 58 API checks on a local production build against the live database and 41 checks in headless Chrome, all passing; my throwaway accounts, vendors and events deleted afterwards. Profile page: Location is still a text field, the new Area field has the right label and limit, the saved area shows, change and clear persist after reload; 375px no overflow. API: a 61-character, numeric or object area is refused naming `area` with nothing saved; Location still stops at 80 and changes without touching the area; the vendor page endpoint returns `area`. The error text next to the Area field was not checked in the browser (the server refusal was).
