# Spec: Customer cancellation request

## Problem
A customer who has booked a vendor can't back out. Only the vendor can cancel, so a customer whose plans change has to message the vendor and hope.

## Solution
The customer asks to cancel a pending or confirmed booking from their plan. The vendor approves or rejects the request. On approval the booking is cancelled, a paid deposit is refunded, and the service shows up again as something the plan is missing.

## The user
A customer who has booked a vendor for an event, and the vendor who received that booking.

## User stories
1. As a customer, I want to request cancelling a booking, so that I can change my plans.
2. As a customer, I want to see that my request is waiting for the vendor, so that I know where it stands.
3. As a vendor, I want to see cancellation requests in my bookings, so that I can answer them.
4. As a vendor, I want to approve or keep a booking, so that I decide whether it ends.
5. As a customer, I want a paid deposit refunded when the cancellation is approved, so that I don't lose money.
6. As a customer, I want a cancelled service listed under "Needs a replacement", so that I can book someone else.

## Screens
- **Customer plan:** "Request cancellation" on each pending or confirmed booking, with a confirm dialog. After a request, "Cancellation requested" replaces the button.
- **Customer plan, approved:** the booking shows as cancelled, a paid deposit shows "Deposit refunded", and the service appears under "Needs a replacement".
- **Customer plan, rejected:** the booking goes back to confirmed.
- **Vendor bookings:** a "Cancellation requested" group with "Approve cancellation" and "Keep booking", and a confirm dialog before approving.
- **Vendor dashboard and calendar:** a request counts as pending; a cancelled booking is removed from the calendar.

## Data
No new tables. Booking status gains two values:
- `cancel_requested`: still active. It holds the category, the vendor and event pair, and the budget.
- `cancelled`: inactive like `declined` (the category becomes a gap) but distinguishable from a vendor decline.

Access:
- Customers read bookings on their own events. They cannot update a booking directly. The only way is `request_booking_cancellation`, which moves their own pending or confirmed booking to `cancel_requested`.
- Vendors update only their own bookings, to `confirmed`, `declined` or `cancelled`. The API allows `cancelled` only from `cancel_requested`.
- A paid payment becomes `refunded` when its booking becomes `cancelled`, in the same transaction.

Routes:
- `POST /api/bookings/:id/cancel-request` (customer): 200 `{ booking }`, 401, 403, 404 (missing, malformed id or not their event), 409 `already_requested`, 409 `not_cancellable`.
- `PATCH /api/vendor/bookings/:id` also accepts `cancelled`; 409 `status_unchanged` when there is no request to approve.

Migration: `supabase/sql/029_customer_cancel.sql`.

## Login
Existing Supabase Auth with the customer and vendor roles. Nothing new.

## Done for the demo
- [ ] Customer requests cancellation on a confirmed booking and sees "Cancellation requested".
- [ ] Vendor sees it under "Cancellation requested" and approves it.
- [ ] The booking shows cancelled, a paid deposit shows refunded, and the service appears under "Needs a replacement".
- [ ] Vendor keeps a booking instead: it returns to confirmed.
- [ ] A customer cannot cancel another customer's booking, and cannot change a booking directly.

## Out of scope
- Notifications (email, push, SMS), cancellation reasons, partial refunds and cancellation fees.
- Freeing the vendor's date and hiding contact details while a request is open (date and contact rules look at `confirmed` only).
- Customer-side cancel of declined or already cancelled bookings.
- Changes to matching or ranking, and any LLM involvement.
