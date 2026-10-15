# 33 — Declining refunds the deposit and the balance

**What to build:** When a vendor declines a booking that has a paid deposit and balance, both payments are refunded together and the customer sees "Deposit refunded". If the vendor confirms again, the customer can pay again.

**Blocked by:** 32

**Status:** done

- [x] Declining a deposit-and-balance booking marks both payments refunded in one step
- [x] Declining a fully paid (full amount) booking refunds it
- [x] The customer sees "Deposit refunded" and the vendor sees "Refunded"
- [x] After confirming again, the customer can pay a deposit or the full amount
- [x] A vendor declining while the customer pays never leaves a paid payment on a declined booking
- [x] Works on the live URL
