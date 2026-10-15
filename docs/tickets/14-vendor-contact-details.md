# 14 — Vendors add contact details

**What to build:** A vendor can add a phone number, an email address and a website to their profile, knowing customers will only see them after the vendor confirms their booking.

**Blocked by:** 12

**Status:** todo

- [ ] The profile page has a "Contact details" section with Phone, Email and Website, and the line "Customers see these only after you confirm their booking."
- [x] Each field can be saved, changed and cleared
- [ ] A phone with letters, a badly formed email, or a website that isn't an http or https link is refused, with the error next to the field, and nothing is saved
- [x] Only the vendor who owns the details can add or change them
- [ ] Works on the live URL

**Notes (2026-10-16):** SQL `016_vendor_contacts.sql` run on the live project: RLS on, read for the owner and for customers with a confirmed booking, insert and update for the owner only, no delete, nothing for logged-out users, and format checks in the database too. 43 checks passed against the live database: the profile API (save, change one field, clear with empty text and null, every bad phone, email and website refused with nothing saved, no vendor created when the first save has a bad contact, customer 403) and RLS straight through the browser's key (owner reads; another vendor, a customer without a confirmed booking and a logged-out visitor read nothing; nobody else can insert or update; no delete; a `javascript:` link is refused by the database; pending hides, confirmed shows, declined hides again). Throwaway data deleted. Still to check in the browser: the section, its note, errors next to the fields, phone width, and the live URL.
