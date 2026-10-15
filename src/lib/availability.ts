// Date handling for availability. Dates are plain "YYYY-MM-DD" strings: built
// and compared from year, month and day parts, never through the local time
// zone (no `new Date("YYYY-MM-DD")`, no toISOString).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a valid "YYYY-MM-DD", or null if it is not a real date. */
export function dayNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return null;
  // Date.UTC has no time zone; day 31 in a 30-day month rolls over, so a
  // round trip through the parts catches 2026-02-30 and the like.
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCFullYear(y); // years below 100 are otherwise read as 19xx
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return Math.round(t.getTime() / DAY_MS);
}

export type DateRange = { from: string; to: string };

export const MAX_BLOCK_DATES = 62;

/**
 * Validates a block or unblock body: `dates` is 1 to 62 unique valid dates.
 * Returns them sorted, or a message for a 400.
 */
export function parseDates(body: Record<string, unknown> | null): { dates: string[] } | { error: string } {
  const list = body?.dates;
  if (!Array.isArray(list)) return { error: "dates must be an array." };
  if (list.length < 1 || list.length > MAX_BLOCK_DATES) {
    return { error: `dates must have 1 to ${MAX_BLOCK_DATES} entries.` };
  }
  if (!list.every((d) => dayNumber(d) !== null)) return { error: "Every date must be a valid date (YYYY-MM-DD)." };
  const unique = new Set(list as string[]);
  if (unique.size !== list.length) return { error: "A date is listed twice." };
  return { dates: [...unique].sort() };
}

/** Reads and validates ?from=&to=. Returns the range, or a message for a 400. */
export function parseRange(params: URLSearchParams): DateRange | { error: string } {
  const from = params.get("from");
  const to = params.get("to");
  const f = dayNumber(from);
  const t = dayNumber(to);
  if (f === null || t === null) return { error: "from and to must be valid dates (YYYY-MM-DD)." };
  if (f > t) return { error: "from must not be after to." };
  if (t - f > MAX_RANGE_DAYS) return { error: `The range must be at most ${MAX_RANGE_DAYS} days.` };
  return { from: from as string, to: to as string };
}
