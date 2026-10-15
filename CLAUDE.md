# CLAUDE.md

Read this and `progress.md` at the start of every session. Source of truth: `docs/SPEC.md`.

## What Allora is
A booking and planning platform for events (wedding, birthday, corporate). A customer creates an event and books service vendors, and AI shows what the plan is missing. Vendors manage incoming bookings in their own portal.

## Stack
Next.js (TypeScript, Tailwind, shadcn), route handlers for the API, Supabase (Auth + database), the provided LLM API (server-side only), deployed on Vercel.

## Roles and auth
- Two roles: **customer** (creates events, books vendors, views the plan) and **vendor** (sees incoming bookings, accepts or declines).
- Supabase Auth, email and password. On sign up the user picks a role, saved in `profiles` (`id` = auth user id, `role`, `name`).
- A vendor user is linked to one vendor record.
- Only the landing page (`/`), login and sign-up are public; logged-out visitors go to login. Signed-in users at `/` go to `/dashboard`.
- RLS: customers access only their own events and bookings; vendors read and update only bookings addressed to them; any signed-in user reads vendors; users read and update only their own profile.
- vendors insert and update only their own vendor record

## Never break these
- RLS on every table. No `service_role` key anywhere. Only the Supabase URL and publishable key reach the browser.
- LLM calls are server-side only.
- Vendor matching and ranking are deterministic. The AI only writes explanation text; it never picks or reorders vendors.
- A service on the event's own list with no pending or confirmed booking counts as a gap.
- Dashboard data is deterministic. The dashboard never calls the LLM.

## Data model
- **Profile**: id (auth user), role, name
- **Event**: owner (profile), type, date, budget, guestCount
- **Vendor**: name, category, price, about, location, owner (profile, optional)
- **Vendor contact**: vendor, phone, email, website (owner and customers with a confirmed booking only)
- **Booking**: event, vendor, category, status (pending, confirmed, declined, cancelled), cancelRequestedAt (optional; a customer's open request to cancel)
- **Event service**: event, category, position (the event's own list of services; starts from its type's template)
 **Blocked date**: vendor, date
- **Conversation**: customer, vendor (one per pair, created by the first booking)
- **Message**: conversation, sender, body (participants only)


## Workflow rules
- One feature at a time.
- Each feature gets its own branch, with frontend and backend on separate branches. Merge to `main` only after it is tested and approved.
- After finishing a feature, update `progress.md` and create or update `SPEC-<feature>.md`.
- Don't add features, tables, or dependencies that aren't in `SPEC.md` without asking first.

## Code conventions
- TypeScript throughout.
- Tailwind and shadcn for UI.
- Route handlers for the API.

## Migrations
- SQL files live in `supabase/sql/`, numbered (`001_profiles.sql`, `002_...`).

## Communication
- When a task is done, explain what changed in plain English.