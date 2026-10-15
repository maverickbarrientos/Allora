# 20 — Customer and vendor message each other

**What to build:** Once a customer books a vendor, both of them can open their conversation from the booking and write to each other. While they have a pending or confirmed booking, the conversation is open. With only declined bookings, it becomes read-only.

**Blocked by:** None

**Status:** done

- [x] Booking a vendor creates one conversation for that customer and vendor; booking them again on another event reuses it
- [x] A "Message" link on each booking row of the plan and of the vendor's bookings page opens the conversation
- [x] Both sides can send a message and see it, oldest first, theirs on the right, with line breaks kept
- [x] Empty messages and messages over 2,000 characters are refused
- [x] With only declined bookings, the conversation is read-only and says why; sending is refused
- [x] Another customer, another vendor and a logged-out visitor can't read or send, even straight through the database
- [x] Nobody can edit or delete messages
- [ ] Works on the live URL

**Notes (2026-10-16):** SQL `018_messages.sql` run on the live project (RLS on both tables; browsers read and insert only `conversation_id`, `sender_id` and `body`; no update or delete; nothing for logged-out users; 75 conversations backfilled for 75 existing customer-vendor pairs). 54 checks passed on a local production build against the live database: one conversation per pair, reused across events; sending, trimming, line breaks, oldest first, `mine` on each side, no ids or emails in responses; empty, over 2,000, non-text and missing bodies refused, exactly 2,000 with an emoji accepted; 404 for another customer, another vendor, unknown and malformed ids, 401 logged out; straight through the database, outsiders read and send nothing, nobody can send as the other side, backdate, edit or delete messages, or create, change or delete conversations; 58 messages including 55 saved in the same instant page back exactly once each; read-only only when every booking is declined, 409 from the API and refused by the database, open again after a re-confirm. Throwaway data deleted. Still to check in the browser: the conversation page, the Message links on the plan and on the vendor's bookings, phone width, and the live URL.

**Browser test (2026-10-16, by request instead of a manual check):** 32 checks passed in headless Chrome against a local production build and the live database, with a customer and a vendor in separate sessions: the Message links on the plan and on the vendor's bookings, sending with Enter and the button, Shift+Enter for a new line, the counter and the 2,000 limit, Load earlier with 57 messages, opening at the newest message, read-only on both sides after a decline, the role redirects, the 404 page, no horizontal scroll at 375px and no browser errors. Fixed from looking at the screenshots: a run of messages from the same side within 5 minutes now shows one time stamp instead of one under every message. Not checked on the Vercel preview URL itself.
