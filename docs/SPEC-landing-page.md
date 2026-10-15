# Landing page

A public marketing page at `/` for visitors who are not signed in. Frontend only: no tables, API routes, LLM calls or dependencies.

## Routing
- Signed out: `/` shows the landing page. Every other page still redirects to `/login`, and the API still returns 401.
- Signed in: `/` redirects to `/dashboard` (vendors then go on to `/vendor`), the same as `/login` and `/signup`.
- The customer events list moved from `/` to `/events`. The sidebar "My events" item and every in-app "Back" or "Cancel" link that pointed to `/` now point to `/events`. Vendor pages send non-vendors to `/dashboard`.

## Page (`src/app/page.tsx`)
Server component outside the `(app)` group, so it has no app shell. Sections:
1. Top bar: "Allora" wordmark, "Log in" (`/login`) and "Get started" (`/signup`).
2. Hero: stone panel with paper grain, the label "Event planning, made calm", the headline "Every detail, in one place.", one line of copy, "Start planning" (`/signup`) and "Log in", and an image placeholder.
3. How it works: create your event, book your vendors, see what is missing.
4. Who it is for: a host card and a vendor card, each with three points and a link to `/signup`.
5. Event types: Weddings, Birthdays and Corporate, each with an image placeholder.
6. Closing call to action and footer.

## Design
Follows `docs/DESIGN.md`: existing tokens, `ImagePlaceholder`, `Reveal` (stagger 80ms), `Card` and `buttonVariants`; lucide arrow icons only; one brass highlight (the hero hairline); no exclamation marks; works at 375px; reduced motion shows content immediately.

## Acceptance
- Logged out: `/` renders the landing page; its links reach `/login` and `/signup`; `/events` and `/dashboard` redirect to `/login`.
- Logged in as a customer: `/` goes to `/dashboard`; "My events" opens `/events` and stays highlighted on `/events/[id]`.
- Logged in as a vendor: `/` ends on `/vendor`.
