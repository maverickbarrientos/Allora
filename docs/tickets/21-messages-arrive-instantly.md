# 21 — Messages arrive instantly

**What to build:** When one side sends a message, it appears on the other side's open conversation without reloading.

**Blocked by:** 20

**Status:** done

- [x] A message sent by the other side appears within a few seconds without a reload
- [x] My own message appears once, not twice
- [x] Someone who isn't in the conversation receives nothing, even when listening directly
- [x] Leaving the page stops listening
- [ ] Works on the live URL

**Notes (2026-10-16):** SQL `026_messages_realtime.sql` run on the live project: `messages` added to the Realtime publication, and logged-out users given SELECT on it (RLS still returns them nothing; without it Realtime sent them an empty event for every insert). 18 checks passed on a local production build against the live database: the other side's open page shows a new message in about a second with no reload, in either direction; my own message shows once; another customer, another vendor and a logged-out listener receive nothing, and a logged-out read returns no rows; a message in another conversation never appears; the message sent while away is there when coming back, with no duplicates; no browser errors. Fixed from the first run: the page joined Realtime before its session was read from the cookies, so it listened as logged out and got nothing; it now sets the session first. Not checked on the Vercel preview URL itself.
