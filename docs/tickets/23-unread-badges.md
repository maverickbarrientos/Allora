# 23 — Unread badges

**What to build:** Customers and vendors can see at a glance how many messages they haven't read: on the sidebar, in the inbox and on each booking row.

**Blocked by:** 21, 22

**Status:** done

- [x] Messages from the other side count as unread until I open the conversation
- [x] The sidebar shows my total unread count; each inbox row and each booking row shows its own
- [x] Opening a conversation brings its count to zero everywhere
- [x] Counts update without a reload when a message arrives
- [x] My own messages never count as unread for me
- [x] Nobody can change the other side's read status
- [ ] Works on the live URL

**Notes (2026-10-16):** No new SQL: `conversation_unread()` and `mark_conversation_read()` from 018 already did the counting and the marking. New `POST /api/conversations/:id/read` (204, 404 for anyone outside the conversation). 51 checks passed against the live database, over the API, straight through the database and in headless Chrome with a customer and a vendor: 2 messages from the customer count as 2 for the vendor and 0 for the customer; marking read clears only the caller's own side (the other side's count is untouched, in both directions); a third customer, another vendor and a logged-out caller get an error and change nothing, and direct writes to either read time are refused; the sidebar total, each inbox row and each booking's Message link show the right numbers for both roles; opening a conversation clears it everywhere; a message arriving while the inbox or the sidebar is open updates the counts and moves the conversation up without a reload; a message arriving on an open conversation is read on arrival and doesn't raise the count; sending my own message doesn't change it; the count shows in the 375px drawer with no sideways scroll; no browser errors. Tickets 21 and 22 were rerun after these changes: 18/18 and 37/37. Not checked on the Vercel preview URL itself. Known shortcuts: an open but hidden tab counts as reading; a read in another tab isn't seen until the next message or reload; the sidebar total sums the inbox list.
