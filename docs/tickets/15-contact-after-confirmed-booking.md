# 15 — Customers see contact details after a confirmed booking

**What to build:** Once a vendor confirms a customer's booking, that customer sees the vendor's phone, email and website on the vendor's page, so they can get in touch. Until then, the page explains when the details will appear.

**Blocked by:** 13, 14

**Status:** todo

- [ ] With no booking, or only a pending or declined one, the page says "Contact details appear here once {vendor} confirms your booking." and no contact details reach the browser
- [ ] After the vendor confirms, the customer sees the phone (tap to call), the email (tap to write) and the website (opens in a new tab); empty fields are left out
- [ ] If the vendor has added no contact details, the page says so
- [x] If the vendor later declines or cancels the booking, the details are hidden again
- [x] Another customer, another vendor and a logged-out visitor can't read the details, even by querying the database directly
- [ ] Works on the live URL

**Notes (2026-10-16):** 25 checks passed on a local production build against the live database: no booking and pending give `contact: null` and the phone, email and website appear nowhere in the response text; after the vendor confirms the customer gets all three (with or without eventId); another customer, another vendor and a logged-out visitor get nothing, through the API and straight through the database; declining (also how a vendor cancels) hides them again and confirming again shows them; a confirmed vendor with no details gives all nulls; a cleared field comes back null; the vendor's owner id is never sent. Throwaway data deleted. Still to check in the browser: the wording on the page, tap to call and write, the website opening in a new tab, phone width, and the live URL.
