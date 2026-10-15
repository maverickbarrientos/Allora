// TEMPORARY mock for docs/SPEC-payment.md. Used only when NEXT_PUBLIC_USE_MOCKS=true.
// Remove with the mock switch in src/lib/api/client.ts when payments are connected.
//
// One shared store backs the plan, vendor and pay mocks, so a vendor decision
// shows on the customer's plan. It lives in localStorage so reloads keep it;
// clear the "allora-mock-payments" key to start over.
//
// Pay triggers: testMethod "decline" -> 402 payment_declined; booking id
// "pending" -> 409 booking_not_confirmed; "paid" -> 409 already_paid;
// "missing" -> 404; "broken" -> 500. A vendor-role session -> 403.
// The trigger ids are bookings on the mock event "demo-errors", listed as
// confirmed and unpaid so their pay page opens:
//   /events/demo-errors/bookings/<id>/pay

import { ApiError } from "@/lib/api/client";
import type {
  BookingStatus,
  Event,
  Payment,
  PaymentStatus,
  PlanBooking,
  Role,
  TestMethod,
} from "@/lib/api/types";

const KEY = "allora-mock-payments";
export const ERRORS_EVENT = "demo-errors";
const TRIGGERS = ["pending", "paid", "missing", "broken"] as const;

type MockPayment = {
  id: string;
  amount: number;
  status: "paid" | "refunded";
  reference: string;
  createdAt: string;
  refundedAt: string | null;
};
export type MockBooking = {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
  payments: MockPayment[];
  /** Test hook: leave out the payment field, to check the UI copes without it. */
  omitPayment?: boolean;
};
type Store = { bookings: MockBooking[] };

const now = () => new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function seed(): Store {
  return {
    bookings: [
      {
        id: "mock-unpaid",
        vendorId: "mock-v1",
        vendorName: "Aurelia Hall",
        category: "venue",
        price: 120000,
        status: "confirmed",
        createdAt: ago(6),
        payments: [],
      },
      {
        id: "mock-paid",
        vendorId: "mock-v2",
        vendorName: "Salt & Ember Catering",
        category: "catering",
        price: 85000.5,
        status: "confirmed",
        createdAt: ago(5),
        payments: [
          {
            id: "mock-pay-1",
            amount: 25500.15,
            status: "paid",
            reference: "DEMO-7Q2K9XPL",
            createdAt: ago(2),
            refundedAt: null,
          },
        ],
      },
      {
        id: "mock-refunded",
        vendorId: "mock-v3",
        vendorName: "Northlight Studio",
        category: "photography",
        price: 40000,
        status: "declined",
        createdAt: ago(4),
        payments: [
          {
            id: "mock-pay-2",
            amount: 12000,
            status: "refunded",
            reference: "DEMO-3HF8M2QA",
            createdAt: ago(3),
            refundedAt: ago(1),
          },
        ],
      },
      {
        id: "mock-pending",
        vendorId: "mock-v4",
        vendorName: "The Velvet Quartet",
        category: "music",
        price: 25000,
        status: "pending",
        createdAt: ago(1),
        payments: [],
      },
    ],
  };
}

// Trigger bookings for the "demo-errors" event. Never stored, never paid.
const triggerBookings = (): MockBooking[] =>
  TRIGGERS.map((id, i) => ({
    id,
    vendorId: `mock-trigger-${id}`,
    vendorName: `Trigger: ${id}`,
    category: "venue",
    price: 10000 + i,
    status: "confirmed",
    createdAt: ago(i),
    payments: [],
  }));

let memory: Store | null = null;

export function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* storage blocked or bad JSON: fall back to memory */
  }
  const store = memory ?? seed();
  save(store);
  return store;
}

export function save(store: Store) {
  memory = store;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage blocked: memory only */
  }
}

export const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

/** Deposit = round(price x 30%, 2). The real rule lives in SQL deposit_for(); this stands in for it. */
const depositFor = (price: number) => Math.round(price * 0.3 * 100) / 100;

/** Spec rule: paid if an active paid payment exists, else refunded if the latest was refunded, else unpaid. */
export function paymentStatus(b: MockBooking): PaymentStatus {
  if (b.payments.some((p) => p.status === "paid")) return "paid";
  const latest = b.payments[b.payments.length - 1];
  return latest?.status === "refunded" ? "refunded" : "unpaid";
}

export function paidPayment(b: MockBooking) {
  const st = paymentStatus(b);
  if (st === "unpaid") return null;
  return st === "paid"
    ? b.payments.find((p) => p.status === "paid")!
    : b.payments[b.payments.length - 1];
}

export function toPlanBooking(b: MockBooking, eventId: string): PlanBooking {
  const paid = paidPayment(b);
  if (b.omitPayment) {
    const { payment: _omit, ...rest } = toPlanBooking({ ...b, omitPayment: false }, eventId);
    void _omit;
    return rest;
  }
  return {
    id: b.id,
    eventId,
    vendorId: b.vendorId,
    vendorName: b.vendorName,
    category: b.category,
    price: b.price,
    status: b.status,
    createdAt: b.createdAt,
    payment: {
      status: paymentStatus(b),
      depositAmount: depositFor(b.price),
      paidAmount: paid?.amount ?? null,
      paidAt: paid?.createdAt ?? null,
    },
  };
}

export function mockEvent(id: string): Event {
  return { id, type: "wedding", date: "2027-06-12", budget: 500000, guestCount: 150 };
}

export function bookingsFor(eventId: string): MockBooking[] {
  return eventId === ERRORS_EVENT ? triggerBookings() : load().bookings;
}

/** The real session's role (auth is never mocked). 401 when logged out. */
export async function mockRole(): Promise<Role> {
  const res = await fetch("/api/me", { credentials: "same-origin" }).catch(() => null);
  if (!res) throw new ApiError(0, "server_error", "Network error");
  if (res.status === 401) throw new ApiError(401, "unauthorized", "Not signed in.");
  const data = await res.json().catch(() => null);
  return data?.profile?.role === "vendor" ? "vendor" : "customer";
}

const reference = () =>
  "DEMO-" +
  Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

/** Mock of POST /api/bookings/:id/pay. */
export async function payBooking(
  bookingId: string,
  testMethod: TestMethod,
): Promise<{ payment: Payment; booking: PlanBooking }> {
  await delay(900);
  if ((await mockRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  if (testMethod !== "approve" && testMethod !== "decline") {
    throw new ApiError(400, "validation_error", "Invalid fields: testMethod.");
  }
  if (bookingId === "missing") throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (bookingId === "broken") throw new ApiError(500, "server_error", "Could not record the payment.");
  if (bookingId === "pending") {
    throw new ApiError(409, "booking_not_confirmed", "Only a confirmed booking can be paid.");
  }
  if (bookingId === "paid") throw new ApiError(409, "already_paid", "This booking is already paid.");

  const store = load();
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (b.status !== "confirmed") {
    throw new ApiError(409, "booking_not_confirmed", "Only a confirmed booking can be paid.");
  }
  if (paymentStatus(b) === "paid") throw new ApiError(409, "already_paid", "This booking is already paid.");
  // The fake provider decides after every check. A decline records nothing.
  if (testMethod === "decline") throw new ApiError(402, "payment_declined", "Payment declined.");

  const p: MockPayment = {
    id: `mock-pay-${Date.now()}`,
    amount: depositFor(b.price),
    status: "paid",
    reference: reference(),
    createdAt: now(),
    refundedAt: null,
  };
  b.payments.push(p);
  save(store);
  return {
    payment: { ...p, bookingId: b.id },
    booking: toPlanBooking(b, "mock-event"),
  };
}

/** Vendor declines: a paid booking's payment is refunded in the same step. */
export function refundIfPaid(b: MockBooking) {
  const p = b.payments.find((x) => x.status === "paid");
  if (p) {
    p.status = "refunded";
    p.refundedAt = now();
  }
}
