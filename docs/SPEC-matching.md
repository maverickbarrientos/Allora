## Goal

For an event, show the services still missing from the plan: one card per gap, each with up to 3 vendors ranked by budget fit. AI writes explanation text only. Booking from a card adds it to the plan and removes the card.

## Out of scope

Chatbot, vendor-side changes, new tables, caching or storing AI text, editing checklists in the UI, ranking by anything except price fit, notifications.

## Rules (CLAUDE.md)

- A category with no pending or confirmed booking is a gap.
- Gaps, shares, match % and ranking are deterministic code. The LLM never picks, filters, orders or scores vendors. It only writes text, server-side.

## Config (Assumption: placeholders, all in src/lib/matching/config.ts, the single place to change)

- Checklist by event type, in card order:
  - wedding: venue, catering, photography, music, decoration
  - birthday: venue, catering, decoration, music
  - corporate: venue, catering, photography
- Weights: venue 0.35, catering 0.30, decoration 0.13, photography 0.12, music 0.10.
- share(category) = event.budget × weight ÷ (sum of weights in that event type's checklist), so shares add up to the budget. Shares do not change as bookings are made.
- Example: wedding with budget 100,000 gives venue share 35,000.

## Matching

- Candidates: all vendors in the gap's category. A vendor declined for this event stays eligible.
- distance = |price − share| ÷ share. matchPercent = round(100 × (1 − distance)), clamped to 0..100. Vendors at 0 are excluded. (Assumption)
- Order: matchPercent descending, then price ascending, then name ascending, then id ascending. Keep the first 3.
- Assumption: a gap with no candidates still gets a card, with an empty vendors list.
- Bookings in categories outside the event type's checklist are ignored.

## AI text (Assumption: all of this)

- One LLM call per request for all cards. Input: event type, and per card the category and share, and per vendor the id, name, price and matchPercent. No user ids, emails or names. Output JSON: `{ cards: [{ category, whyItMatters, vendors: [{ id, reason }] }] }`.
- The server uses only categories and vendor ids it sent. Text is trimmed plain text, whyItMatters at most 200 characters, reason at most 120. Missing, invalid or too-long text is replaced by a template: whyItMatters = "No {category} is booked yet for this {type}.", reason = "Price is {matchPercent}% close to the suggested {category} budget."
- Failed call, invalid JSON or no answer within 8 seconds: all text uses the templates.
- `textSource` is "ai" only if every text came from the model, otherwise "fallback".
- Nothing is cached or stored.

## Data and tables

No new tables and no policy changes. The handler reads the caller's own events and bookings and all vendors with the signed-in user's session client.

## Shared shapes

- `MatchedVendor` = `{ id, name, price, matchPercent, reason }` (matchPercent is an integer from 1 to 100)
- `MissingCard` = `{ category, budgetShare, whyItMatters, vendors: MatchedVendor[] }` (budgetShare is a number rounded to 2 decimals, 0 to 3 vendors)
- Error body, 401 `unauthorized` as in SPEC-setup-and-auth.md. Vendor-role callers get 403 `forbidden`.

## API

Requires a session. Logged-out requests return 401 `unauthorized`.

### GET /api/events/:id/missing

- 200: `{ eventId, textSource: "ai" | "fallback", cards: MissingCard[] }`. `cards` is empty when nothing is missing.
- 404 `event_not_found`: missing, not the caller's, or malformed id
- 403 `forbidden`
- 500 `server_error`: database failure only. An LLM failure never causes an error.

Booking from a card uses `POST /api/bookings` (SPEC-events-booking.md). There is no new booking endpoint.

## UI screens and states

- `/events/[id]` gets a "What's missing" section. The plan's bookings never wait for it.
- Loading: skeleton cards. Empty: "Nothing missing: every service has a booking". Loaded: one card per gap. Error: message with retry, plan unaffected.
- Card: category label, serif title, whyItMatters, budget share, up to 3 vendor rows (name, price, "N% match", reason, Book button). Empty vendor list: "No vendors close to this budget share."
- Book: button disabled while in progress. On success the card is removed (fade, off with reduced motion) and the plan's bookings refresh, with no refetch of the cards. `already_booked` (409) is treated as booked. Any other error shows a message on the card and the card stays.
- Prices and budgets are plain numbers, no currency symbol.

## Acceptance criteria

1. An event with no bookings gets one card per checklist category: 5 for wedding, 4 for birthday, 3 for corporate, in config order.
2. Each card has at most 3 vendors in the specified order. Match % matches the formula (wedding, budget 100,000: venue vendor at 35,000 is 100%, at 26,250 is 75%, at 70,000 is excluded).
3. Booking from a card creates a pending booking through the existing endpoint, removes the card and shows the booking on the plan. The other cards are unchanged.
4. A category with only a declined booking still has a card. If a vendor later declines, the card returns on the next load.
5. Ranking, vendor ids and match % are identical whatever the LLM returns, including nothing, bad JSON, reordered or unknown ids.
6. LLM failure or timeout returns 200 with template text and `textSource: "fallback"`.
7. Auth: logged-out 401, vendor-role 403, another customer's event 404.
8. The LLM key is only on the server and the prompt contains no personal data. No `service_role` key. No new tables.
