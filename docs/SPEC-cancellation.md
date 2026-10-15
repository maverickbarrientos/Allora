Goal

A vendor can cancel a booking it has already confirmed. The customer sees the cancellation on the plan, sees which services now need a replacement, and rebooks from the existing "What's missing" cards in one click. Cancelling reuses the declined status. Nothing is added to the database.

Out of scope

Customer-initiated cancellation (it needs its own status to be told apart from a vendor decline), refunds, deposits and payments, notifications (email, push, SMS), cancellation reasons, vendor penalties or ranking changes, live updates (realtime or polling), changes to the matching rules, new tables, fields or statuses, SQL or policy changes, new dependencies.

Rules (CLAUDE.md)
Cancel means moving the booking to the existing declined status. No new status, field, table or label. (Assumption)
Vendor transitions after this feature: pending to confirmed and pending to declined (existing, unchanged), confirmed to declined (new). Anything else is rejected with the existing invalid-transition error. (Assumption: check against the vendor portal spec)
Only the vendor that owns the booking can change it.
Gaps, shares, match % and ranking stay exactly as defined in SPEC-matching.md. The LLM is not involved in cancelling.
The plan's bookings never wait for the cards.
Assumptions to confirm before building
Reusing declined for a cancelled booking is acceptable, so the plan cannot tell a decline from a cancellation.
The vendor portal's existing update endpoint can express confirmed to declined without a contract change.
Each booking in the plan response already carries its service category and vendor id. If not, stop and tell me.
Without realtime, the customer sees a cancellation on page load, when the tab regains focus, or when they press Refresh.
Integration map
Piece	Defined in	Change
Vendor booking update endpoint	vendor portal spec	Allow confirmed to declined. Same route, body and response
Plan read (bookings with status)	SPEC-events-booking.md	None. Declined is already returned
GET /api/events/:id/missing	SPEC-matching.md	None. Verified by tests only
POST /api/bookings	SPEC-events-booking.md	None. Used to book the replacement
Vendor portal UI	vendor portal frontend	"Cancel booking" on confirmed bookings
/events/[id] plan	events-booking and matching frontend	"Needs a replacement" notice, one cards refetch when a booking turns declined, "Declined earlier" note on vendor rows, Refresh
Flow
A vendor opens a confirmed booking, chooses Cancel booking, and confirms in a dialog.
The client calls the existing update endpoint with status declined. The server checks session, role, ownership and transition, updates the booking, and returns it in the existing shape.
The vendor's list shows the booking as declined.
The customer's plan picks up the change on its next refresh (page load, tab regains focus, or Refresh). The booking shows as declined with the existing StatusBadge.
For each category that has a declined booking and no pending or confirmed booking, the plan shows an entry under "Needs a replacement".
When a refresh shows a booking that turned declined since the last render, the plan refetches the cards once. The card for that category appears, because a declined booking keeps its gap (SPEC-matching.md, criterion 4).
The customer taps "See replacements", which scrolls to and focuses that card. Booking a vendor from the card uses the existing booking endpoint. The booking is pending, the card and the notice entry disappear, and the cards are not refetched.
Shared shapes

No new shapes. Booking, MissingCard and MatchedVendor are as in the earlier specs. Error body as in SPEC-setup-and-auth.md.

API

No new routes. The only server change is the allowed transitions on the existing vendor booking update endpoint.

200: the updated booking in the existing shape, status declined.
401 unauthorized: no session.
403 forbidden: customer-role caller.
404: missing booking, malformed id, or a booking owned by another vendor, as the existing endpoint already does.
The existing invalid-transition error: any transition not listed in the rules (for example declined to declined).
500 server_error: database failure only.
UI screens and states
Vendor portal
A confirmed booking shows "Cancel booking". Pending bookings keep their existing Accept and Decline actions. Declined bookings show no action.
Cancel opens a confirmation dialog: "Cancel this booking? The customer will be asked to find a replacement." Buttons: "Keep booking" and "Cancel booking".
The confirm button is disabled while the request runs. On success the dialog closes and the booking shows as declined. On any error the dialog shows a message and the booking is unchanged.
Customer plan (/events/[id])
"Needs a replacement" notice, shown only when at least one category qualifies (step 5). It lists the category names, each with a "See replacements" action. It is hidden when nothing qualifies.
A "Refresh" button on the plan, disabled while a refresh runs. The plan also refreshes when the tab regains focus. Never more than one plan refresh at a time.
In the cards, a vendor with a declined booking on this event shows the note "Declined earlier". Its Book button stays enabled, because declined vendors stay eligible (SPEC-matching.md).
Existing loading, empty, error and 404 states are unchanged. A failed cards request never hides the notice or blocks the plan.
No new status label, token or restyled shared component.
Acceptance criteria
The owning vendor can cancel a confirmed booking. The status becomes declined and the response has the existing shape.
Logged-out is 401, a customer-role caller is 403, and another vendor's booking or a missing or malformed id is 404.
Pending to confirmed and pending to declined behave exactly as before. Declined to anything, and confirmed to pending or confirmed, are rejected with the existing error and change nothing.
After a cancel, the customer's plan shows the booking as declined and lists its category under "Needs a replacement" when no pending or confirmed booking exists in that category.
The category's card appears on the next cards load, with up to 3 vendors in the order SPEC-matching.md defines. The order is the same before and after the cancel for the other cards.
Booking a replacement from the card creates a pending booking through the existing endpoint, removes the card and the notice entry, and does not refetch the cards.
A vendor who cancelled shows "Declined earlier" in the cards and can still be booked.
A refresh that shows no new declined booking does not refetch the cards. One that shows a new declined booking refetches them exactly once.
LLM calls: one per cards load, none when cancelling, none when booking from a card. An LLM failure still shows template text and never affects the notice.
No new tables, fields, statuses, SQL or policy changes, dependencies or service_role key.