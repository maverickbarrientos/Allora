# 11 — An event's date is locked once it has a confirmed booking

**What to build:** A customer can't change the date of an event that has a confirmed booking, because the vendor confirmed that specific date. The edit page shows "This event has confirmed bookings, so its date can't change." next to the date field and keeps what was typed.

**Blocked by:** 10

**Status:** todo

- [ ] Changing the date of an event with a confirmed booking is refused with the message next to the date field; nothing in that save is changed
- [ ] Events with only pending or declined bookings can still change their date
- [ ] Other edits (name, budget, notes, type) still work on an event with confirmed bookings
- [ ] A date change and a confirm at the same moment never leave a confirmed booking on a date different from its event's
- [ ] Works on the live URL
