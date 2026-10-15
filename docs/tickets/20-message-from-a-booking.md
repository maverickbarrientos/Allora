# 20 — Customer and vendor message each other

**What to build:** Once a customer books a vendor, both of them can open their conversation from the booking and write to each other. While they have a pending or confirmed booking, the conversation is open. With only declined bookings, it becomes read-only.

**Blocked by:** None

**Status:** todo

- [ ] Booking a vendor creates one conversation for that customer and vendor; booking them again on another event reuses it
- [ ] A "Message" link on each booking row of the plan and of the vendor's bookings page opens the conversation
- [ ] Both sides can send a message and see it, oldest first, theirs on the right, with line breaks kept
- [ ] Empty messages and messages over 2,000 characters are refused
- [ ] With only declined bookings, the conversation is read-only and says why; sending is refused
- [ ] Another customer, another vendor and a logged-out visitor can't read or send, even straight through the database
- [ ] Nobody can edit or delete messages
- [ ] Works on the live URL
