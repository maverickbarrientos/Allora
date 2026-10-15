/**
 * TEMPORARY MOCK. Delete this file, and the USE_MOCKS branches in
 * src/lib/api/client.ts, once GET /api/events/:id/dashboard is on main.
 *
 * Serves GET /api/events (the event list) and GET /api/events/:id/dashboard
 * exactly as docs/SPEC-dashboard.md defines them, when
 * NEXT_PUBLIC_USE_MOCKS=true. Sign-in stays real (the server protects pages).
 *
 * Events are dated relative to the viewer's local today: a year ago,
 * yesterday, today, tomorrow, in 2 days, in 100 days, and 2028-02-29.
 * Triggers (event ids): "empty" has no bookings, "complete" has nothing
 * missing, "many" has many actions, "missing" returns 404 event_not_found,
 * "broken" returns 500 server_error. A vendor-role session gets 403 forbidden.
 */

import { ApiError } from "@/lib/api/errors";
import type { Dashboard, DashboardAction, Event, EventType, MissingService } from "@/lib/api/types";
import { addDays, todayYmd } from "@/lib/dates";

const LATENCY_MS = 350;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));

const CHECKLISTS: Record<EventType, string[]> = {
  wedding: ["venue", "catering", "photography", "music", "decoration"],
  birthday: ["venue", "catering", "decoration", "music"],
  corporate: ["venue", "catering", "photography"],
};
const WEIGHTS: Record<string, number> = { venue: 0.35, catering: 0.3, decoration: 0.13, photography: 0.12, music: 0.1 };

function events(): Event[] {
  const today = todayYmd();
  const e = (id: string, name: string, type: EventType, date: string, budget = 100000, guestCount = 80): Event => ({ id, name, type, date, budget, guestCount, notes: null, area: null });
  return [
    e("year-ago", "Company anniversary 2025", "corporate", addDays(today, -365), 60000, 40),
    e("yesterday", "Sam's birthday dinner", "birthday", addDays(today, -1), 20000, 12),
    e("today", "Team offsite (today)", "corporate", today, 80000, 30),
    e("tomorrow", "Mia turns 30", "birthday", addDays(today, 1), 35000, 25),
    e("soon", "Garden wedding", "wedding", addDays(today, 2)),
    e("empty", "Fresh plan, nothing booked", "wedding", addDays(today, 30)),
    e("complete", "Everything booked", "corporate", addDays(today, 45), 50000, 20),
    e("many", "Big wedding with lots to do", "wedding", addDays(today, 60), 250000, 200),
    e("missing", "Event that returns 404", "birthday", addDays(today, 70)),
    e("broken", "Event that returns 500", "corporate", addDays(today, 80)),
    e("far", "A very long event name that keeps going so the picker has to truncate it nicely", "wedding", addDays(today, 100)),
    e("leap", "Leap day party", "birthday", "2028-02-29", 15000, 30),
  ];
}

async function callerRole(): Promise<string | null> {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json())?.profile?.role ?? null;
  } catch {
    return null;
  }
}

function share(event: Event, category: string): number {
  const list = CHECKLISTS[event.type];
  const total = list.reduce((s, c) => s + (WEIGHTS[c] ?? 0), 0);
  return Math.round(((event.budget * (WEIGHTS[category] ?? 0)) / total + Number.EPSILON) * 100) / 100;
}

const action = (type: DashboardAction["type"], n: number, vendorName: string, category: string, amount: number | null = null): DashboardAction => ({
  type, bookingId: `mock-booking-${n}`, vendorName, category, amount,
});

export async function mockListEvents(): Promise<{ events: Event[] }> {
  await wait();
  // Ordered by date, like GET /api/events.
  return { events: events().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
}

export async function mockDashboard(eventId: string): Promise<Dashboard> {
  await wait();
  if ((await callerRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  if (eventId === "broken") throw new ApiError(500, "server_error", "Unexpected error.");
  const event = events().find((e) => e.id === eventId);
  if (!event || eventId === "missing") throw new ApiError(404, "event_not_found", "Event not found.");

  const all = CHECKLISTS[event.type];
  const missing = (cats: string[]): MissingService[] => cats.map((category) => ({ category, budgetShare: share(event, category) }));

  if (eventId === "empty") {
    return { event, bookingCounts: { pending: 0, confirmed: 0, declined: 0 }, actions: [], missing: missing(all) };
  }
  if (eventId === "complete") {
    return { event, bookingCounts: { pending: 0, confirmed: 3, declined: 0 }, actions: [], missing: [] };
  }
  if (eventId === "many") {
    const actions = [
      ...["Grand Garden Hall", "Savory Table Catering", "Lumen Photo Studio", "Brass and Strings Band"].map((v, i) =>
        action("pay_deposit", i + 1, v, all[i], [45000, 24000, 12000, 9000][i])),
      action("find_replacement", 10, "Petal and Ribbon", "decoration"),
      action("find_replacement", 11, "Simple Blooms", "decoration"),
      ...["Candid Frames", "DJ Nightshift", "Luxe Event Styling", "Seaside Pavilion", "Home Kitchen Feasts", "The Loft Events Space"].map((v, i) =>
        action("awaiting_vendor", 20 + i, v, ["photography", "music", "decoration", "venue", "catering", "venue"][i])),
    ];
    return { event, bookingCounts: { pending: 6, confirmed: 4, declined: 2 }, actions, missing: missing(["decoration"]) };
  }
  // Default: one of each action and two missing services.
  const cats = all.slice(0, 3);
  return {
    event,
    bookingCounts: { pending: 1, confirmed: 1, declined: 1 },
    actions: [
      action("pay_deposit", 1, "Grand Garden Hall", cats[0], 10500),
      action("find_replacement", 2, "Savory Table Catering", cats[1]),
      action("awaiting_vendor", 3, "Lumen Photo Studio", cats[2] ?? cats[0]),
    ],
    missing: missing(all.filter((c) => c !== cats[0] && c !== cats[2])),
  };
}
