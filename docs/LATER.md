# Later

Good ideas that are not in the MVP.

Parking something here is a decision, not a loss. It is how the MVP
stays small enough to actually ship by Session 3.

## Pending bookings on a newly blocked date
When a vendor blocks a date that already has pending bookings, those stay pending and can't be confirmed later (`date_unavailable`). The customer only finds out when the vendor declines. Later: warn the vendor when blocking (listing the pending bookings), or decline them automatically. Parked from SPEC-availability.md on 2026-10-16.

## Contracts and receipts: extras
Parked from docs/PROBLEM.md on 2026-10-16. The MVP is vendor terms agreed per booking, plus a printable contract and receipt.
- E-signatures
- Emailing the contract or receipt as a PDF
- Editing a contract after the customer agreed
- Contract wording written by Allora or by the AI
- A separate deposit-only receipt
- A PDF-generation library (the MVP uses the browser's save-as-PDF)
- Vendors viewing the contract and receipt pages for bookings addressed to them (RLS already allows it; only the screens are missing). Cut from SPEC-booking-documents.md to fit one session.

## Parked

- **Email notifications for new messages and booking decisions.** Needs an email service outside the current stack (asked 2026-10-16 while planning Messages).
- **Rate limit on messages.** Any customer can book any vendor and then send unlimited messages to them; a vendor could be flooded. Fine for a demo; add a limit per customer and conversation before production (found in the Messages review, 2026-10-16).
