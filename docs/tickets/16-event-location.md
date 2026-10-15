# 16 — Events have a location

**What to build:** When creating or editing an event, a customer can pick where it takes place from a fixed list of areas, change it later or clear it. The plan shows it.

**Blocked by:** None

**Status:** not started

- [ ] The create and edit forms have a "Location (optional)" select with "Not set" and every area; a template doesn't change it
- [ ] The location is saved, changed and cleared; the edit page sends it only when it changed
- [ ] A value that isn't an area is refused with the error naming `location`, and nothing is saved
- [ ] The database itself refuses a location outside the list
- [ ] The plan header shows the location after the date when it is set
- [ ] Existing events keep working with no location
- [ ] Works at phone width
