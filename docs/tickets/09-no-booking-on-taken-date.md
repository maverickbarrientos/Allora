# 09 — Customers can't book a vendor on a taken date

**What to build:** A vendor is unavailable on dates they blocked and on dates of their confirmed bookings. A customer can't book a vendor on an unavailable date: the vendor card says "Unavailable on {date}", the Book button is disabled with "Not available on your event date", and the calendar dialog shows the blocked dates too.

**Blocked by:** 08

**Status:** todo

- [x] Availability counts both blocked dates and confirmed bookings, from one shared rule
- [x] Vendor cards show "Available on {date}" or "Unavailable on {date}", and Book is disabled with a short reason when unavailable
- [x] The calendar dialog marks blocked dates as unavailable and shows only dates, never reasons or other customers' details
- [x] Booking an unavailable vendor is refused with a clear message and nothing is created, also through the Supabase client directly; booking from a "What's missing" card shows the same message
- [x] Pending bookings on a date don't make it unavailable
- [x] Dates that already had two confirmed bookings still load on both calendars and show as unavailable
- [x] Dates never shift by a day in any timezone
- [ ] Works on the live URL

**Notes (2026-10-16):** Built in `73ea929` on `feature/availability-blocking`; `016_booking_availability.sql` applied to the live project (run twice). Tested on a production build against the live project with throwaway accounts (deleted afterwards): 23 API checks (blocked and confirmed dates refuse a booking with `vendor_unavailable`, also through the Supabase client; pending bookings never block; `already_booked` still wins; unblocking makes the date bookable again; availability returns only dates; an old double-confirmed date, 2029-06-10, loads once as unavailable; 401 and 403) and 14 browser checks (card text, Book disabled with the reason, "View calendar" opens the dialog with the date marked and Confirm disabled, no reasons or names in the dialog, a vendor blocking the date while the dialog is open shows "no longer available" and books nothing, 375px). The "What's missing" cards use the same dialog, so they show the same message; not run separately. Still to check on the preview URL.
