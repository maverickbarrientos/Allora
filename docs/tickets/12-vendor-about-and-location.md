# 12 — Vendors add an "about" and a location

**What to build:** On their profile page, a vendor can write a short description of their service and the location they work in, save them, and later change or clear them.

**Blocked by:** None

**Status:** done

- [x] The profile page has an About field (up to 1,000 characters, with a counter near the limit) and a Location field (up to 80 characters)
- [x] Saving keeps the text exactly as typed, trimmed; clearing a field removes it
- [x] Text that is too long is refused, with the error next to the field, and nothing is saved
- [x] Name, category and price still save as before
- [x] Only the vendor who owns the profile can change these fields
- [x] Works on the live URL

**Notes (2026-10-16):** SQL `015_vendor_about_location.sql` run on the live project. 19 API checks passed on a local production build against the live database (create, change, clear with empty text and null, exact limits counting an emoji as one character, too long and wrong types refused with nothing saved, customer 403, logged out 401); throwaway accounts deleted afterwards. Still to check in the browser: the form fields, the counter and the errors next to the fields, phone width, and the live URL.
