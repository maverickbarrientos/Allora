# 30 — A cancelled service shows as missing

**What to build:** Once a cancellation is approved, the customer sees the booking as cancelled and the service comes back under "Needs a replacement", so they can book someone else. The vendor's numbers follow.

**Blocked by:** 29

**Status:** done

- [x] The customer plan shows the cancelled booking and lists its service under "Needs a replacement" with a "See replacements" action
- [x] The customer can book another vendor for that service, and the same vendor again
- [x] The dashboard counts a request as pending and a cancelled booking as declined, and the budget no longer counts the cancelled price
- [x] The vendor's calendar and dashboard hide cancelled bookings and show a request as pending
- [x] The planning assistant's app guide explains requesting and approving a cancellation
- [x] Works on the live URL: a full request, approve, rebook pass as a customer and a vendor
