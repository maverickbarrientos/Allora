# 11 — An event's date is locked once it has a confirmed booking

**What to build:** A customer can't change the date of an event that has a confirmed booking, because the vendor confirmed that specific date. The edit page shows "This event has confirmed bookings, so its date can't change." next to the date field and keeps what was typed.

**Blocked by:** 10

**Status:** done

- [x] Changing the date of an event with a confirmed booking is refused with the message next to the date field; nothing in that save is changed
- [x] Events with only pending or declined bookings can still change their date
- [x] Other edits (name, budget, notes, type) still work on an event with confirmed bookings
- [x] A date change and a confirm at the same moment never leave a confirmed booking on a date different from its event's
- [x] Works on the live URL

**Notes (2026-10-16):** Built in `f38e1b0` on `feature/availability-blocking`; `018_event_date_lock.sql` applied to the live project (run twice). Tested on a production build against the live project with throwaway accounts (deleted afterwards): 18 API checks (refused with a confirmed booking, also through the Supabase client; date plus name refused together; same date is not a change; name, budget, notes, type and guests still editable; pending-only, declined-only and cancelled bookings allow a date change; three rounds of a confirm racing a date change to a blocked day, never ending in a confirmed booking on the blocked date) and 9 browser checks (message next to the date, typed values kept, nothing saved, 1280px and 375px). Still to check on the preview URL.

Checked on the live site and marked done by the team on 2026-10-16.
