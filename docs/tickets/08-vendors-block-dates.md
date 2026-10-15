# 08 — Vendors block and unblock dates

**What to build:** A vendor opens their calendar, selects one or more days and presses "Block selected" or "Unblock selected". Blocked days stay blocked after a reload and show as Blocked on the calendar and in the dashboard's "Month at a glance". A date that already has a confirmed booking can't be blocked.

**Blocked by:** None

**Status:** todo

- [ ] A new blocked-dates table exists with Row Level Security on: only the owning vendor can read, add and remove their blocked dates; customers and other vendors see nothing
- [ ] Click or Space selects days; "Block selected" and "Unblock selected" show the count; days with a confirmed booking can't be selected for blocking
- [ ] Blocking and unblocking persist across reloads, and a batch of 1 to 62 dates applies all or nothing
- [ ] Blocking a date with a confirmed booking is refused with a message listing the dates, nothing changes, and the selection stays; also refused through the Supabase client directly
- [ ] The calendar shows Blocked, Confirmed and Pending in text with a pattern (not only colour), and never shows declined bookings
- [ ] The dashboard's "Month at a glance" shows blocked days
- [ ] Customers get "forbidden" on the vendor routes, logged out gets "unauthorized"
- [ ] Works on the live URL
