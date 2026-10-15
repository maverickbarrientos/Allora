# 19 — "What's missing" suggests vendors in the event's area

**What to build:** The vendors on each "What's missing" card come only from the event's area (plus vendors with no area set). Ranking itself doesn't change.

**Blocked by:** 16, 17

**Status:** done

- [x] For an event with a location, no card lists a vendor from another area
- [x] With no event location, the cards are exactly the same as before
- [x] Ranking, match % and budget shares are unchanged; the area rule only narrows the list before ranking
- [x] The AI's input contains no location

**Notes (2026-10-16):** API checks with a Cebu venue priced at the event's venue share: it is on the venue card for a Cebu event and for an event with no location, and absent for a Cavite event. Ranking code is untouched; the area rule is one extra filter in `buildCards`. The AI input is built from the ranked cards, which carry only id, name, price and match % (read in the code, not captured).

**Browser check (2026-10-16):** 39 checks in headless Chrome against a production build and the live project, all passing; throwaway accounts, vendors and events deleted afterwards. The plan page of a Cavite event listed the Cavite venue and no Cebu venue on its "What's missing" venue card, and its header showed Cavite.
