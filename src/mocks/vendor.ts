/**
 * TEMPORARY MOCK. Delete this file (and the vendor branch in
 * src/lib/api/client.ts, and VENDOR_LOGINS in src/mocks/auth.ts) once the real
 * backend is merged.
 *
 * Implements GET /api/vendor/bookings and PATCH /api/vendor/bookings/:id as in
 * docs/SPEC-vendor-portal.md. Enabled with NEXT_PUBLIC_USE_MOCKS=true. Data
 * lives in localStorage. Accept and Decline change only this mock's own
 * state; the mock customer plan (src/mocks/events.ts) is never touched.
 *
 * Mock logins (any password except "wrongpass"):
 *   vendor@test.com    vendor role, linked to the vendor "Aurelia Hall"
 *   unlinked@test.com  vendor role, not linked -> 404 vendor_not_linked
 * Any customer-role session gets 403 forbidden.
 *
 * Seeded bookings: 3 pending, 2 confirmed, 1 declined. Two pending rows are
 * error triggers: PATCH on id "decided" returns 409 already_decided, and PATCH
 * on id "missing" returns 404 booking_not_found. Both stay pending.
 */

type Status = "pending" | "confirmed" | "declined";
type VendorBooking = {
  id: string;
  category: string;
  status: Status;
  createdAt: string;
  event: { type: "wedding" | "birthday" | "corporate"; date: string; guestCount: number };
};

const STORE_KEY = "allora.mock.vendor";
const USERS_KEY = "allora.mock.users"; // written by src/mocks/auth.ts
const SESSION_KEY = "allora.mock.session"; // written by src/mocks/auth.ts
const LATENCY_MS = 400;
const LINKED_EMAIL = "vendor@test.com";

const VENDOR = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Aurelia Hall",
  category: "venue",
  price: 150000,
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const seed = (): VendorBooking[] => [
  { id: "decided", category: "venue", status: "pending", createdAt: hoursAgo(1), event: { type: "wedding", date: "2027-02-14", guestCount: 120 } },
  { id: "missing", category: "venue", status: "pending", createdAt: hoursAgo(2), event: { type: "birthday", date: "2027-01-09", guestCount: 40 } },
  { id: crypto.randomUUID(), category: "venue", status: "pending", createdAt: hoursAgo(3), event: { type: "corporate", date: "2026-12-05", guestCount: 80 } },
  { id: crypto.randomUUID(), category: "venue", status: "confirmed", createdAt: hoursAgo(30), event: { type: "wedding", date: "2027-05-22", guestCount: 150 } },
  { id: crypto.randomUUID(), category: "venue", status: "confirmed", createdAt: hoursAgo(50), event: { type: "birthday", date: "2026-11-28", guestCount: 30 } },
  { id: crypto.randomUUID(), category: "venue", status: "declined", createdAt: hoursAgo(70), event: { type: "corporate", date: "2027-03-18", guestCount: 200 } },
];

const readBookings = (): VendorBooking[] => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (s) return s;
  } catch {
    // fall through to a fresh seed
  }
  const fresh = seed();
  localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
  return fresh;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fail = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

function currentUser(): { email: string; role: string } | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const users: { id: string; email: string; role: string }[] = JSON.parse(
      localStorage.getItem(USERS_KEY) ?? "[]",
    );
    return users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Stands in for fetch() for the two vendor routes. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const method = (init.method ?? "GET").toUpperCase();
  const route = new URL(path, "http://mock.local").pathname;

  const user = currentUser();
  if (!user) return fail(401, "unauthorized", "Not signed in");
  if (user.role !== "vendor") return fail(403, "forbidden", "Vendors only");
  const linked = user.email === LINKED_EMAIL;

  if (method === "GET" && route === "/api/vendor/bookings") {
    if (!linked) return fail(404, "vendor_not_linked", "No vendor linked to this account");
    const bookings = readBookings().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(200, { vendor: VENDOR, bookings });
  }

  const match = route.match(/^\/api\/vendor\/bookings\/([^/]+)$/);
  if (method === "PATCH" && match) {
    let body: Record<string, unknown> = {};
    try {
      body = init.body ? JSON.parse(String(init.body)) : {};
    } catch {
      body = {};
    }
    const status = body.status;
    if (status !== "confirmed" && status !== "declined")
      return fail(400, "validation_error", "Status must be confirmed or declined");

    const id = decodeURIComponent(match[1]);
    const bookings = readBookings();
    const booking = bookings.find((b) => b.id === id);
    if (!linked || id === "missing" || !booking)
      return fail(404, "booking_not_found", "Booking not found");
    if (id === "decided" || booking.status !== "pending")
      return fail(409, "already_decided", "This booking was already decided");

    booking.status = status;
    localStorage.setItem(STORE_KEY, JSON.stringify(bookings));
    return json(200, { booking });
  }

  return fail(500, "server_error", `No mock for ${method} ${route}`);
}
