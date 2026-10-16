// Static description of how Allora works, sent to the planning assistant so it
// can answer "how do I...?" questions without inventing features
// (docs/SPEC-chatbot.md, "What the model gets"). Written from the screens on
// main. Contains no user data. Update it when a customer-facing screen changes.

export const APP_GUIDE = `How Allora works (for customers):
- Events: "My events" lists the customer's events. "New event" creates one with a name, type (wedding, birthday or corporate), date, budget and guest count. Each event has its own plan page.
- Plan page: shows the event details and its bookings, each with a status: pending (waiting for the vendor), confirmed (the vendor accepted) declined (the vendor declined or cancelled it), cancel requested (the customer asked to cancel and the vendor hasn't answered) or cancelled (the vendor approved the customer's request). The Refresh button, or coming back to the tab, loads the latest statuses.
- Cancelling: on a pending or confirmed booking the customer can tap "Request cancellation". The booking shows "Cancellation requested" until the vendor answers. If the vendor approves, the booking is cancelled and a paid deposit is refunded; if the vendor keeps it, it goes back to confirmed. The customer can't cancel on their own.
- Needs a replacement: when a booked service was declined or cancelled (by the vendor or at the customer's request) and nothing else is booked for it, the plan lists it with a "See replacements" button that jumps to its card.
- What's missing: one card for each service on the event's checklist that has no pending or confirmed booking. Each card shows a suggested budget share and up to 3 vendors chosen by how close their price is to that share, with a Book button. A vendor that declined earlier is marked "Declined earlier" and can still be booked.
- Add vendor: the browse page lists all vendors, with tabs by service category, and a Book button on each. Booking sends a request; it shows as pending until the vendor responds. The same vendor can't be booked twice for one event while a booking is pending or confirmed.
- Deposits: after a vendor confirms, the plan shows "Pay deposit" for that booking. The pay page takes a demo payment (no real money). The pay page lets you pay the deposit or the full amount; after a deposit, the plan offers "Pay balance". A paid booking shows "Deposit paid" or "Paid in full". If the vendor later cancels a paid booking, the deposit is refunded and the plan shows "Deposit refunded".
- Planning assistant: this chat on the plan page. It answers planning questions and can suggest what to book first and last. It can't book, pay or change anything, and the conversation isn't saved.

How Allora works (for vendors):
- Vendors have a Bookings page where they accept or decline new requests, cancel a confirmed booking, accept a booking they declined earlier, or approve or keep a booking the customer asked to cancel, and a Profile page with their name, service category and price.`;
