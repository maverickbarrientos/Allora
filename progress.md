# Allora — Progress

Booking and planning platform where customers create events, book vendors, and see AI-powered gaps in their plan, while vendors manage bookings in a portal.

## Features (in build order)

| # | Feature | Status | Branch | Notes |
|---|---------|--------|--------|-------|
| 1 | Setup and auth | done | `feature/auth-backend`, `feature/auth-frontend`, `feature/auth-connect` | Supabase Auth, `profiles` with role, route protection, RLS |
| 2 | Events, vendor browsing and booking | not started | _tbd_ | Create event, browse vendors by category, book, view plan with status |
| 3 | Vendor portal | not started | _tbd_ | Incoming bookings, accept or decline, status shows on customer plan |
| 4 | Smart matching and "What's missing" cards | not started | _tbd_ | Deterministic budget-share ranking, AI writes reason text only |
| 5 | Planning chatbot | not started | _tbd_ | Knows event and bookings, ordered list of what to book first and last |
| 6 | Polish and deploy to Vercel | not started | _tbd_ | Final polish, production deploy |

## Decisions and changes

- **2026-10-15: Setup and auth, backend (branch `feature/auth-backend`).** Added `supabase/sql/001_profiles.sql` (table, role check, signup trigger, RLS), the four route handlers (`/api/auth/signup|login|logout`, `/api/me`), `src/proxy.ts` for route protection (Next 16 renamed middleware to proxy), and `src/lib/api-helpers.ts`. Env var for the key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (renamed from the template's `..._ANON_KEY`). The role-immutable UPDATE policy reads the stored role through a security-definer helper, `public.current_user_role()`, because a self-referencing subquery in the policy caused infinite recursion. Requires "Confirm email" OFF in Supabase Auth so signup returns a session. Backend acceptance criteria 1-6 checked with curl and PostgREST using real user JWTs; frontend criteria (UI states, back/refresh) are left to the frontend branch. Not merged.

- **2026-10-15: DESIGN.md applied to the auth screens** (branch `feature/auth-frontend`). Visual changes only. Tokens and the shadcn theme mapping are in `globals.css` (light theme only); Fraunces and Inter load through `next/font`. New shared components: `PageHeader`, `StatusBadge`, `ImagePlaceholder`, `Reveal`, `Skeleton`, `AppHeader`, `AuthHero`. Button, input, label, card and alert restyled. `/login`, `/signup` and `/` restyled, with the brass hairline animation and fade-up. Routes, behavior, states, `src/lib/api/` and `src/mocks/` untouched; no new dependencies. Notes: `/` has no events yet, so it shows the existing name/role placeholder in the new style, and the log out button moved into the header. `StatusBadge` is built but not used on this branch yet.
- **2026-10-15: Auth frontend built against mocks** (branch `feature/auth-frontend`, not merged). `/login`, `/signup` and `/` with every state in the spec. All screens use one client, `src/lib/api/client.ts`, which calls the real routes, or `src/mocks/auth.ts` when `NEXT_PUBLIC_USE_MOCKS=true`. The mock is temporary and keeps its fake session and users in `localStorage`. `src/components/session-guard.tsx` is a temporary client-side guard (calls `GET /api/me`, redirects) so redirects work in mock mode; remove it if the middleware makes it redundant. The API contract is unchanged. Notes: (1) the contract's `validation_error` carries no field name, so per-field messages come from client-side checks that mirror the server rules, and a server `validation_error` shows as a form-level message; (2) the spec file is named `SPEC-setupa-and-auth.md` (typo), left as is; (3) no new dependencies: the role picker is native radio inputs and `alert.tsx` is hand-written in the style of the other `ui/` components. Starter page removed; app title set to Allora.
- **2026-10-15: Auth frontend and backend connected** (branch `feature/auth-connect`, not merged). Removed `src/mocks/auth.ts`, the `NEXT_PUBLIC_USE_MOCKS` switch and the mock branch in `src/lib/api/client.ts`; the client now calls the real endpoints only. Removed `SessionGuard`: `src/proxy.ts` already redirects logged-out page requests and signed-in `/login` and `/signup` requests on the server, and `/` still handles a 401 from `GET /api/me` itself. No mismatch found between the UI and the real responses, so no UI change and no contract change. Branch was cut from the merge of `feature/auth-backend` and `feature/auth-frontend` because neither was in `main` yet. Verified against a real Supabase project over HTTP; browser-only checks (UI states, back/refresh) were not run because the Chrome extension was not connected.
- **2026-10-15: Vendor portal, backend** (branch `feature/vendor-portal-backend`, not merged). Added `supabase/sql/004_vendor_portal.sql` (unique index on `vendors(owner)`, vendor SELECT and UPDATE policies on `bookings`, column-level grant so only `status` is updatable, and `vendor_incoming_bookings()`), the routes `GET /api/vendor/bookings` and `PATCH /api/vendor/bookings/:id`, and `src/lib/vendor-portal.ts`. The contract is unchanged. Feature 2 was not merged and has no code in the repo, but its tables, customer policies and vendor seed were already applied to the Supabase project, so the branch was cut from `main` and tested against those real tables (checked against `SPEC-events-booking.md`: they match). Feature 2's checks were rerun at database and RLS level only, because its routes do not exist yet. PATCH returns `already_decided` or `booking_not_found` by checking the vendor's own list after a zero-row update; the update is atomic (`status = 'pending'` in the WHERE), so concurrent PATCHes yield one 200 and the rest 409. Tested with 81 cases covering auth, body validation, ids, state, concurrency, lists, RLS, column tampering and data leaks; all passed. Not tested: a truly expired session (only a garbage session cookie), and the vendor-role 403 on feature 2 endpoints (they do not exist).

## Open questions

Things `SPEC.md` leaves unclear. None have been guessed at.

1. **Deploy timing.** The old workshop rules said to deploy to Vercel before any feature work. The build order here puts deploy last. Which applies? (The old rules are saved in `docs/WORKSHOP-RULES.md`.)
2. **Service categories.** The spec doesn't list the categories (only that venue and catering get the largest budget share).
3. **Checklist per event type.** Which services are expected for wedding, birthday, and corporate events?
4. **Budget shares.** What percentage of the budget goes to each category?
5. **Match % formula.** The spec says it comes from price distance to the category share, but not how distance maps to a percentage.
6. **Vendor data.** How do vendors get created? On vendor sign-up, or seeded? What currency is `price`, and is it a single flat price?
7. **Vendor linking.** How is a vendor user linked to a vendor record (created at sign-up, or chosen)? Bookings for vendors with no owner can't be seen by anyone; is that intended?
8. **Booking rules.** Can a customer book several vendors in one category, cancel a booking, or re-book after a decline? Declined bookings leave the category a gap per the rule; is that the full behaviour?
9. **Events.** Can events be edited or deleted? Can a customer have several events?
10. **Chatbot.** Is chat history stored, or per session only? Is "first and last" a single ordered list of categories or of specific vendors?
11. **LLM provider.** Which "provided LLM API" is it, and what env var holds its key?
12. **Branch naming.** Preferred convention for separate frontend and backend branches (e.g. `feature/<name>-frontend` and `feature/<name>-backend`)?
13. **Existing CLAUDE.md.** I replaced the earlier workshop CLAUDE.md as asked and kept a copy at `docs/WORKSHOP-RULES.md`. Should any of it (e.g. commands, `supabase/sql/` migration convention, "explain changes in plain English") be carried into the new file?
