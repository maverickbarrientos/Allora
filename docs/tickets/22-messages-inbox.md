# 22 — Messages inbox

**What to build:** Customers and vendors have a Messages page listing all their conversations, newest first, reachable from the sidebar.

**Blocked by:** 20

**Status:** done

- [x] A "Messages" item in the sidebar for both roles opens the inbox
- [x] Each row shows the other side's name, a one-line preview of the last message and its time, and opens the conversation
- [x] Read-only conversations are marked as such
- [x] With no conversations, the page says a conversation starts when a booking is made
- [x] A new message moves its conversation to the top without a reload
- [x] Works at phone width
- [ ] Works on the live URL

**Notes (2026-10-16):** No new SQL: the inbox reads `my_conversations()` from 018. 37 checks passed in headless Chrome and over the API against the live database (customer, vendor and a customer with no conversations in separate sessions): Messages in the sidebar for both roles and highlighted; rows with the other side's name, a one-line preview ("You:" for my own, long and multi-line messages cut to one line), time and category; "Read-only" on a conversation with only declined bookings; "No messages yet" for a conversation without messages; the empty-inbox text; a reply from the other side moves its conversation to the top within seconds with no reload; rows open the conversation and the conversation's back link returns to the inbox; role redirects; 375px with no sideways scroll and rows at least 44px tall; no browser errors; another customer sees an empty inbox and logged out gets 401. The ticket 21 live-message checks were rerun after moving the Realtime code into a shared hook: 18/18. Not checked on the Vercel preview URL itself.
