// Event picker order and default for the dashboard (docs/SPEC-dashboard.md).
// Dates are plain "YYYY-MM-DD" strings, which compare correctly as text.

type Dated = { id: string; date: string };

/** Upcoming (today or later) soonest first, then past most recent first. */
export function groupEvents<E extends Dated>(events: readonly E[], today: string): { upcoming: E[]; past: E[] } {
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const past = events.filter((e) => e.date < today).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  return { upcoming, past };
}

/** The first upcoming event, otherwise the most recent past one. */
export function defaultEventId(events: readonly Dated[], today: string): string | null {
  const { upcoming, past } = groupEvents(events, today);
  return (upcoming[0] ?? past[0])?.id ?? null;
}
