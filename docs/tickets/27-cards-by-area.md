# 27 — "What's missing" suggests vendors in the event's area

**What to build:** The vendors on each "What's missing" card come only from the event's area (plus vendors with no area set). Ranking itself doesn't change.

**Blocked by:** 24, 25

**Status:** done

- [x] For an event with an area, no card lists a vendor from another area
- [x] With no event area, the cards are exactly the same as before
- [x] Ranking, match % and budget shares are unchanged; the area rule only narrows the list before ranking
- [x] The AI's input contains no area

**Tests (2026-10-16):** `028_event_area.sql` run on the live project twice with no errors; existing `area` data unchanged (2 events, 1 vendor). 58 API checks on a local production build against the live database and 41 checks in headless Chrome, all passing; my throwaway accounts, vendors and events deleted afterwards. A Parañaque venue priced at the event's venue share: absent from a Cavite event's cards, on the venue card of an event whose area is typed `paraNAQUE` (case and accents ignored), and on the card of an event with no area. The plan page of a Cavite event listed the Cavite venue and not the other area's. Ranking code is untouched; the area rule is one extra filter in `buildCards`. The AI input is built from the ranked cards, which carry only id, name, price and match % (read in the code, not captured).
