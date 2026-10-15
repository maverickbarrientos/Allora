# 13 — Customers open a vendor's profile page

**What to build:** While planning an event, a customer can open any vendor's own page to see who they are before booking: name, category, location, price, their description and whether they are free on the event's date, with a Book button. Vendor names on the vendor list, on the plan and on the "What's missing" cards lead to this page.

**Blocked by:** 12

**Status:** todo

- [ ] The page shows name, category, location, price, availability on the event date and the description, or "No description yet." when there is none
- [ ] Book opens the same availability check as the vendor list; it shows "Booked" when this event already has a pending or confirmed booking with the vendor
- [ ] Vendor cards show the location under the name, and the name opens the vendor's page
- [ ] Vendor names on the plan's bookings and on the "What's missing" cards open the vendor's page for that event
- [ ] Loading, error with Retry, and a not-found page for an unknown vendor; a vendor-role user is sent to their own portal
- [x] Nothing new is sent to the AI, and matching results are unchanged
- [ ] Works at phone width
- [ ] Works on the live URL

**Notes (2026-10-16):** 31 API checks passed on a local production build against the live database: location on the list (null for seeded vendors), the new one-vendor endpoint (about with line breaks, location, no owner, availability on the event date that matches the list before and after the vendor confirms), 404s for unknown or malformed vendor ids and another customer's event, any signed-in role can read, 401 logged out, the "What's missing" cards carry no new fields, and the page answers 200 for a customer and redirects to login when logged out. Throwaway data deleted afterwards. Still to check in the browser: the page layout, Book and Booked, the links from cards, plan and "What's missing", phone width, and the live URL.
