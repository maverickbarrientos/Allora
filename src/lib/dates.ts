// Plain calendar dates as "YYYY-MM-DD" strings (docs/SPEC-availability.md:
// no timezone conversion anywhere). Dates are built from year, month and day;
// weekday and month length use Date.UTC on those parts, which never shifts a
// day. Never parse with new Date("YYYY-MM-DD") or format with toISOString.

export type Ymd = string;
export type YearMonth = { year: number; month: number }; // month 1-12

const pad = (n: number) => String(n).padStart(2, "0");

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ymd(year: number, month: number, day: number): Ymd {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseYmd(date: Ymd): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday. */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthOf(date: Ymd): YearMonth {
  const { year, month } = parseYmd(date);
  return { year, month };
}

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}

/** First and last day of the month, for `from` and `to` query parameters. */
export function monthRange({ year, month }: YearMonth): { from: Ymd; to: Ymd } {
  return { from: ymd(year, month, 1), to: ymd(year, month, daysInMonth(year, month)) };
}

/** Today on the viewer's own calendar (the local date parts, no conversion). */
export function todayYmd(): Ymd {
  const now = new Date();
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** e.g. "Saturday, 12 September 2027", for accessible labels. */
export function longDate(date: Ymd): string {
  const { year, month, day } = parseYmd(date);
  return `${WEEKDAY_NAMES[weekdayOf(year, month, day)]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Whole days from `today` to `date` (negative when past), from the date parts only. */
export function daysFrom(today: Ymd, date: Ymd): number {
  const day = (d: Ymd) => {
    const { year, month, day: dd } = parseYmd(d);
    return Date.UTC(year, month - 1, dd) / 86_400_000;
  };
  return Math.round(day(date) - day(today));
}

/** Countdown text (docs/SPEC-dashboard.md): "Today", "Tomorrow", "{n} days to go", "Happened {n} days ago". */
export function countdownText(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `${days} days to go`;
  const ago = -days;
  return `Happened ${ago} ${ago === 1 ? "day" : "days"} ago`;
}

/** `date` plus `n` days (n may be negative), from the date parts only. */
export function addDays(date: Ymd, n: number): Ymd {
  const { year, month, day } = parseYmd(date);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** "YYYY-MM" (a `?month=` value) to a month, or null when it isn't a valid month. */
export function parseMonthKey(value: string | null | undefined): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** Vendor countdown (docs/SPEC-vendor-dashboard.md): "In {n} days", "Tomorrow", "Today", "Yesterday", "{n} days ago". */
export function relativeDayText(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 1 ? `In ${days} days` : `${-days} days ago`;
}

/** e.g. "February 14, 2027", from the date parts only. */
export function formatYmd(date: Ymd): string {
  const { year, month, day } = parseYmd(date);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}
