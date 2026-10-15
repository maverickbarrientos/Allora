# SPEC-event-services.md

## Goal
Each event has its own list of services. It starts from a template for the event type, and the customer can add or remove services when creating the event, on the plan page and on the edit page. More service categories are available than the original five.

## Out of scope
Customer-typed (free-text) services, templates the customer can save or share, several templates per type, vendor-side changes other than the new categories appearing in the category picker, AI choosing services, reordering services by drag and drop, new dependencies.

## Rules
- A service on the event's list with no pending or confirmed booking is a gap. Bookings in categories outside the list are ignored for gaps, as before.
- Gaps, budget shares, the "What's missing" cards, the chatbot input, the dashboard and the budgets page all use the event's own list instead of the type's fixed list. The gap and share functions take the list as input and are reused, never copied.
- Deterministic only. Choosing services never calls the LLM, and the AI never adds, removes or orders services.
- Categories come from one config list, each with a budget weight. Shares are rescaled over the event's own services, the same formula as SPEC-matching.md.
- Assumption (placeholders, change in config): new categories florist 0.06, cake 0.05, lighting 0.06, transport 0.05, makeup 0.05, after the original five.
- Assumption: the default lists per type are the original checklists (wedding: venue, catering, photography, music, decoration; birthday: venue, catering, decoration, music; corporate: venue, catering, photography).
- A service with a pending or confirmed booking can't be removed. A declined-only service can be removed.
- Removing a service also removes its set budget.
- Changing an event's type no longer changes its services. The `budgets_outside_checklist` 409 on PATCH /api/events/:id is removed.
- An event has at least 1 service. No duplicates. Order is the order the customer saved them in; services from a template keep template order.

## Data and tables
New table `event_services` (SQL `011_event_services.sql`, safe to re-run):
- Columns: `event_id` (the event, removed with it), `category`, `position` (order on the list), `created_at`. One row per event and category.
- RLS: only the event's owner may read, add and remove rows; adding also needs the customer role. Vendors and logged-out users get nothing.
- Removing a row is refused with `service_has_active_booking` when the event has a pending or confirmed booking in that category; otherwise the matching set budget is removed too.
- `set_event_services(event, categories)` replaces the whole list in one transaction, so a blocked removal changes nothing.
- Backfill: every existing event gets its type's default list, so nothing changes for existing events.
- Optional `012_seed_vendors_extra.sql`: 1 to 2 placeholder vendors per new category.
- No change to `vendors` or `bookings`; they have no category constraint.

## Shared shapes
- `EventService` = `{ category, status: "pending" | "confirmed" | null }`. `status` is the strongest active booking in that category (confirmed over pending), or null for a gap.
- `EventTemplate` gains `services: string[]`.
- `CreateEventInput` gains optional `services: string[]`.
- Error body, 401 and 403 as in earlier specs.

## API
Requires a session. Logged-out requests get 401 `unauthorized`; vendor-role callers get 403 `forbidden`.

### GET /api/events/:id/services
- 200: `{ services: EventService[] }` in list order.
- 404 `event_not_found`: missing, not the caller's, or malformed id. 500 `server_error`.

### PUT /api/events/:id/services
- Body: `{ services: string[] }`, the full new list.
- 200: `{ services: EventService[] }`.
- 400 `validation_error`: not an array, empty, unknown category, or duplicates.
- 409 `service_has_active_booking`: the message names the blocked categories. Nothing is saved.
- 404, 500 as above.

### Changes to existing endpoints
- `POST /api/events`: optional `services`; defaults to the type's template. Validated like PUT. If saving the services fails, the event is not kept.
- `GET /api/event-templates`: each template includes `services`.
- `GET /api/categories`: includes the new categories, so vendors can pick them.
- `PATCH /api/events/:id`: type changes no longer check budgets against the checklist.
- `/missing`, `/chat`, `/dashboard`, `/budgets`: same shapes; they use the event's list. Budgets accept any category on the event's list.

## UI screens and states
- Service picker (shared): one checkbox per category with its capitalized name. A service with an active booking is checked and disabled, with "Has a booking" next to it. At least one must stay checked; Save is disabled otherwise.
- `/events/new`: a "Services" picker below the type, prefilled from the chosen type's template. Changing the type replaces the selection only if the customer hasn't changed it yet.
- `/events/[id]` (plan): a "Services" section listing the services with their status (Booked, Pending, Missing) and an Edit button. Edit opens the picker with Save and Cancel. Saving refetches the plan and the "What's missing" cards. A 409 shows "Can't remove {categories}: they have a booking." and keeps the picker open.
- `/events/[id]/edit`: the same picker in its own section with its own Save. The confirmation before a type change and the `budgets_outside_checklist` message are removed.
- Loading: skeleton. Error: message with retry. All text is plain text.

## Acceptance criteria
1. Existing events show the same services, cards, dashboard missing list, chatbot checklist and budget rows as before 011, for all three types.
2. Creating an event with no `services` gives the type's template; with a custom list it gives exactly that list in that order.
3. Adding a service makes it a gap: a card, a dashboard missing entry and a chatbot checklist item appear, and shares are rescaled over the new list.
4. Removing a service with no active booking removes its card, its missing entry and its set budget.
5. Removing a service with a pending or confirmed booking returns 409 and nothing changes, also when the same PUT adds other services.
6. Changing the event type keeps its services.
7. A vendor can create or edit a profile under a new category, and that vendor appears on the matching card.
8. Validation: empty list, unknown category and duplicates get 400 and nothing is saved, on PUT and on create.
9. Auth: logged-out 401, vendor-role 403, another customer's event 404. Direct Supabase client writes to another customer's event services are refused.
10. Choosing services makes no LLM call. No `service_role` key, no new dependency.
