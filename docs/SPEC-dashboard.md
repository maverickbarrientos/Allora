# SPEC-dashboard.md

## Goal
A customer dashboard for one selected event: how long until it, how its bookings stand, what needs doing, and which services are still missing.

## Out of scope
Budget overview, vendor dashboard, editing from the dashboard, AI text, new tables or SQL, notifications, charts, new dependencies.

## Rules
- Deterministic only. The handler never calls the LLM.
- Reuse existing code, never copy it: the gap and share functions in src/lib/matching/ (including set budgets) and the payment status logic from payments. A category with no pending or confirmed booking is a gap.
- Dates are plain "YYYY-MM-DD" strings. The countdown is computed in the browser from the event's date and the local calendar date, using year, month and day parts only (no new Date("YYYY-MM-DD"), no toISOString, no timezone conversion). The server does not compute it.
- Assumption: the picker uses the existing GET /api/events (ordered by date). The client puts upcoming events (date today or later) first, soonest first, then past events, most recent first.
- Assumption: the default event is the first upcoming one, otherwise the most recent past one. The selection is kept in the URL as `?event=<id>`.

## User flow
1. The customer opens `/dashboard` from the sidebar. The page loads their events and shows the default event.
2. The picker lists every event with its name, date and countdown text. Changing it updates `?event=` and the page.
3. The page shows the countdown, booking counts by status, "Actions needed" and "Missing services".
4. Each action and missing service links to where it can be done.

## Data and tables
No new tables, SQL or RLS changes. The handler reads the caller's own event, its bookings, vendor names, payments and budgets with the signed-in user's session client.

## Shared shapes
- `Event` as in SPEC-event-upgrades.md.
- `DashboardAction` = `{ type: "pay_deposit" | "find_replacement" | "awaiting_vendor", bookingId, vendorName, category, amount: number | null }`. `amount` is the deposit amount for pay_deposit, otherwise null.
- `MissingService` = `{ category, budgetShare: number }` (2 decimals)
- Error body, 401 and 403 as in earlier specs.

## API
Requires a session. Logged-out requests return 401 `unauthorized`. Vendor-role callers get 403 `forbidden`.

### GET /api/events/:id/dashboard
- 200: `{ event: Event, bookingCounts: { pending, confirmed, declined }, actions: DashboardAction[], missing: MissingService[] }`
- `bookingCounts`: integers over all the event's bookings.
- `actions` (Assumption): for each booking:
  - confirmed and not currently paid (no active paid deposit, so a re-confirmed booking with a refunded deposit counts): `pay_deposit`, amount = the current deposit.
  - declined and its category is a gap: `find_replacement`.
  - pending: `awaiting_vendor`.
  - Order: pay_deposit, find_replacement, awaiting_vendor, then by booking createdAt ascending.
- `missing`: the event's gaps in checklist order, with the share from the existing matching code.
- 404 `event_not_found`: missing, not the caller's, or malformed id
- 403 `forbidden`, 500 `server_error`

## UI screens and states
- Sidebar: "Dashboard" is the first customer item (see DESIGN.md).
- `/dashboard`:
  - Events loading: skeletons. No events: "No events yet" with a link to `/events/new`. Events error: message with retry.
  - Picker: one row per event, name (truncated, full name in the title attribute), date and countdown text. Upcoming and past are grouped.
  - Countdown card: "{n} days to go", "Tomorrow", "Today", "Happened {n} days ago". Singular and plural correct.
  - Counts: three numbers with text labels, never only color.
  - Actions needed: rows with the action text and a link. pay_deposit "Pay deposit of {amount} to {vendor}" links to `/events/[id]/bookings/[bookingId]/pay`. find_replacement "{vendor} declined. Find another {category}" links to `/events/[id]/vendors?category=...`. awaiting_vendor "Waiting for {vendor} to respond ({category})" links to `/events/[id]`. Empty: "Nothing needs your attention".
  - Missing services: rows with category and share, linking to `/events/[id]/vendors?category=...`, and a "See suggestions" link to `/events/[id]`. Empty: "Every service has a booking".
  - Each section has its own loading and error state with retry. A failing section never blocks the others or the picker. A 404 shows the not-found page.
  - Switching events quickly ignores stale responses.
- `/events/[id]/vendors` reads an optional `?category=` to preselect the category tab. An unknown value falls back to "All".
- All text is plain text. Numbers are plain with thousands separators, no currency symbol.

## Acceptance criteria
1. Customers see Dashboard first in the sidebar. Vendors never see it and are redirected from `/dashboard`.
2. The default event is the next upcoming one, or the latest past one. The picker lists all events, upcoming first with countdown text. Switching updates the URL and content, and a reload keeps the selection. Someone else's or a made-up event id shows the not-found page.
3. The countdown is correct for today, tomorrow, later and past dates, and never shifts by a day in any timezone.
4. The counts match the plan page.
5. Actions follow the rules exactly, including: a declined booking whose category has a pending or confirmed replacement gives no action; a re-confirmed booking with a refunded deposit gives pay_deposit; a paid booking gives none.
6. The missing list equals the "What's missing" cards' categories and shares for the same event, and booking a vendor removes its category on the next load.
7. The endpoint makes no LLM call.
8. Auth: logged-out 401, vendor-role 403, another customer's event 404.
9. Empty states: no events, an event with no bookings, an event with everything booked.
10. No new table, dependency or `service_role` key.