# 31 — Pay the full amount at checkout

**What to build:** On the pay page for a confirmed booking with nothing paid, the customer chooses "Deposit" (balance later) or "Full amount" and the button shows the amount. Paying the full amount records one payment of the vendor's price. The plan row, the vendor's badge and the receipt then say "Paid in full".

**Blocked by:** None

**Status:** done

- [x] The pay page shows Deposit and Full amount with their amounts; Deposit is the default
- [x] Paying the full amount shows a "Payment complete" receipt with the price as the amount
- [x] The plan row shows "Paid in full" with the amount; the vendor portal badge shows "Paid in full" and never the reference
- [x] The booking receipt page says "Paid in full"
- [x] Paying again returns "already paid"; a pending or declined booking still can't be paid
- [x] Declined test outcome records nothing and can be retried
- [x] Status is in words, not only colour; works on a phone at 375px wide
- [x] Works on the live URL
