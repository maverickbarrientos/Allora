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
 * Month grid, weeks starting on Sunday. Read-only unless `onDayClick` is set,
 * in which case each day is a button. Every day has an aria-label with the
 * full date and its status.
 */
export function MonthGrid({
  month,
  onMonthChange,
  dayInfo,
  highlight,
  highlightLabel = "Event date",
  onDayClick,
  selectedDate,
  extraControls,
}: {
  month: YearMonth;
  onMonthChange: (next: YearMonth) => void;
  dayInfo: (date: Ymd) => DayInfo;
  highlight?: Ymd;
  highlightLabel?: string;
  onDayClick?: (date: Ymd) => void;
  selectedDate?: Ymd | null;
  extraControls?: React.ReactNode;
}) {
  const { year, month: m } = month;
  const lead = weekdayOf(year, m, 1);
  const total = daysInMonth(year, m);
  const cells: (Ymd | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => ymd(year, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const step = (delta: number) => {
    const index = year * 12 + (m - 1) + delta;
    onMonthChange({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
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
                const status = [info.label, isHighlight ? highlightLabel : ""].filter(Boolean).join(", ") || "Available";
                const label = `${longDate(date)}, ${status}`;
                const inner = (
                  <>
                    <span className="text-sm">{Number(date.slice(8))}</span>
                    {info.label && <span className="block truncate text-[0.625rem] leading-tight">{info.label}</span>}
                  </>
                );
                const cls = cn(
                  "flex min-h-11 w-full flex-col items-center justify-center rounded-lg px-0.5 py-1",
                  info.tone && TONE[info.tone],
                  isHighlight && "ring-2 ring-forest ring-offset-1 ring-offset-background font-semibold",
                  selectedDate === date && "outline outline-2 outline-ink",
                );
                return (
                  <td key={d} className="p-0.5">
                    {onDayClick ? (
                      <button type="button" className={cls} aria-label={label} aria-pressed={selectedDate === date} onClick={() => onDayClick(date)}>
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
