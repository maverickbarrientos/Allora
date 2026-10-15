# 17 — Vendors pick the area they serve

**What to build:** A vendor's location is no longer free text: on their profile they pick the area they serve from the same list as events, or leave it unset. Existing free-text locations are mapped to an area where possible.

**Blocked by:** 16

**Status:** not started

- [ ] The profile page's Location field is a select labelled "Area you serve (optional)", with "Not set" and every area
- [ ] Picking, changing and clearing the area saves; free text is refused with the error next to the field
- [ ] The migration maps existing locations: an area name in any case becomes that area, a Metro Manila city becomes Metro Manila, anything else is cleared
- [ ] The database itself refuses a vendor location outside the list
- [ ] Vendor cards and the vendor page show the area as before
