# SPEC-vendor-dashboard.md

## Goal
A vendor dashboard for one month at a time: confirmed bookings with a countdown, bookings by status, actions needed, and the month's booked and blocked days. Frontend only.

## Out of scope
New endpoints, tables or SQL, earnings or deposit totals, charts, notifications, event names or notes, changing booking status from the dashboard, new dependencies.

## Data (existing contracts only)
- GET /api/vendor/bookings (SPEC-vendor-upgrades.md, plus the payment field from SPEC-payments.md if payments is on main).
- GET /api/vendor/availability?from=&to= (SPEC-availability.md) for blocked dates. from = the first day of the month, to = the last day.
- The vendor's name from GET /api/vendor/profile or the bookings response, whichever the existing pages use.
- If the payment field is absent, leave out "awaiting deposit". If the availability route is absent, leave out blocked days. Say so in the UI as nothing, not as an error.

## Rules
- Dates are plain "YYYY-MM-DD" strings. A booking belongs to the month of its event date. The month, today and countdowns use year, month and day parts of the local calendar date only (no new Date("YYYY-MM-DD"), no toISOString, no timezone conversion). Reuse the shared date helper from the customer dashboard if it exists.
- Assumption: the default month is the current local month. The selection is kept in the URL as `?month=YYYY-MM`. An invalid value falls back to the current month.
- Counts: pending, confirmed and declined bookings in the month.
- Actions (Assumption): "Respond to {customer}'s {event type} booking on {date}" for each pending booking in the month, linking to `/vendor/bookings#booking-{id}`. "Awaiting deposit from {customer} ({date})" for each confirmed booking in the month whose payment status is not "paid", linking to the same anchor. Respond actions come first, then awaiting deposit, each by event date.
- Confirmed this month: confirmed bookings in the month by event date, with countdown text: "In {n} days", "Tomorrow", "Today", "Yesterday", "{n} days ago", and the deposit status in text if payments exists.
- Month at a glance: a read-only mini month grid (reuse the existing calendar grid component in a read-only mode; no new dependency) marking confirmed, pending and blocked days in text and pattern, not only color, and the counts "{n} booked days, {n} days with pending requests, {n} blocked days". A link "Open calendar" goes to `/vendor/calendar?month=YYYY-MM`.

## Routes and navigation
- `/vendor` is the dashboard. The bookings list page moves to `/vendor/bookings`, unchanged apart from the route and an `id="booking-{id}"` anchor on each row.
- Update every link that points to the bookings list. Links that mean "vendor home" stay `/vendor`.
- Redirects stay: a customer-role user on any `/vendor` page goes to `/`. An unlinked vendor goes to `/vendor/profile`.
- `/vendor/calendar` reads an optional `?month=YYYY-MM` to open on that month.
- Sidebar: Dashboard (/vendor, active only on exactly /vendor), Bookings, Calendar, Profile.

## UI states
- Month picker: previous, next, "This month". Switching updates the URL and the content, and stale responses are ignored.
- Each section has its own loading and error state with retry. A failing section never blocks the others or the picker.
- Empty: "No bookings in {Month YYYY}" for the lists, "Nothing needs your attention" for actions.
- All text is plain text. Customer names truncate in lists with the full name in the title attribute. Numbers are plain, no currency symbol.

## Acceptance criteria
1. Vendors see Dashboard first in the sidebar and land on it at `/vendor`. The bookings list works at `/vendor/bookings`, and every link to it is updated.
2. The default month is the current month. Previous, next, "This month" and a reload with `?month=` all work. An invalid month falls back.
3. Counts, actions and the confirmed list match the bookings list filtered to that month.
4. Countdowns are correct for past, today, tomorrow and future dates, and never shift by a day in any timezone. A booking dated on the 1st or the last day of a month lands in the right month.
5. The mini grid matches the full calendar page for the same month, and "Open calendar" opens that month.
6. Actions link to the right booking row on `/vendor/bookings`.
7. Customer-role users are redirected from every `/vendor` page. Unlinked vendors go to the profile page.
8. No event name or notes anywhere. No new endpoint, table