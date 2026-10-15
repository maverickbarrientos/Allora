# SPEC-event-delete.md

## Goal
A customer can edit an event and delete it when the rules allow. Edit is already specced in SPEC-event-upgrades.md (PATCH /api/events/:id and /events/[id]/edit) and is not changed here, except for the entry points below.

## Supersedes
- SPEC-events-booking.md and SPEC-event-upgrades.md: "deleting events" is no longer out of scope.

## Out of scope
Archiving or soft delete, restoring, bulk delete, customer cancelling bookings, notifying vendors, deleting payments separately, keeping history for vendors, new tables or dependencies.

## Rules
- Active bookings are pending and confirmed ones. Declined bookings are not active. (Assumption)
- An event is finished when its date is before the database's current date (UTC, no time of day). An event dated today is not finished. (Assumption)
- Delete is allowed if and only if the event has no pending booking, and either has no confirmed booking or is finished. Any pending booking always blocks it.
- Check order: pending first (`event_has_pending_bookings`), then confirmed and not finished (`event_not_finished`).
- Deleting removes the event and, by the existing cascades, all its bookings (any status), their payments and its service budgets. Assumption: demo payment records go with them, and the vendor's booking history for that event disappears.
- The rule lives only in the database trigger. Handlers and the UI never recompute it for enforcement. The UI computes it only to explain why the button is disabled.

## User flow
1. The customer opens `/events/[id]/edit` from the plan page or from the events list.
2. At the bottom is a "Delete event" section. If the rules allow it, the button is enabled. Otherwise it is disabled with the reason in text.
3. The customer confirms in a dialog that says what will be deleted. On success they return to `/` with the message "Event deleted".

## Data and tables
- No new tables. Next free numbered file in `supabase/sql/`, safe to rerun, never edit earlier files:
  - Trigger before delete on `events` (security definer, empty search_path). It first locks the event row (`select ... for update`), then counts that event's bookings by status. If any is pending, raise `event_has_pending_bookings`. Else if any is confirmed and the event date is not before `current_date`, raise `event_not_finished`.
  - Make sure the authenticated role has DELETE on `events` (earlier column grants only limited UPDATE) and that a DELETE policy for the owner exists.
- Existing cascades are relied on: bookings.event_id, payments.booking_id and event_budgets.event_id are all `on delete cascade`. Check this and report if one is not.

## RLS
- `events` DELETE: `owner = auth.uid()`. The trigger applies to every delete, including direct client calls.

## API
Requires a session. Logged-out requests return 401 `unauthorized`. Vendor-role callers get 403 `forbidden`.

### DELETE /api/events/:id
- 204, no body.
- 404 `event_not_found`: missing, not the caller's, malformed id, or already deleted
- 409 `event_has_pending_bookings`: the message gives the number of pending bookings
- 409 `event_not_finished`: the event has confirmed bookings and hasn't finished. The message includes the event's date.
- 403, 500 `server_error`
- Two simultaneous deletes: one 204, the other 404.

## UI screens and states
- `/events/[id]/edit`: a separated "Delete event" section at the bottom, with brick-colored text and a hairline above.
  - Enabled when the plan data already loaded shows no pending booking and (no confirmed booking or the date is past, using the local calendar date for display only).
  - Disabled reasons, in text: "Waiting for vendors to respond to {n} pending booking(s)." or "This event has confirmed bookings and hasn't happened yet. You can delete it after {date}."
  - Confirmation (shadcn AlertDialog): names the event and says what will be removed: "{n} booking(s), deposit records and service budgets". Cancel and "Delete event". The button shows a deleting state and disables the dialog.
  - Server 409s show a message in the dialog and refresh the plan data. 404 redirects to `/` (it's already gone). Other errors show a message and keep the page.
  - Success: redirect to `/` with "Event deleted".
- Entry points: an "Edit" link on each event card on `/` and on the plan page header (if not there already).
- Dashboard: if the selected event no longer exists, fall back to the default selection instead of an error.
- The event name renders as plain text, never HTML.

## Acceptance criteria
1. An event with no bookings can be deleted, upcoming or finished. After deleting, it's gone from `/`, the picker and the plan URL (404).
2. An event with only declined bookings can be deleted. The declined bookings are removed with it.
3. An event with a pending booking can't be deleted, finished or not (409 `event_has_pending_bookings`). It becomes deletable after the vendor confirms or declines it, subject to the next rules.
4. An event with a confirmed booking that hasn't finished returns 409 `event_not_finished`. The same event after its date has passed can be deleted.
5. Deleting removes the event's bookings, payments and service budgets, and nothing else. Other events, vendors and vendor blocked dates are unchanged. The vendor no longer sees those bookings.
6. The rules hold for direct Supabase client deletes (the trigger), not only the API.
7. Two simultaneous requests, one deleting and one booking a vendor for the same event: either the booking is rejected or the delete is rejected with 409. Never a booking left without an event.
8. RLS: customer A cannot delete B's event (404). Vendors cannot delete events (403).
9. Edit still works from the new entry points (name, type, date, guest count, budget, notes), with the earlier 409 rules.
10. No new table, dependency or `service_role` key.