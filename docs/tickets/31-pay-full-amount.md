# 31 — Pay the full amount at checkout

**What to build:** On the pay page for a confirmed booking with nothing paid, the customer chooses "Deposit" (balance later) or "Full amount" and the button shows the amount. Paying the full amount records one payment of the vendor's price. The plan row, the vendor's badge and the receipt then say "Paid in full".

**Blocked by:** None

**Status:** todo

- [ ] The pay page shows Deposit and Full amount with their amounts; Deposit is the default
- [ ] Paying the full amount shows a "Payment complete" receipt with the price as the amount
- [ ] The plan row shows "Paid in full" with the amount; the vendor portal badge shows "Paid in full" and never the reference
- [ ] The booking receipt page says "Paid in full"
- [ ] Paying again returns "already paid"; a pending or declined booking still can't be paid
- [ ] Declined test outcome records nothing and can be retried
- [ ] Status is in words, not only colour; works on a phone at 375px wide
- [ ] Works on the live URL
