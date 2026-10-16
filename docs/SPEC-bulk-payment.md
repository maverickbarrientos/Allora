# SPEC-bulk-payment.md


## Goal
A customer ticks several confirmed bookings on the event plan, sees the total price and what is due now, and pays them all in one action (deposit or full, one choice for all) through the same fake provider. No new table, no real money.


## Supersedes
- SPEC-payment.md: adds one batch endpoint and one SQL function. Single payments (`POST /api/bookings/:id/pay`, `pay_booking`) are unchanged and still used by the pay page.
- No other contract changes.


## Out of scope
Paying bookings of different events together, choosing deposit for some and full for others in one batch, partial success, real provider, card fields.


## Rules
- All or nothing: if one booking is refused, none of the batch is paid.
- Each booking is paid by `pay_booking()` (029), so every rule in SPEC-payment.md applies per booking: confirmed only, ownership, deposit = `deposit_for(price)`, full = current price, balance = current price minus what was paid.
- Kind per booking: if its deposit is already paid, it pays the **balance**, whatever the batch plan says. Otherwise it pays the batch plan (`deposit` or `full`).
- One demo charge for the whole batch. A decline records nothing.
- 1 to 20 different bookings per request, all on the event in the URL.
- Amounts and references are never read from the request. Each payment's reference is the batch reference plus `-n`.
- Payment data is never sent to the LLM.


## User flow
1. The plan shows totals: Total booked, Paid so far, Left to pay, Waiting for vendors.
2. Confirmed bookings that still owe money have a tick box. "Select all payable" ticks them all.
3. A bar at the bottom shows how many are ticked, their total price and what is due now, with a Deposit / Pay in full choice and a Pay button.
4. A dialog lists each booking with its amount and the total, the demo notice, and an Approve / Decline test choice. Confirm pays.
5. Approve updates every row and the totals and clears the ticks. Decline keeps the ticks and shows "Payment declined". A refused booking shows which vendor and why, and nothing is paid.


## Data and tables
- No new table.
- `pay_bookings(p_booking_ids uuid[], p_kinds text[], p_reference text) returns setof payments`: security definer, empty search_path, execute only for authenticated. `p_kinds[i]` is the kind for `p_booking_ids[i]` (`deposit`, `full` or `balance`); the route picks it from what is already paid (a booking with a paid deposit gets `balance`, any other gets the batch plan), so the database never guesses and two identical requests at the same time cannot both pay. Checks: caller is a customer, reference not empty, 1 to 20 non-null different ids with one kind each (`invalid_booking_ids`, `invalid_kind`). Loops in id order and calls `pay_booking()` for each. On any error it re-raises the same message and code with the failing booking id in `detail`, which rolls the whole batch back.
- File: `supabase/sql/032_pay_bookings.sql`. Safe to run more than once.


## Shared shapes
- Request: `{ bookingIds: string[], plan?: "deposit" | "full", testMethod: "approve" | "decline" }` (plan defaults to deposit)
- Response 201: `{ payments: Payment[], bookings: PlanBooking[] }` (`bookings` in booking creation order, with the new `payment`)
- Error body as in earlier specs.


## API
Requires a session. Logged-out requests return 401 `unauthorized`.

### POST /api/events/:id/payments
- 201: as above
- 400 `validation_error`: bad testMethod or plan, bookingIds not an array of 1 to 20 different uuids, invalid JSON
- 401 `unauthorized`, 403 `forbidden` (vendor role)
- 402 `payment_declined`: testMethod "decline". Nothing is recorded.
- 404 `event_not_found`: missing, not the caller's, or malformed id
- 404 `booking_not_found`: a booking is missing, not the caller's, or on another event
- 409 `booking_not_confirmed`, 409 `already_paid`, 409 `nothing_due`: the message names the vendor. Nothing is recorded.
- 500 `server_error`
- Order: validation, event, bookings, status and already-paid checks, then the demo provider, then `pay_bookings` (checks everything again).


## UI screens and states
- Totals strip: four figures from the plan data, summed in cents. Declined and cancelled bookings are not counted. Text, not colour alone.
- Rows: a tick box on payable rows, a note on pending rows. The single "Pay deposit" and "Pay balance" links stay.
- Bar: hidden when nothing is ticked, 44px targets, a live region for the figures, reduced motion respected, no overlap with the page content (bottom padding).
- Dialog: loading (submitting, controls disabled), declined, error with the vendor name, success summary with receipt links.
- Amounts are plain numbers with thousands separators, no currency symbol. The server sets the final amounts; the bar and dialog show a preview.


## Acceptance criteria
1. A batch of three confirmed unpaid bookings with plan deposit records three deposits of 30% each, one request, and the plan shows all three "Deposit paid".
2. Plan full records three payments of the full price and shows "Paid in full".
3. A mixed batch (one with a deposit already paid, two unpaid) pays the balance for the first and the chosen plan for the others.
4. A pending, declined or already fully paid booking in the batch returns 409 and none of the others is paid.
5. A booking of another customer, or of another event, returns 404 and nothing is paid.
6. 0 ids, 21 ids, duplicate ids, a non-uuid id, a bad plan, a bad testMethod: 400.
7. "decline" returns 402 and records nothing.
8. Repeating a deposit batch pays the balances (the deposit is already paid). Repeating a full batch, or a batch of fully paid bookings: 409 `already_paid`. Two simultaneous identical requests: one 201, one 409, no double payment.
9. A vendor declining one booking at the same time as the batch: never a paid payment on a declined booking (SPEC-payment.md criterion 6 still holds).
10. RLS: nobody can insert payments directly; vendor, anon and another customer cannot call `pay_bookings` for these bookings. Logged-out 401, vendor 403.
11. The totals on the plan equal the sum of the rows and update after paying.
12. No card fields, no payment data in LLM input, no `service_role` key.
