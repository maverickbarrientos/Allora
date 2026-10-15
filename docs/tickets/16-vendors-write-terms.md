# 16 — Vendors write their terms

**What to build:** A vendor opens their profile and writes their terms (cancellation, deposit, what's included) in an optional Terms box, next to name, category and price. The terms save, are still there after a reload, and can be edited or cleared later.

**Blocked by:** None

**Status:** todo

- [x] The vendor profile has an optional Terms box that saves with the rest of the profile
- [x] Saved terms show again after a reload; clearing the box removes them
- [x] Only the vendor who owns the record can change its terms, also when tried through the Supabase client directly; other vendors and customers are refused
- [x] Any signed-in user can read a vendor's terms (customers need them before booking)
- [x] Long terms with line breaks display with their line breaks; text that looks like HTML shows as plain text
- [ ] Works on the live URL

**Notes (2026-10-16):** Built on `feature/booking-documents`. `017_vendor_terms.sql` (optional `terms` up to 4,000 characters, owner-only column grant) run twice on the live project through the Supabase CLI. Tested on a local production build against the live project with throwaway accounts (deleted afterwards): 25 API and direct-client checks (create, edit, clear, the 4,000 limit, emoji counted as one character, wrong types, 401, 403, other vendors and customers can't change terms, customers can read them, logged out reads nothing, the database limit) and 14 browser checks in headless Chrome (label and note, save and reload with line breaks kept, HTML shown as text, counter, limit error, clear, 375px). Found while testing, not caused by this ticket: the live database had lost the `about, location` update grant from 015 (it now grants an `area` column that is in no branch here), so every profile save from the screen failed; the grant was restored by request. Still to check on the preview URL.
