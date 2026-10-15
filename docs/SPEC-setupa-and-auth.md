# SPEC-setup-and-auth.md

## Goal
Users sign up (choosing customer or vendor), log in and out, and only signed-in users reach the app. RLS protects `profiles`.

## User flow
1. Visitor opens any page while logged out and is redirected to `/login`.
2. `/signup`: name, email, password, role (customer or vendor). On success the user is signed in and sent to `/`.
3. `/login`: email and password. On success the user is sent to `/`.
4. `/`: placeholder showing the user's name and role, plus a log out button. Logging out sends the user to `/login`.
5. A signed-in user who opens `/login` or `/signup` is redirected to `/`.

## Data and tables
- `profiles`: `id` (uuid, PK, references auth.users, on delete cascade), `role` (text, not null, check in ('customer','vendor')), `name` (text, not null).
- Trigger on `auth.users` insert: a security definer function with an empty search_path creates the profile from `raw_user_meta_data` (`name`, `role`).
- Assumption: no other tables in this feature. Vendor-record linking is deferred.

## RLS (profiles)
- Enable RLS.
- SELECT: `id = auth.uid()`.
- UPDATE: `id = auth.uid()`, and `role` must stay unchanged (Assumption: role is immutable after sign-up).
- No INSERT policy (the trigger creates the row) and no DELETE policy.

## Shared shapes
- `User` = `{ id: string, email: string }`
- `Profile` = `{ id: string, name: string, role: "customer" | "vendor" }`
- Error body (all errors) = `{ error: { code: string, message: string } }`

## API
All routes are route handlers. Auth uses cookie sessions via the Supabase server client with the publishable key.

### POST /api/auth/signup
- Body: `{ email, password, name, role }`
- 201: `{ user: User, profile: Profile }` (session cookie set)
- 400 `validation_error`: invalid email, password under 8 characters, empty name, role not customer or vendor
- 409 `email_taken`
- 500 `server_error`

### POST /api/auth/login
- Body: `{ email, password }`
- 200: `{ user: User, profile: Profile }` (session cookie set)
- 400 `validation_error`: missing or malformed fields
- 401 `invalid_credentials`
- 500 `server_error`

### POST /api/auth/logout
- No body.
- 204, session cleared. Idempotent: also 204 when logged out.

### GET /api/me
- 200: `{ user: User, profile: Profile }`
- 401 `unauthorized`

## Route protection
- Public: `/login`, `/signup`, and `/api/auth/*`. Everything else requires a session.
- Logged-out page requests redirect to `/login`. Logged-out `/api/*` requests (except `/api/auth/*`) return 401 `unauthorized`.
- Signed-in requests to `/login` or `/signup` redirect to `/`.

## UI screens and states
- `/login`: idle, submitting (button disabled with spinner), error (inline message: `invalid_credentials` as "Wrong email or password", `validation_error` per field, `server_error` as a generic message).
- `/signup`: same states. `email_taken` shows under the email field. Role is a required choice with no default.
- `/`: loading (while `GET /api/me` resolves), loaded (name, role, log out button), error (401 redirects to `/login`; other errors show a retry message). No empty state.

## Acceptance criteria
1. Sign up as customer and as vendor. Each creates an auth user and a `profiles` row with the right role and name.
2. Duplicate email returns 409 and the UI shows it. Short password and missing role return 400.
3. Login works and `/` shows the correct name and role. A wrong password returns 401.
4. Logout clears the session. Back or refresh lands on `/login`.
5. Logged-out visits to `/` redirect to `/login`. Logged-out `GET /api/me` returns 401.
6. RLS: user A cannot read or update user B's profile. A user cannot change their own `role`.
7. No `service_role` key in the repo. Only the Supabase URL and publishable key are used client-side.