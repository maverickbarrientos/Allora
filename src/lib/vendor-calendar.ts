import type { VendorCalendar } from "@/lib/api/types";
import type { DayInfo } from "@/components/month-grid";
import type { Ymd } from "@/lib/dates";

/**
 * How a day of the vendor calendar is marked, shared by /vendor/calendar and
 * the dashboard's mini grid so both always agree: confirmed wins, then
 * blocked, then pending.
 */
export function calendarDays(data: VendorCalendar | null) {
  const blocked = new Set(data?.blocked ?? []);
  const byDate = new Map<Ymd, VendorCalendar["bookings"]>();
  for (const b of data?.bookings ?? []) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);

  const dayInfo = (date: Ymd): DayInfo => {
    const list = byDate.get(date) ?? [];
    // A day can be both (old data, or a confirm before ticket 10's rule): say so.
    if (list.some((b) => b.status === "confirmed")) {
      return blocked.has(date) ? { label: "Confirmed, Blocked", tone: "confirmed" } : { label: "Confirmed", tone: "confirmed" };
    }
    if (blocked.has(date)) {
      return list.length > 0 ? { label: "Blocked, Pending", tone: "blocked" } : { label: "Blocked", tone: "blocked" };
    }
    if (list.length > 0) return { label: "Pending", tone: "pending" };
    return {};
  };

  const days = [...byDate.entries()];
  const counts = {
    booked: days.filter(([, list]) => list.some((b) => b.status === "confirmed")).length,
    pending: days.filter(([, list]) => list.some((b) => b.status === "pending")).length,
    blocked: blocked.size,
  };
  return { byDate, dayInfo, counts };
}
