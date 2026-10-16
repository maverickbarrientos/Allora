# SPEC-payments.md


## Goal
A customer pays a demo deposit, the full price, or the deposit and then the balance, for a confirmed booking through a fake payment provider. The vendor sees the payment status. No real money and no card data.


## Supersedes
- SPEC-events-booking.md: `PlanBooking` gains `payment`.
- SPEC-vendor-upgrades.md: `VendorBooking` gains `payment`.
- No other contract changes.


## Out of scope
Platform fees, vendor payouts, email receipts, customer cancellations, partial refunds, currency, real provider, card fields, storing card data.


## Rules
- Full payment (migration 029_full_payment.sql): each payment has a `kind`: `deposit`, `full` or `balance`. `deposit` and `full` need no paid payment on the booking yet. `balance` needs a paid deposit and no paid balance. A booking is "fully paid" once it has a paid `full` or `balance` payment.
- Amounts: `deposit` = `deposit_for(price)`. `full` = the vendor's current price. `balance` = current price minus everything already paid on the booking (so a price change after the deposit cannot over- or under-charge). If that is 0 or less, there is nothing due.
- Declining a booking refunds all of its paid payments (deposit and balance) in the same transaction.
- Only a confirmed booking can be paid. Each kind at most once, as above. Deposit = round(vendor price x 30%, 2), using the vendor's current price at payment time. Assumption: 30% is a placeholder.
- The deposit rule lives only in the SQL function `deposit_for(price)`. Handlers use it, never recompute it.
- Assumption: payment status for a booking: "paid" if an active paid payment exists; else "refunded" if the latest payment was refunded; else "unpaid".
- Assumption: the fake provider is the only code that decides success. `testMethod` "approve" succeeds and "decline" fails. Anything else is a validation error. Never send or store card details.
- Assumption: when a vendor sets a paid booking to declined, its payment is refunded in the same transaction. Declined then confirmed again can be paid again.
- Payment data is never sent to the LLM.


## User flow
1. A confirmed, unpaid booking on the plan shows "Pay deposit" with the amount.
2. `/events/[id]/bookings/[bookingId]/pay`: summary (vendor, category, price, deposit), a choice of "Deposit" (balance later) or "Full amount" when nothing is paid yet, or only the balance when a deposit is paid, a banner "Demo payment: no real money, do not enter card details", a test outcome choice (Approve or Decline) and a Pay button.
3. Approve shows a receipt titled "Deposit paid", "Payment complete" or "Balance paid" (amount, reference, date) and a link back to the plan, where the booking shows "Deposit paid". Decline shows "Payment declined" and the customer can retry.
4. The vendor sees "Deposit paid" on that booking in the portal. If the vendor later declines it, the customer's deposit shows "Refunded".


## Data and tables
- `payments`: id (uuid PK), booking_id (references bookings, on delete cascade), amount (numeric, not null, > 0), status (text, not null, check in paid, refunded), reference (text, not null), created_at, refunded_at (null). `kind` (text, not null, default deposit, check in deposit, full, balance). Unique partial index on (booking_id, kind) where status = 'paid'.
- `deposit_for(price numeric) returns numeric`: immutable, 30%, rounded to 2 decimals.
- `pay_booking(p_booking_id uuid, p_reference text, p_kind text default 'deposit')`: security definer, empty search_path, uses `auth.uid()`, execute only for authenticated (revoked from public and anon). Locks the booking row. Checks: caller is a customer and owns the booking's event (else error `booking_not_found`), status is confirmed (`booking_not_confirmed`), the kind rules above (`already_paid`, `nothing_due`, `invalid_kind`). Inserts a paid payment of that kind with the amount from the rules above. Returns the payment.
- Trigger on `bookings` after update of status: when the new status is declined, mark that booking's paid payment refunded with refunded_at = now(). Security definer, empty search_path.
- Safe to rerun. Never edit earlier SQL files.


## RLS (payments)
- Enable RLS. SELECT for the customer who owns the booking's event, and for the vendor who owns the booking's vendor. No INSERT, UPDATE or DELETE policy for anyone. Revoke write grants from anon and authenticated.


## Shared shapes
- `Payment` = `{ id, bookingId, kind: "deposit" | "full" | "balance", amount: number, status: "paid" | "refunded", reference, createdAt, refundedAt: string | null }`
- `PlanBooking` gains `payment: { status: "unpaid" | "paid" | "refunded", depositAmount: number, paidAmount: number | null, paidAt: string | null, fullyPaid: boolean, balanceDue: number }` (paidAmount is the sum of paid payments; balanceDue is the price minus that when only a deposit is paid, else 0; depositAmount is the current deposit from `deposit_for`)
- `VendorBooking` gains `payment: { status: "unpaid" | "paid" | "refunded", paidAmount: number | null, fullyPaid: boolean }` (never the reference)
- Error body, 401 and 403 as in earlier specs.


## API
Requires a session. Logged-out requests return 401 `unauthorized`.


### POST /api/bookings/:id/pay
- Body: `{ testMethod: "approve" | "decline", plan?: "deposit" | "full" | "balance" }` (plan defaults to deposit)
- 201: `{ payment: Payment, booking: PlanBooking }`
- 400 `validation_error`: missing or invalid testMethod or plan, invalid JSON
- 402 `payment_declined`: testMethod "decline". Nothing is recorded.
- 403 `forbidden`: vendor-role caller
- 404 `booking_not_found`: missing, not the caller's, or malformed id
- 409 `booking_not_confirmed`, 409 `already_paid` (that kind, or any payment for deposit and full), 409 `nothing_due` (balance with no paid deposit, or nothing left to pay)
- 500 `server_error`
- Order: validation, ownership, status and already-paid checks, then the fake provider, then `pay_booking` (which checks everything again). If `pay_booking` fails after an approval, nothing is recorded and the matching error is returned.


### GET /api/events/:id/plan and GET /api/vendor/bookings
- Same as before, with the new `payment` fields.


## UI screens and states
- Plan: confirmed unpaid rows show "Pay deposit" with the amount. Pending unpaid rows show the same "Pay deposit" link, outlined, with the note "You can pay a deposit once the vendor confirms."; the pay page shows "Waiting for the vendor" and payment stays confirmed-only on the server. Paid rows show "Deposit paid" (or "Paid in full") with the amount; after a deposit only, a "Pay balance" link with the balance. Refunded rows show "Deposit refunded", with the pay link if the booking is confirmed again. Declined rows show nothing unless refunded. Status is always text, not just color.
- Pay page: loading, summary, submitting (disabled), declined (message and retry), receipt, `booking_not_confirmed` and `already_paid` with a link back to the plan, 404, error with retry. Vendor-role users are redirected away.
- Vendor portal: a payment badge on rows: "Awaiting deposit" (confirmed, unpaid), "Deposit paid" or "Paid in full" with the amount, "Refunded". The dialog for declining a paid booking says the customer's deposit will be refunded.
- All text renders as plain text. Amounts are plain numbers with thousands separators, no currency symbol.


## Acceptance criteria
1. A customer pays a confirmed booking with "approve". The plan shows the deposit paid, with an amount of 30% of the price. A receipt shows the reference.
2. "decline" returns 402, records nothing, and the customer can retry.
3. A pending or declined booking returns 409 `booking_not_confirmed`. Paying twice returns 409 `already_paid`. Two simultaneous payments: one 201, one 409.
4. The vendor sees the payment status and paid amount, and never the reference.
5. A vendor setting a paid booking to declined refunds it in the same transaction. The customer sees "Refunded". Confirming again and paying works.
6. A vendor declining at the same time as a customer paying: either the payment is refunded or the payment is rejected with 409. Never a paid payment on a declined booking.
7. RLS: customer A cannot read or pay for B's bookings. A vendor can read only payments of their own bookings. Nobody can insert, update or delete a payment directly, and calling `pay_booking` as a vendor, anon or for someone else's booking fails.
8. Vendor-role users get 403 on the pay endpoint. Logged-out gets 401.
9. No card fields anywhere. No payment data in LLM input. No `service_role` key in the repo.
10. Full payment: paying "full" records one payment of the whole price and the plan shows "Paid in full". Paying "deposit" then "balance" records two payments that add up to the price and shows "Paid in full". A second payment of the same kind, a deposit or full after any payment, or a balance with no deposit returns 409. Declining a deposit-and-balance booking refunds both.
