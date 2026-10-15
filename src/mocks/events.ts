/**
 * TEMPORARY MOCK. Delete this file, its import in src/mocks/dashboard.ts and
 * the USE_MOCKS branches for getPlan, updateEvent and deleteEvent in
 * src/lib/api/client.ts when the event delete frontend is connected.
 *
 * Serves DELETE /api/events/:id exactly as docs/SPEC-event-delete.md defines
 * it (204, 404 event_not_found, 409 event_has_pending_bookings, 409
 * event_not_finished, 403, 500), plus GET /api/events/:id/plan and
 * PATCH /api/events/:id for the mock events, when NEXT_PUBLIC_USE_MOCKS=true.
 * Sign-in stays real (the server protects pages).
 *
 * Triggers (event ids): "pending" returns 409 event_has_pending_bookings and
 * "confirmed" returns 409 event_not_finished (their plan shows no bookings
 * until that 409, so the button is enabled and the 409 is reachable);
 * "missing" returns 404; "broken" returns 500. A vendor-role session gets 403.
 * Other mock events follow the delete rule using the local calendar date in
 * place of the database date. A successful delete removes the event from the
 * mock data (kept in localStorage, so it stays gone across pages).
 */

import { ApiError } from "@/lib/api/errors";
import type { BookingStatus, Event, EventType, PlanBooking, UpdateEventInput } from "@/lib/api/types";
import { addDays, todayYmd } from "@/lib/dates";

const LATENCY_MS = 350;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const STORE_KEY = "allora-mock-events";

type Store = { deleted: string[]; revealed: string[]; edits: Record<string, UpdateEventInput> };

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (s && Array.isArray(s.deleted)) return { deleted: s.deleted, revealed: s.revealed ?? [], edits: s.edits ?? {} };
  } catch {}
  return { deleted: [], revealed: [], edits: {} };
}
function save(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

// Same check as src/mocks/dashboard.ts: the real session's role.
async function callerRole(): Promise<string | null> {
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json())?.profile?.role ?? null;
  } catch {
    return null;
  }
}

/** Extra events for the delete cases, dated from the viewer's local today. */
function deleteCaseEvents(): Event[] {
  const today = todayYmd();
  const e = (id: string, name: string, type: EventType, date: string): Event => ({ id, name, type, date, budget: 50000, guestCount: 40, notes: null });
  return [
    e("no-bookings", "Delete: no bookings", "birthday", addDays(today, 20)),
    e("declined-only", "Delete: only declined bookings", "birthday", addDays(today, 20)),
    e("pending", "Delete: server says pending (409)", "wedding", addDays(today, 20)),
    e("confirmed", "Delete: server says not finished (409)", "wedding", addDays(today, 20)),
    e("pending-upcoming", "Delete: pending, upcoming", "corporate", addDays(today, 25)),
    e("confirmed-upcoming", "Delete: confirmed, upcoming", "corporate", addDays(today, 25)),
    e("confirmed-finished", "Delete: confirmed, finished", "corporate", addDays(today, -5)),
    e("confirmed-declined", "Delete: confirmed and declined, finished", "wedding", addDays(today, -5)),
    e("pending-finished", "Delete: pending on a finished event", "birthday", addDays(today, -5)),
  ];
}

/** Booking statuses the "server" holds for each mock event. */
const BOOKINGS: Record<string, BookingStatus[]> = {
  "declined-only": ["declined", "declined"],
  pending: ["pending"],
  confirmed: ["confirmed", "declined"],
  "pending-upcoming": ["pending", "pending", "confirmed"],
  "confirmed-upcoming": ["confirmed", "confirmed"],
  "confirmed-finished": ["confirmed"],
  "confirmed-declined": ["confirmed", "declined", "declined"],
  "pending-finished": ["pending"],
  // Date cases from the dashboard mock: one confirmed booking each.
  yesterday: ["confirmed"],
  today: ["confirmed"],
  tomorrow: ["confirmed"],
  leap: ["confirmed"],
};
/** These show no bookings on the plan until their 409 has been returned. */
const STALE_UNTIL_409 = ["pending", "confirmed"];

const VENDORS = ["Golden Hour Studio", "Harbor Hall", "Saffron Table", "Velvet Strings", "Bloom & Twine"];
const CATEGORIES = ["photography", "venue", "catering", "music", "decoration"];

function bookingsFor(event: Event, store: Store): PlanBooking[] {
  const stale = STALE_UNTIL_409.includes(event.id) && !store.revealed.includes(event.id);
  if (stale) return [];
  return (BOOKINGS[event.id] ?? []).map((status, i) => ({
    id: `${event.id}-b${i + 1}`,
    eventId: event.id,
    vendorId: `mock-vendor-${i + 1}`,
    vendorName: VENDORS[i % VENDORS.length],
    category: CATEGORIES[i % CATEGORIES.length],
    price: 10000 + i * 2500,
    status,
    createdAt: "2026-01-01T00:00:00Z",
    payment: null,
  }));
}

/**
 * The dashboard mock's events plus the delete cases, without deleted events
 * and with mock edits applied. Used by src/mocks/dashboard.ts too.
 */
export function liveMockEvents(base: Event[]): Event[] {
  const store = load();
  return [...base, ...deleteCaseEvents()]
    .filter((e) => !store.deleted.includes(e.id))
    .map((e) => ({ ...e, ...(store.edits[e.id] ?? {}) }) as Event);
}

// The dashboard mock's base events, loaded lazily (it imports this file).
async function find(id: string): Promise<Event | undefined> {
  const { events } = await import("./dashboard");
  return liveMockEvents(events()).find((e) => e.id === id);
}

export async function mockGetPlan(eventId: string): Promise<{ event: Event; bookings: PlanBooking[] }> {
  await wait();
  if ((await callerRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  const event = await find(eventId);
  if (!event) throw new ApiError(404, "event_not_found", "Event not found.");
  return { event, bookings: bookingsFor(event, load()) };
}

export async function mockUpdateEvent(eventId: string, input: UpdateEventInput): Promise<{ event: Event }> {
  await wait();
  if ((await callerRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  if (!(await find(eventId))) throw new ApiError(404, "event_not_found", "Event not found.");
  const store = load();
  store.edits[eventId] = { ...(store.edits[eventId] ?? {}), ...input };
  save(store);
  return { event: (await find(eventId))! };
}

export async function mockDeleteEvent(eventId: string): Promise<void> {
  await wait();
  if ((await callerRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  if (eventId === "broken") throw new ApiError(500, "server_error", "Unexpected error.");
  const event = await find(eventId);
  if (!event || eventId === "missing") throw new ApiError(404, "event_not_found", "Event not found.");

  const store = load();
  const statuses = BOOKINGS[eventId] ?? [];
  const pending = statuses.filter((s) => s === "pending").length;
  const confirmed = statuses.filter((s) => s === "confirmed").length;
  if (STALE_UNTIL_409.includes(eventId) && !store.revealed.includes(eventId)) {
    store.revealed.push(eventId);
    save(store);
  }
  // Same order and messages as the trigger and the route.
  if (pending > 0) {
    throw new ApiError(409, "event_has_pending_bookings", `This event has ${pending} pending booking${pending === 1 ? "" : "s"}. Wait for the vendors to respond first.`);
  }
  if (confirmed > 0 && !(event.date < todayYmd())) {
    throw new ApiError(409, "event_not_finished", `This event has confirmed bookings and hasn't finished. It can be deleted after ${event.date}.`);
  }
  store.deleted.push(eventId);
  save(store);
}

/** For the console: forget mock deletes, edits and revealed 409s. */
export function resetMockEvents() {
  save({ deleted: [], revealed: [], edits: {} });
}
