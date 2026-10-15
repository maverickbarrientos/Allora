# 26 — Customers see the vendors in their event's area

**What to build:** On the vendor list for an event with an area, the customer sees only the vendors in that area (plus those with no area set), and can switch that off to see everyone.

**Blocked by:** 24, 25

**Status:** built; empty state and keyboard not exercised

- [x] `GET /api/vendors` takes an optional `area`; it returns the vendors in that area (ignoring case and accents) and those with no area; an empty value means everyone; one over 60 characters is refused
- [x] An event with an area shows "Only vendors in {area}", on by default, with a note that vendors with no area are included
- [x] Turning it off shows every vendor; the choice stays across category tabs
- [ ] A category with nothing in the area says so and offers "Show vendors from every area"
- [x] An event with no area shows no filter, and a link to add an area on the edit page
- [ ] Works at phone width and with the keyboard

**Tests (2026-10-16):** `028_event_area.sql` run on the live project twice with no errors; existing `area` data unchanged (2 events, 1 vendor). 58 API checks on a local production build against the live database and 41 checks in headless Chrome, all passing; my throwaway accounts, vendors and events deleted afterwards. API: `Parañaque`, `paranaque`, `PARAÑAQUE` and ` paraNaque ` all return the Parañaque vendor and every vendor with no area (counted against the full list), `Cavite` excludes it, an empty value returns everyone, 61 characters is 400, and it combines with `category` and `eventId`. Browser: the Cavite event shows the checkbox on by default with the label and note, hides the other area's vendor, unchecking shows it and hides the note, the choice stays after a tab change; the no-area event has no checkbox and its link goes to the edit page. NOT checked: the empty state ("No vendors in {area} for this category"), because vendors with no area always match and tabs only list categories that have vendors, so it can't be reached with the current data; and keyboard use of the checkbox. 375px: no overflow.
