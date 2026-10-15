# 18 — Customers see the vendors in their event's area

**What to build:** On the vendor list for an event with a location, the customer sees only the vendors in that area (plus those with no area set), and can switch that off to see everyone.

**Blocked by:** 16, 17

**Status:** built; empty state not exercised

- [x] `GET /api/vendors` takes an optional `location`; it returns the vendors in that area and those with no area; an empty value means everyone; an unknown area is refused
- [x] An event with a location shows "Only vendors in {area}", on by default, with a note that vendors with no area are included
- [x] Turning it off shows every vendor; the choice stays across category tabs
- [ ] A category with nothing in the area says so and offers "Show vendors from every area"
- [x] An event with no location shows no filter, and a link to add a location on the edit page
- [x] Works at phone width and with the keyboard

**Notes (2026-10-16):** API checks: Cavite returns only Cavite and no-area vendors (the same count as filtering all vendors by hand), a Cebu vendor appears for Cebu and not for Cavite, an empty value returns everyone, `Mars` is 400, and it combines with `category` and `eventId`. The browse page changes (checkbox on by default, note, empty state, add-a-location link, choice kept across tabs) are built and typecheck but not checked in a browser.

**Browser check (2026-10-16):** 39 checks in headless Chrome against a production build and the live project, all passing; throwaway accounts, vendors and events deleted afterwards. Cavite event: checkbox on by default, label and note shown, the Cavite vendor and the area-less seeded venues show and the Cebu vendor doesn't; unchecking shows the Cebu vendor and hides the note; the choice stays after switching tab. No-location event: no checkbox, the link goes to its edit page, every vendor shows. 375px no overflow. NOT checked: the empty state ("No vendors in {area} for this category" and its button): vendors with no area always match and tabs only list categories that have vendors, so it can't be reached with the current data.
