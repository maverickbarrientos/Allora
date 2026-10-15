# SPEC-messages.md

## Goal
A customer and a vendor can message each other inside Allora. There is one conversation per customer–vendor pair. It opens with their first booking and stays open while they have a pending or confirmed booking. New messages appear instantly, there is an inbox, and unread messages are counted.

Called **Messages** in the app, to keep it apart from the AI planning chat (SPEC-chatbot.md), which is unchanged.

## Out of scope
Email or push notifications (see LATER.md), attachments and images, editing or deleting messages, typing indicators, read receipts shown to the other side, messaging a vendor before any booking, group conversations, sending messages to the LLM, new dependencies.

## Rules
- One conversation per (customer, vendor). It is created automatically by the database the first time the customer books that vendor, on any event. Nobody creates conversations by hand.
- **Open** while the pair has at least one pending or confirmed booking (any event). With only declined bookings it is **read-only**: the history stays visible, and new messages are refused.
- Only the two participants can read a conversation and its messages: the customer, and the user who owns the vendor. A seeded vendor with no account has nobody on the vendor side; the customer can still write.
- A message is plain text, trimmed, 1 to 2,000 characters. Messages can't be edited or deleted.
- Each side has its own read time. Unread = messages from the other side sent after my read time. Opening a conversation marks it read.
- The other party's name comes from the database through a security definer function. Vendors still can't read `profiles` or `events` directly, and no email, profile id or owner id is sent.
- Messages are never sent to the LLM, and the dashboard doesn't use them.

## Data and tables
SQL `018_messages.sql`, safe to re-run.
- **`conversations`**:
  - Columns: `id`, `customer_id` (profile, removed with it), `vendor_id` (vendor, removed with it), `created_at`, `last_message_at` (null until the first message), `customer_last_read_at`, `vendor_last_read_at`. Unique on (customer_id, vendor_id).
  - RLS read: the customer, or the vendor's owner.
  - No insert, update or delete from the browser. A trigger on `bookings` insert creates the row (security definer, does nothing if it exists). A backfill covers existing bookings.
- **`messages`**:
  - Columns: `id`, `conversation_id` (removed with it), `sender_id` (profile), `body`, `created_at`. A check keeps `body` at 1 to 2,000 characters with no leading or trailing spaces.
  - RLS read: both participants.
  - RLS insert: the sender is the caller and a participant, and `conversation_is_open` is true.
  - No update or delete.
  - A trigger sets `conversations.last_message_at`.
- **Security definer functions** (empty search_path, execute for authenticated only):
  - `conversation_is_open(uuid)`
  - `mark_conversation_read(uuid)`: sets only the caller's own read time. Raises if the caller isn't a participant.
  - `my_conversations()`: the caller's conversations, each with its id, the other side's name, the vendor's category, `open`, the last message (body and time), `last_message_at` and `unread`.
  - `my_booking_conversations()`: the booking id, conversation id and unread count for each of the caller's bookings.
- **Realtime:** `messages` is added to the `supabase_realtime` publication. Realtime applies the read policy, so each user only receives their own conversations.

## Shared shapes
- `ConversationSummary` = `{ id, otherName, category, open, lastMessage: { body, createdAt, mine } | null, unread }`
- `Message` = `{ id, body, createdAt, mine }`
- `ConversationDetail` = `{ id, otherName, category, open, messages: Message[], hasMore }`
- `BookingConversation` = `{ conversationId, unread }`
- Error body, 401 and 404 as in earlier specs.

## API
Every route requires a session; logged-out requests get 401. Both roles use the same routes. "Not yours", unknown and malformed ids all give 404 `conversation_not_found`.
- `GET /api/conversations`: 200 `{ conversations: ConversationSummary[] }`, newest activity first.
- `GET /api/conversations/:id/messages?before=<ISO time>`: 200 `ConversationDetail` with the latest 50 messages before `before` (or the latest 50), oldest first. `hasMore` says whether older ones exist.
- `POST /api/conversations/:id/messages`, body `{ body }`:
  - 201 `{ message: Message }`
  - 400 `validation_error` for empty, too long or not text
  - 409 `conversation_closed` when read-only
  - 404
- `POST /api/conversations/:id/read`: 204 when done, or 404.
- `GET /api/conversations/booking-map`: 200 `{ bookings: Record<bookingId, BookingConversation> }`.

## UI screens and states
- **Conversation** at `/messages/[id]` (customer) and `/vendor/messages/[id]` (vendor), using one shared component:
  - A header with the other side's name and the vendor category.
  - Messages oldest to newest, mine on the right, with time stamps. Line breaks are kept.
  - "Load earlier" when there are older messages.
  - A text box with Send. Enter sends and Shift+Enter adds a line. The button is disabled while sending and when the text is empty or over the limit.
  - When read-only, the box is replaced by "This conversation is read-only because there's no active booking."
  - States: loading skeleton, error with Retry, a 404 page, and a role mismatch redirect.
- **Inbox** at `/messages` and `/vendor/messages`:
  - One row per conversation: the name, a one-line preview, the time and an unread count.
  - Empty state: "No messages yet. A conversation starts when a booking is made."
- **Sidebar:** a "Messages" item for both roles, with the total unread count.
- **Entry points:** a "Message" link on each booking row of the plan and `/vendor/bookings`, with that conversation's unread count.
- **Live:** an open conversation, the inbox and the sidebar count update instantly through Realtime.
- Works at 375px. All text is plain text.

## Acceptance criteria
1. Booking a vendor creates the pair's conversation once. Booking the same vendor on another event reuses it.
2. Both sides can send and read messages while a pending or confirmed booking exists. With only declined bookings, sending gets 409 and the page is read-only.
3. A third customer, another vendor and a logged-out user can't read or send in the conversation, through the API or the database directly.
4. Nobody can edit or delete messages, or create, change or delete conversations, from the browser.
5. Messages appear instantly for the other side. A Realtime subscriber who isn't a participant receives nothing.
6. Unread counts are correct for each side, drop to zero when the conversation is opened, and are the same on the sidebar, the inbox and booking rows.
7. The planning chatbot, the matching and the dashboard are unchanged, and messages never reach the LLM.
8. RLS on both new tables. No `service_role` key, no new dependency.
