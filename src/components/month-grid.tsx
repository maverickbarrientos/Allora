"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES, daysInMonth, longDate, monthLabel, weekdayOf, ymd, type YearMonth, type Ymd } from "@/lib/dates";
import { Button } from "@/components/ui/button";

/** What a day shows: a short text label (never colour alone) and a pattern. */
export type DayInfo = { label?: string; tone?: "unavailable" | "blocked" | "confirmed" | "pending" };

const TONE: Record<NonNullable<DayInfo["tone"]>, string> = {
  // Diagonal hatching marks days that can't be booked, on top of the text.
  unavailable: "bg-[repeating-linear-gradient(135deg,var(--hairline)_0_2px,transparent_2px_7px)] text-ink-muted",
  blocked: "bg-[repeating-linear-gradient(135deg,var(--hairline)_0_2px,transparent_2px_7px)] text-ink-muted",
  confirmed: "bg-forest/10 text-forest",
  pending: "border border-dashed border-brass text-brass-ink",
};

/**
 * Month grid, weeks starting on Sunday. Days are plain cells unless
 * `onDayClick` is set, in which case each day is a button (Space and Enter
 * work as with any button). `selectedDate` marks one day; `selectedDates`
 * marks several (the vendor calendar's block selection). `readOnly` also
 * hides the month buttons (the page has its own month picker). Every day has
 * an aria-label with the full date and its status.
 */
export function MonthGrid({
  month,
  onMonthChange,
  dayInfo,
  highlight,
  highlightLabel = "Event date",
  onDayClick,
  selectedDate,
  selectedDates,
  extraControls,
  readOnly = false,
}: {
  month: YearMonth;
  onMonthChange?: (next: YearMonth) => void;
  dayInfo: (date: Ymd) => DayInfo;
  highlight?: Ymd;
  highlightLabel?: string;
  onDayClick?: (date: Ymd) => void;
  selectedDate?: Ymd | null;
  selectedDates?: ReadonlySet<Ymd>;
  extraControls?: React.ReactNode;
  readOnly?: boolean;
}) {
  const { year, month: m } = month;
  const lead = weekdayOf(year, m, 1);
  const total = daysInMonth(year, m);
  const cells: (Ymd | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => ymd(year, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const step = (delta: number) => {
    const index = year * 12 + (m - 1) + delta;
    onMonthChange?.({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {!readOnly && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </Button>
          <p className="font-display text-h2" aria-live="polite">
            {monthLabel(month)}
          </p>
          <div className="flex items-center gap-1">
            {extraControls}
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next month">
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}
      <table className="w-full table-fixed border-collapse text-center">
        <caption className="sr-only">{monthLabel(month)}</caption>
        <thead>
          <tr>
            {WEEKDAY_NAMES.map((d) => (
              <th key={d} scope="col" className="pb-1 text-xs font-medium text-ink-muted">
                <abbr title={d} className="no-underline">
                  {d.slice(0, 2)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((date, d) => {
                if (!date) return <td key={d} />;
                const info = dayInfo(date);
                const isHighlight = date === highlight;
                const isSelected = selectedDate === date || !!selectedDates?.has(date);
                const isPicked = !!selectedDates?.has(date);
                // In multi-select, a picked day says so in text too ("Blocked · Selected").
                const shown = isPicked ? [info.label, "Selected"].filter(Boolean).join(" · ") : info.label;
                // A day with nothing on it: "Available" to customers, "Open" on the vendor's own calendar.
                const empty = selectedDates ? "Open" : "Available";
                const status =
                  [info.label, isHighlight ? highlightLabel : "", isPicked ? "Selected" : ""]
                    .filter(Boolean)
                    .join(", ") || empty;
                const label = `${longDate(date)}, ${status}`;
                const inner = (
                  <>
                    <span className="text-sm">{Number(date.slice(8))}</span>
                    {shown && <span className="block truncate text-[0.625rem] leading-tight">{shown}</span>}
                  </>
                );
                const cls = cn(
                  "flex min-h-11 w-full flex-col items-center justify-center rounded-lg px-0.5 py-1",
                  // A picked day drops its pattern for a solid fill, so its text stays readable
                  // and it can't be mistaken for the "Today" ring.
                  isPicked ? "bg-foreground text-background" : info.tone && TONE[info.tone],
                  isHighlight && "ring-2 ring-forest ring-offset-1 ring-offset-background font-semibold",
                  selectedDate === date && "outline outline-2 outline-ink",
                );
                return (
                  <td key={d} className="p-0.5">
                    {onDayClick && !readOnly ? (
                      <button type="button" className={cls} aria-label={label} aria-pressed={isSelected} onClick={() => onDayClick(date)}>
                        {inner}
                      </button>
                    ) : (
                      <div className={cls} aria-label={label} role="img">
                        {inner}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Key for the day marks: a swatch with the same pattern plus the text label. */
export function MonthGridLegend({ items }: { items: ("confirmed" | "pending" | "blocked" | "today")[] }) {
  const swatch: Record<(typeof items)[number], string> = {
    confirmed: "bg-forest/10 ring-1 ring-forest/40",
    pending: "border border-dashed border-brass",
    blocked: "bg-[repeating-linear-gradient(135deg,var(--hairline)_0_2px,transparent_2px_7px)] ring-1 ring-border",
    today: "ring-2 ring-forest",
  };
  const text = { confirmed: "Confirmed", pending: "Pending", blocked: "Blocked", today: "Today" };
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {items.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span aria-hidden="true" className={cn("h-4 w-4 rounded", swatch[k])} /> {text[k]}
        </li>
      ))}
    </ul>
  );
}
