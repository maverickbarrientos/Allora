/**
 * TEMPORARY MOCK. Delete this file (and the missing branch in
 * src/lib/api/client.ts) once the real backend is merged.
 *
 * Implements GET /api/events/:id/missing as in docs/SPEC-matching.md. Enabled
 * with NEXT_PUBLIC_USE_MOCKS=true. Gaps are computed from the mock bookings
 * and vendors in src/mocks/events.ts (read-only), so booking from a card
 * through POST /api/bookings makes that card disappear on the next load. The
 * checklist, weights and matching formula below copy the spec's placeholder
 * config.
 *
 * Triggers (event id): "complete" returns an empty card list; "fallback"
 * returns textSource "fallback"; "slow" waits 3 seconds; "missing" returns 404
 * event_not_found; "broken" returns 500 server_error. complete, fallback, slow
 * and broken resolve to the caller's first event (see src/mocks/events.ts) so
 * the plan page opens. A vendor-role session returns 403. A category whose
 * vendors are all too far from the budget share returns a card with no
 * vendors (for example a wedding with a budget of 50,000).
 */

import { MOCK_VENDORS, readMockStore } from "./events";

type EventType = "wedding" | "birthday" | "corporate";

const USERS_KEY = "allora.mock.users"; // written by src/mocks/auth.ts
const SESSION_KEY = "allora.mock.session"; // written by src/mocks/auth.ts
const LATENCY_MS = 400;
const SLOW_MS = 3000;

const CHECKLISTS: Record<EventType, string[]> = {
  wedding: ["venue", "catering", "photography", "music", "decoration"],
  birthday: ["venue", "catering", "decoration", "music"],
  corporate: ["venue", "catering", "photography"],
};
const WEIGHTS: Record<string, number> = {
  venue: 0.35,
  catering: 0.3,
  decoration: 0.13,
  photography: 0.12,
  music: 0.1,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fail = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// Mock "AI" text. The fallback uses the spec's templates instead.
const AI_WHY: Record<string, string> = {
  venue: "The venue sets the date, the guest count and the mood for everything else.",
  catering: "Food is the part guests remember most, and caterers book up early.",
  photography: "A photographer keeps the day once it is over.",
  music: "Music carries the evening, from the first arrival to the last song.",
  decoration: "Styling ties the venue, the table and the light together.",
};
const aiReason = (name: string, pct: number, category: string) =>
  `${name} sits close to the suggested ${category} budget, a ${pct}% fit.`;

function buildCards(event: { type: EventType; budget: number }, bookedCategories: Set<string>, source: "ai" | "fallback") {
  const checklist = CHECKLISTS[event.type];
  const weightSum = checklist.reduce((sum, c) => sum + WEIGHTS[c], 0);

  return checklist
    .filter((category) => !bookedCategories.has(category))
    .map((category) => {
      const share = (event.budget * WEIGHTS[category]) / weightSum;
      const vendors = MOCK_VENDORS.filter((v) => v.category === category)
        .map((v) => ({
          v,
          pct: Math.min(100, Math.max(0, Math.round(100 * (1 - Math.abs(v.price - share) / share)))),
        }))
        .filter((x) => x.pct > 0)
        .sort(
          (a, b) =>
            b.pct - a.pct ||
            a.v.price - b.v.price ||
            a.v.name.localeCompare(b.v.name) ||
            a.v.id.localeCompare(b.v.id),
        )
        .slice(0, 3)
        .map(({ v, pct }) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          matchPercent: pct,
          reason:
            source === "ai"
              ? aiReason(v.name, pct, category)
              : `Price is ${pct}% close to the suggested ${category} budget.`,
        }));
      return {
        category,
        budgetShare: Math.round(share * 100) / 100,
        whyItMatters:
          source === "ai"
            ? AI_WHY[category] ?? `A ${category} still needs to be booked.`
            : `No ${category} is booked yet for this ${event.type}.`,
        vendors,
      };
    });
}

/** Stands in for fetch() for GET /api/events/:id/missing. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const route = new URL(path, "http://mock.local").pathname;
  const match = route.match(/^\/api\/events\/([^/]+)\/missing$/);
  const id = match ? decodeURIComponent(match[1]) : "";

  await wait(id === "slow" ? SLOW_MS : LATENCY_MS);

  if ((init.method ?? "GET").toUpperCase() !== "GET" || !match)
    return fail(500, "server_error", `No mock for ${path}`);

  const user = currentUser();
  if (!user) return fail(401, "unauthorized", "Not signed in");
  if (user.role !== "customer") return fail(403, "forbidden", "Customers only");
  if (id === "broken") return fail(500, "server_error", "Something went wrong");
  if (id === "missing") return fail(404, "event_not_found", "Event not found");

  const store = readMockStore();
  const own = store.events.filter((e) => e.owner === user.id);
  const event = ["complete", "fallback", "slow"].includes(id)
    ? own[0]
    : own.find((e) => e.id === id);
  if (!event) return fail(404, "event_not_found", "Event not found");

  const source = id === "fallback" ? "fallback" : "ai";
  if (id === "complete") return json(200, { eventId: event.id, textSource: source, cards: [] });

  // A category with a pending or confirmed booking is not a gap. Declined does not count.
  const booked = new Set(
    store.bookings
      .filter((b) => b.eventId === event.id && b.status !== "declined")
      .map((b) => b.category),
  );
  return json(200, { eventId: event.id, textSource: source, cards: buildCards(event, booked, source) });
}
