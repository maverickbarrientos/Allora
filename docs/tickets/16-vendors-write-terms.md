# 16 — Vendors write their terms

**What to build:** A vendor opens their profile and writes their terms (cancellation, deposit, what's included) in an optional Terms box, next to name, category and price. The terms save, are still there after a reload, and can be edited or cleared later.

**Blocked by:** None

**Status:** todo

- [ ] The vendor profile has an optional Terms box that saves with the rest of the profile
- [ ] Saved terms show again after a reload; clearing the box removes them
- [ ] Only the vendor who owns the record can change its terms, also when tried through the Supabase client directly; other vendors and customers are refused
- [ ] Any signed-in user can read a vendor's terms (customers need them before booking)
- [ ] Long terms with line breaks display with their line breaks; text that looks like HTML shows as plain text
- [ ] Works on the live URL
