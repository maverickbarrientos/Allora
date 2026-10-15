# 08 — Vendors block and unblock dates

**What to build:** A vendor opens their calendar, selects one or more days and presses "Block selected" or "Unblock selected". Blocked days stay blocked after a reload and show as Blocked on the calendar and in the dashboard's "Month at a glance". A date that already has a confirmed booking can't be blocked.

**Blocked by:** None

**Status:** done

- [x] A new blocked-dates table exists with Row Level Security on: only the owning vendor can read, add and remove their blocked dates; customers and other vendors see nothing
- [x] Click or Space selects days; "Block selected" and "Unblock selected" show the count; days with a confirmed booking can't be selected for blocking
- [x] Blocking and unblocking persist across reloads, and a batch of 1 to 62 dates applies all or nothing
- [x] Blocking a date with a confirmed booking is refused with a message listing the dates, nothing changes, and the selection stays; also refused through the Supabase client directly
- [x] The calendar shows Blocked, Confirmed and Pending in text with a pattern (not only colour), and never shows declined bookings
- [x] The dashboard's "Month at a glance" shows blocked days
- [x] Customers get "forbidden" on the vendor routes, logged out gets "unauthorized"
- [x] Works on the live URL

**Notes (2026-10-16):** Built in `f1e12e1` on `feature/availability-blocking`; `014_blocked_dates.sql` applied to the live project (run twice). Tested on a production build against the live project with throwaway accounts (deleted afterwards): 47 API checks (block, unblock, all-or-nothing with every conflicting date named, 1 to 62 limits, 401/403/404, RLS through the Supabase client, the trigger on direct inserts, no updates) and 20 browser checks in headless Chrome (labels, click and Space selection, confirmed days not selectable, side panel, block and unblock with reload, a 409 caused behind the page keeps the selection, dashboard shows blocked days, 375px). Fixed during testing: selected days looked like the "Today" mark, so they are now filled and labelled "Selected". Still to check on the preview URL.

Checked on the live site and marked done by the team on 2026-10-16.
