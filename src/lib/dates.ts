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
