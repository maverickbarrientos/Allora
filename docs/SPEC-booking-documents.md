# Spec: Allora booking documents (contract and receipt)

## Problem
Customers book several vendors for one event, and each vendor's terms and proof of the booking end up in a different chat thread. To check what was agreed, the customer has to remember which chat it was in and scroll back through it. Nothing ties the terms to the booking, so it is unclear which version the customer agreed to.

## Solution
Each booking holds the vendor's terms, which the customer agrees to before booking, and a receipt. The customer opens the event and downloads both as PDFs. The contract stays exactly as agreed, even if the vendor changes their terms later.

## The user
The customer planning an event. The vendor only writes their terms.

## User stories
1. As a vendor, I want to write my terms (cancellation, deposit, what's included) on my profile, so that every customer sees them before booking me.
2. As a customer, I want to read a vendor's terms and tick "I agree" before booking, so that we both know the rules up front.
3. As a customer, I want my contract to keep the terms I agreed to, so that later edits by the vendor don't change my agreement.
4. As a customer, I want to open a booking's contract from my event, so that I don't have to search through chats.
5. As a customer, I want a receipt for each booking that shows the deposit when I've paid one, so that I have proof of what I booked and paid.
6. As a customer, I want to download the contract and the receipt as PDFs, so that I can keep or share them outside the app.

## Screens
1. **Vendor profile** (existing): adds an optional **Terms** text box, saved with name, category and price.
2. **Booking dialog** (the existing availability dialog, used from browse and from the "What's missing" cards): if the vendor has terms, it shows them with a required "I agree to the vendor's terms" tick. Book stays disabled until it is ticked.
3. **Event plan** (existing): each booking row gets **Contract** and **Receipt** links.
4. **Contract** (new, customer only): event, vendor, service, price, the frozen terms, and "Agreed by <customer> on <date>". If there are no terms, it shows "No terms provided by vendor". It has a **Download PDF** button.
5. **Receipt** (new, customer only): event type, date and guest count, then vendor, service, price and booking status. It adds "Deposit paid: <amount> on <date>" when a deposit exists, or "Deposit refunded" when it was refunded. It has a **Download PDF** button.

Download PDF opens the browser's print dialog. The print layout hides the app's navigation.

## Data
No new tables.

- **vendors**, adds `terms` (text, optional): the vendor's terms.
  - Any signed-in user may read it.
  - Only the vendor who owns the record may update it.
- **bookings**, adds `terms_snapshot` (text, optional) and `terms_accepted_at` (time, optional).
  - The database fills both when the booking is created: it copies the vendor's current `terms` and stamps the time of agreement. Any value the browser sends for `terms_snapshot` is ignored.
  - If the vendor has terms and the customer did not agree, the database refuses the booking.
  - Nobody may change either column afterwards. As today, `status` is the only booking column anyone may update.
  - Read and insert rules are unchanged: the event's customer and the booking's vendor may read the row, and only the event's customer may insert a pending booking.
- **payments**: unchanged. The receipt reads the deposit from here.

## Login
Yes, as today: Supabase Auth, email and password. The contract and receipt pages are only for signed-in customers, for bookings on their own events. Anyone else gets "not found".

## Done for the demo
On the live URL:
- [ ] A vendor saves terms on their profile.
- [ ] A customer can't book that vendor until they tick "I agree", from browse and from a "What's missing" card.
- [ ] The contract shows the terms, the customer's name and the time they agreed.
- [ ] The vendor edits their terms. The existing contract is unchanged, and a new booking gets the new terms.
- [ ] A booking with a vendor who has no terms shows "No terms provided by vendor".
- [ ] The vendor confirms and the customer pays the deposit. The receipt shows "Deposit paid" with the amount and date.
- [ ] Both pages download as a clean PDF with no navigation.
- [ ] Another customer opening the same contract or receipt gets "not found".
- [ ] No AI is involved.

## Out of scope
- Vendors viewing the contract and receipt pages (their access rules already allow it; only the screens are missing)
- E-signatures
- Emailing the contract or receipt
- Editing a contract after the customer agreed
- Contract wording written by Allora or by the AI
- A separate deposit-only receipt
- A PDF-generation library
