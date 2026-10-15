# 09 — Customers can't book a vendor on a taken date

**What to build:** A vendor is unavailable on dates they blocked and on dates of their confirmed bookings. A customer can't book a vendor on an unavailable date: the vendor card says "Unavailable on {date}", the Book button is disabled with "Not available on your event date", and the calendar dialog shows the blocked dates too.

**Blocked by:** 08

**Status:** todo

- [ ] Availability counts both blocked dates and confirmed bookings, from one shared rule
- [ ] Vendor cards show "Available on {date}" or "Unavailable on {date}", and Book is disabled with a short reason when unavailable
- [ ] The calendar dialog marks blocked dates as unavailable and shows only dates, never reasons or other customers' details
- [ ] Booking an unavailable vendor is refused with a clear message and nothing is created, also through the Supabase client directly; booking from a "What's missing" card shows the same message
- [ ] Pending bookings on a date don't make it unavailable
- [ ] Dates that already had two confirmed bookings still load on both calendars and show as unavailable
- [ ] Dates never shift by a day in any timezone
- [ ] Works on the live URL
