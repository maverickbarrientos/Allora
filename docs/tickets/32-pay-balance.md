# 32 — Pay the balance after a deposit

**What to build:** After a customer pays only the deposit, the plan row shows "Deposit paid" and a "Pay balance" link with the amount still owed (the vendor's current price minus what was paid). The pay page then offers only the balance. Paying it makes the booking "Paid in full".

**Blocked by:** 31

**Status:** todo

- [ ] A deposit-only booking shows "Pay balance" with the correct amount on the plan
- [ ] The pay page shows only the balance, and the receipt is titled "Balance paid"
- [ ] After paying, deposit plus balance equals the price and the plan shows "Paid in full"
- [ ] If the vendor's price changed after the deposit, the balance is still price minus what was paid
- [ ] A second balance payment is refused; a balance with no paid deposit is refused ("nothing due")
- [ ] Two simultaneous balance payments: one succeeds, one is refused
- [ ] Works on the live URL
