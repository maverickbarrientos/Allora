# Allora: booking contracts and receipts

## Who
Customers planning an event (wedding, birthday, corporate) who book several vendors, and the vendors they book.

> TODO: name the real person from the earlier interview session (Q1).

## The struggle
Each vendor's terms (cancellation, deposit, what's included) and proof of the booking live in separate chat threads. To check what was agreed, the customer has to remember which chat it was in and scroll back through it.

> TODO: add the concrete incident observed in the earlier interview session (Q2).

## Today's workaround
Vendors send their terms and receipts through Messenger or other chats. Finding them later means searching and scrolling through many conversations, one per vendor. Nothing ties the terms to the booking, so it is unclear which version the customer agreed to.

## The MVP
Each booking holds the vendor's terms, which the customer agrees to before booking, and a receipt. The customer finds and downloads both from the event, instead of searching chats.

## How we'll know it worked
The demo shows:
1. A vendor writes their terms.
2. A customer books that vendor and must tick "I agree" first.
3. The vendor confirms, and the customer pays the deposit.
4. The customer opens the event and downloads the contract and the receipt as PDFs.

Before Session 3, the person named in **Who** tries this flow.

Rules:
- The contract is a frozen copy of the terms as agreed. Later edits by the vendor don't change it.
- Only the booking's customer and its vendor can see the contract and the receipt.
- Downloads use the browser's save-as-PDF.
- Bookings without terms show "No terms provided by vendor".
- No AI is involved.

## Out of scope
- E-signatures
- Emailing the PDF
- Editing a contract after the customer agreed
- Contract wording written by Allora or by the AI
- A separate deposit-only receipt
- A PDF-generation library

## Glossary
- **Booking**: one vendor booked for one service on one event.
- **Terms**: the text a vendor writes about their cancellation rules, deposit, and what is included.
- **Contract**: the vendor's terms on a booking, frozen when the customer agreed, plus who agreed and when.
- **Agree**: the required "I agree to the vendor's terms" tick before booking a vendor that has terms.
- **Receipt**: a summary of one booking (event, vendor, service, price, status), plus a "Deposit paid" line with amount and date when a deposit exists.
- **Deposit**: the demo payment of 30% of the vendor's price on a confirmed booking (see SPEC-payment.md).
