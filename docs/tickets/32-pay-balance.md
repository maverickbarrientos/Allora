# 32 — Pay the balance after a deposit

**What to build:** After a customer pays only the deposit, the plan row shows "Deposit paid" and a "Pay balance" link with the amount still owed (the vendor's current price minus what was paid). The pay page then offers only the balance. Paying it makes the booking "Paid in full".

**Blocked by:** 31

**Status:** done

- [x] A deposit-only booking shows "Pay balance" with the correct amount on the plan
- [x] The pay page shows only the balance, and the receipt is titled "Balance paid"
- [x] After paying, deposit plus balance equals the price and the plan shows "Paid in full"
- [x] If the vendor's price changed after the deposit, the balance is still price minus what was paid
- [x] A second balance payment is refused; a balance with no paid deposit is refused ("nothing due")
- [x] Two simultaneous balance payments: one succeeds, one is refused
- [x] Works on the live URL
