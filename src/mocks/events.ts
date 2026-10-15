/**
 * TEMPORARY MOCK. Delete this file (and the mocks branch in
 * src/lib/api/client.ts) once the real backend is merged.
 *
 * Implements POST/GET /api/events, GET /api/events/:id/plan, GET /api/vendors
 * and POST /api/bookings as in docs/SPEC-events-booking.md. Enabled with
 * NEXT_PUBLIC_USE_MOCKS=true. Data lives in localStorage. It reads the fake
 * session written by src/mocks/auth.ts to know who is calling.
 *
 * Each mock user gets one sample event with a pending, a confirmed and a
 * declined booking the first time they call an events endpoint.
 *
 * Triggers: budget 0 -> 400 validation_error; event id "missing" -> 404
 * event_not_found; booking the same vendor twice -> 409 already_booked;
 * a vendor-role session -> 403 forbidden on events and bookings.
 */

type EventType = "wedding" | "birthday" | "corporate";
type Status = "pending" | "confirmed" | "declined";
type StoredEvent = {
  id: string;
  owner: string;
  type: EventType;
  date: string;
  budget: number;
  guestCount: number;
};
type StoredBooking = {
  id: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  status: Status;
  createdAt: string;
};
type Store = { events: StoredEvent[]; bookings: StoredBooking[]; seeded: string[] };

const STORE_KEY = "allora.mock.events";
const USERS_KEY = "allora.mock.users"; // written by src/mocks/auth.ts
const SESSION_KEY = "allora.mock.session"; // written by src/mocks/auth.ts
const LATENCY_MS = 400;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const vid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Placeholder vendors, same shape as the planned supabase/sql/003_seed_vendors.sql.
const VENDORS = [
  { id: vid(1), name: "Aurelia Hall", category: "venue", price: 150000 },
  { id: vid(2), name: "Garden Terrace", category: "venue", price: 90000 },
  { id: vid(3), name: "The Old Mill", category: "venue", price: 120000 },
  { id: vid(4), name: "Saffron Table", category: "catering", price: 80000 },
  { id: vid(5), name: "Harvest & Co.", category: "catering", price: 60000 },
  { id: vid(6), name: "Lumen Studio", category: "photography", price: 45000 },
  { id: vid(7), name: "Quiet Frame", category: "photography", price: 30000 },
  { id: vid(8), name: "Velvet Strings", category: "music", price: 25000 },
  { id: vid(9), name: "Night Garden DJ", category: "music", price: 18000 },
  { id: vid(10), name: "Bloom & Brass", category: "decoration", price: 35000 },
  { id: vid(11), name: "Paper Moon Styling", category: "decoration", price: 22000 },
];

const readStore = (): Store => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (s) return s;
  } catch {
    // fall through to an empty store
  }
  return { events: [], bookings: [], seeded: [] };
};
const writeStore = (s: Store) => localStorage.setItem(STORE_KEY, JSON.stringify(s));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fail = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

/** The signed-in mock user, or null. */
function currentUser(): { id: string; role: string } | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const users: { id: string; role: string }[] = JSON.parse(
      localStorage.getItem(USERS_KEY) ?? "[]",
    );
    return users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

const toEvent = ({ owner: _owner, ...event }: StoredEvent) => {
  void _owner;
  return event;
};

function seedFor(store: Store, owner: string) {
  if (store.seeded.includes(owner)) return;
  const eventId = crypto.randomUUID();
  store.seeded.push(owner);
  store.events.push({
    id: eventId,
    owner,
    type: "wedding",
    date: "2027-02-14",
    budget: 500000,
    guestCount: 120,
  });
  const base = Date.now() - 3 * 3600_000;
  (
    [
      [vid(1), "confirmed"],
      [vid(4), "pending"],
      [vid(6), "declined"],
    ] as [string, Status][]
  ).forEach(([vendorId, status], i) => {
    const v = VENDORS.find((x) => x.id === vendorId)!;
    store.bookings.push({
      id: crypto.randomUUID(),
      eventId,
      vendorId,
      vendorName: v.name,
      category: v.category,
      price: v.price,
      status,
      createdAt: new Date(base + i * 60_000).toISOString(),
    });
  });
}

function createEvent(store: Store, owner: string, b: Record<string, unknown>) {
  const { type, date, budget, guestCount } = b;
  if (type !== "wedding" && type !== "birthday" && type !== "corporate")
    return fail(400, "validation_error", "Type must be wedding, birthday or corporate");
  if (typeof date !== "string" || !DATE_RE.test(date) || Number.isNaN(Date.parse(date)))
    return fail(400, "validation_error", "Enter a valid date");
  if (typeof budget !== "number" || !(budget > 0))
    return fail(400, "validation_error", "Budget must be above 0");
  if (typeof guestCount !== "number" || !Number.isInteger(guestCount) || guestCount <= 0)
    return fail(400, "validation_error", "Guest count must be a whole number above 0");

  const event: StoredEvent = { id: crypto.randomUUID(), owner, type, date, budget, guestCount };
  store.events.push(event);
  writeStore(store);
  return json(201, { event: toEvent(event) });
}

const ownEvent = (store: Store, owner: string, id: unknown) =>
  id === "missing" ? undefined : store.events.find((e) => e.id === id && e.owner === owner);

function createBooking(store: Store, owner: string, b: Record<string, unknown>) {
  const { eventId, vendorId } = b;
  if (typeof eventId !== "string" || !eventId || typeof vendorId !== "string" || !vendorId)
    return fail(400, "validation_error", "eventId and vendorId are required");
  const event = ownEvent(store, owner, eventId);
  if (!event) return fail(404, "event_not_found", "Event not found");
  const vendor = VENDORS.find((v) => v.id === vendorId);
  if (!vendor) return fail(404, "vendor_not_found", "Vendor not found");
  if (
    store.bookings.some(
      (x) => x.eventId === eventId && x.vendorId === vendorId && x.status !== "declined",
    )
  )
    return fail(409, "already_booked", "Vendor already booked for this event");

  const booking: StoredBooking = {
    id: crypto.randomUUID(),
    eventId,
    vendorId,
    vendorName: vendor.name,
    category: vendor.category,
    price: vendor.price,
    status: "pending", // always pending
    createdAt: new Date().toISOString(),
  };
  store.bookings.push(booking);
  writeStore(store);
  return json(201, { booking });
}

/** Stands in for fetch() for the five events, vendors and bookings routes. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://mock.local");
  const route = url.pathname;
  let body: Record<string, unknown> = {};
  try {
    body = init.body ? JSON.parse(String(init.body)) : {};
  } catch {
    body = {};
  }

  const user = currentUser();
  if (!user) return fail(401, "unauthorized", "Not signed in");

  // Any signed-in user can read vendors.
  if (method === "GET" && route === "/api/vendors") {
    const category = url.searchParams.get("category");
    const list = VENDORS.filter((v) => !category || v.category === category).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return json(200, { vendors: list });
  }

  if (user.role !== "customer") return fail(403, "forbidden", "Customers only");

  const store = readStore();
  if (!store.seeded.includes(user.id)) {
    seedFor(store, user.id);
    writeStore(store);
  }

  if (method === "POST" && route === "/api/events") return createEvent(store, user.id, body);
  if (method === "GET" && route === "/api/events") {
    const events = store.events
      .filter((e) => e.owner === user.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(toEvent);
    return json(200, { events });
  }

  const plan = route.match(/^\/api\/events\/([^/]+)\/plan$/);
  if (method === "GET" && plan) {
    const event = ownEvent(store, user.id, decodeURIComponent(plan[1]));
    if (!event) return fail(404, "event_not_found", "Event not found");
    const bookings = store.bookings
      .filter((x) => x.eventId === event.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return json(200, { event: toEvent(event), bookings });
  }

  if (method === "POST" && route === "/api/bookings") return createBooking(store, user.id, body);

  return fail(500, "server_error", `No mock for ${method} ${route}`);
}
