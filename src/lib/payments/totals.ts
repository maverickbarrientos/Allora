import type { PlanBooking } from "@/lib/api/types";
import { toCents } from "@/lib/amount";
import { hasOpenCancelRequest } from "@/lib/cancel-request";

// Totals on the plan page and the "pay selected" bar (docs/SPEC-bulk-payment.md).
// Everything is in whole cents so sums of 2-decimal amounts stay exact. These
// are previews: the server decides the real amounts when it records a payment.

export type BatchPlan = "deposit" | "full";

/** A booking that still counts toward the plan: waiting for the vendor, or confirmed. */
const isActive = (b: PlanBooking) => b.status === "pending" || b.status === "confirmed";

/** Confirmed, no open cancellation request, and something is still owed. */
export function isPayable(b: PlanBooking): boolean {
  const p = b.payment;
  if (!p || b.status !== "confirmed" || hasOpenCancelRequest(b)) return false;
  return p.status === "paid" ? p.balanceDue > 0 : true; // unpaid or refunded
}

/** True when a deposit is already paid, so this booking pays its balance whatever the plan is. */
export const paysBalance = (b: PlanBooking) => b.payment?.status === "paid" && b.payment.balanceDue > 0;

/** What a payable booking would pay now, in cents. */
export function dueCents(b: PlanBooking, plan: BatchPlan): number {
  const p = b.payment;
  if (!p) return 0;
  if (paysBalance(b)) return toCents(p.balanceDue);
  return toCents(plan === "full" ? b.price : p.depositAmount);
}

/** What a booking still owes in total (the rest of the price), in cents. Confirmed bookings only. */
function owedCents(b: PlanBooking): number {
  if (b.status !== "confirmed") return 0;
  const p = b.payment;
  if (p?.status === "paid") return p.fullyPaid ? 0 : toCents(p.balanceDue);
  return toCents(b.price);
}

export type PlanTotals = {
  /** Price of every pending and confirmed booking. */
  booked: number;
  /** Money paid on them so far. */
  paid: number;
  /** Still to pay on confirmed bookings. */
  left: number;
  /** Price of bookings still waiting for the vendor. */
  waiting: number;
};

export function planTotals(bookings: PlanBooking[]): PlanTotals {
  const t: PlanTotals = { booked: 0, paid: 0, left: 0, waiting: 0 };
  for (const b of bookings) {
    if (!isActive(b)) continue;
    t.booked += toCents(b.price);
    if (b.status === "pending") t.waiting += toCents(b.price);
    if (b.payment?.status === "paid" && b.payment.paidAmount != null) t.paid += toCents(b.payment.paidAmount);
    t.left += owedCents(b);
  }
  return t;
}

export type Selection = {
  count: number;
  /** Price of the selected bookings. */
  price: number;
  /** What they pay now with the chosen plan. */
  due: number;
  /** True when at least one of them can still choose between deposit and full. */
  canChoosePlan: boolean;
};

export function selectionTotals(selected: PlanBooking[], plan: BatchPlan): Selection {
  return {
    count: selected.length,
    price: selected.reduce((n, b) => n + toCents(b.price), 0),
    due: selected.reduce((n, b) => n + dueCents(b, plan), 0),
    canChoosePlan: selected.some((b) => !paysBalance(b)),
  };
}

/** Whole cents to a number for `formatAmount`. */
export const fromCents = (cents: number) => cents / 100;
