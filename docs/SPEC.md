# Allora

Booking and planning platform for events. A customer creates an event, books service vendors, and AI shows what the plan is missing. Vendors manage bookings in their own portal.

## Stack
Next.js (TypeScript, Tailwind, shadcn), route handlers for the API, Supabase, provided LLM API (server-side only), deployed on Vercel.

## Roles
- **Customer**: creates events, books vendors, views the plan.
- **Vendor**: sees incoming bookings, accepts or declines.
- Each user has a role, stored on their profile.

## Auth
- Supabase Auth with email and password. Sign up, log in, log out.
- On sign up the user picks a role (customer or vendor). It is saved in a `profiles` table (`id` = auth user id, `role`, `name`).
- A vendor user is linked to one vendor record.
- Logged-out visitors are sent to the login page; only the login and sign-up pages are public.
- Row Level Security on every table, scoped to the signed-in user:
  - Customers read and write only their own events and bookings.
  - Vendors read and update (accept or decline) only bookings addressed to them.
  - Everyone signed in can read vendors.
  - Users read and update only their own profile.
- Only the Supabase URL and publishable key reach the browser. No `service_role` key.
- Vendors insert and update only their own vendor record.


## Features
**Customer**
- Create an event (type, date, budget, guest count)
- Browse vendors by category
- Book a vendor
- View the plan with bookings and status (pending, confirmed, declined)

**Vendor portal**
- List of incoming bookings
- Accept or decline; status shows on the customer's plan
- Create and edit own vendor profile (name, category, price)
- Change an accept or decline later (confirmed and declined, not back to pending)
- See the customer's name and the event budget on each booking addressed to them

**AI 1: "What's missing" cards**
- Compare the event to a checklist of services for its type
- One card per gap with a short why-it-matters note
- Each card lists up to 3 matched vendors with a match % and a one-line reason
- Booking from a card updates the plan and removes the card

**AI 2: Planning chatbot**
- Knows the event and current bookings
- Recommends what to book first and last, shown as an ordered list

## Smart Matching
Each service category gets a share of the event budget (venue and catering largest). Vendors are ranked by how close their price is to that share, and the match % comes from that distance. The AI only writes the reason text; it never picks or reorders vendors.

## Data
- **Profile**: id (auth user), role, name
- **Event**: owner (profile), type, date, budget, guestCount
- **Vendor**: name, category, price, owner (profile, optional)
- **Booking**: event, vendor, category, status

A category with no pending or confirmed booking counts as a gap.

## Event Types
Wedding, birthday, corporate.
