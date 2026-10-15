# 18 — Customers see the vendors in their event's area

**What to build:** On the vendor list for an event with a location, the customer sees only the vendors in that area (plus those with no area set), and can switch that off to see everyone.

**Blocked by:** 16, 17

**Status:** not started

- [ ] `GET /api/vendors` takes an optional `location`; it returns the vendors in that area and those with no area; an empty value means everyone; an unknown area is refused
- [ ] An event with a location shows "Only vendors in {area}", on by default, with a note that vendors with no area are included
- [ ] Turning it off shows every vendor; the choice stays across category tabs
- [ ] A category with nothing in the area says so and offers "Show vendors from every area"
- [ ] An event with no location shows no filter, and a link to add a location on the edit page
- [ ] Works at phone width and with the keyboard
