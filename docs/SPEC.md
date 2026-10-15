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
- Logged-out visitors are sent to the login page; only the landing page (`/`), login and sign-up are public. Signed-in users who open `/` go to their dashboard. The customer events list is at `/events`.
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
- View a vendor's profile page (about, location, price, availability; contact details once the vendor confirms a booking)
- View the plan with bookings and status (pending, confirmed, declined)
- See a vendor's availability in a calendar when booking; a vendor can only be booked on an available date (see SPEC-availability.md)
- Choose the event's services when creating it, and add or remove them later on the plan and edit pages (more categories: florist, cake, lighting, transport, makeup)
- Dashboard for one selected event: countdown, bookings by status, actions needed, and missing services
- Agree to a vendor's terms before booking them, then open and download each booking's contract and receipt as PDFs (see SPEC-booking-documents.md)

**Vendor portal**
- List of incoming bookings
- Accept or decline; status shows on the customer's plan
- Create and edit own vendor profile (name, category, price, about, location, and contact details shown to a customer only after a confirmed booking; see SPEC-vendor-profiles.md)
- Change an accept or decline later (confirmed and declined, not back to pending)
- See the customer's name and the event budget on each booking addressed to them
- Write own terms (cancellation, deposit, what's included) on the vendor profile
- Calendar to block and unblock unavailable dates, and to see bookings by date
- A vendor is unavailable on dates they blocked and on dates of their confirmed bookings; a booking can't be made or confirmed on an unavailable date, and an event's date can't change once it has a confirmed booking (see SPEC-availability.md)


**AI 1: "What's missing" cards**
- Compare the event to its own list of services (it starts from its type's template; the customer can add or remove services)
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
- **Vendor**: name, category, price, about, location, owner (profile, optional), terms (optional)
- **Vendor contact**: vendor, phone, email, website (readable by the owner and by customers with a confirmed booking)
- **Booking**: event, vendor, category, status, termsSnapshot and termsAcceptedAt (set by the database when the booking is created, never changed; see SPEC-booking-documents.md)
- **Event service**: event, category, position (the event's own list of services; see SPEC-event-services.md)
- **Blocked date**: vendor, date (a date the vendor is unavailable)

A service on the event's list with no pending or confirmed booking counts as a gap.

## Event Types
Wedding, birthday, corporate.

