import type { SupabaseClient } from "@supabase/supabase-js";

// Payment fields on PlanBooking and VendorBooking (docs/SPEC-payment.md).
// The deposit amount always comes from SQL deposit_for(); it is never computed here.

export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type PlanPayment = {
  status: PaymentStatus;
  depositAmount: number;
  paidAmount: number | null;
  paidAt: string | null;
};
export type VendorPayment = { status: PaymentStatus; paidAmount: number | null };

export type PaymentRow = {
  id: string;
  booking_id: string;
  amount: number | string;
  status: "paid" | "refunded";
  reference: string;
  created_at: string;
  refunded_at: string | null;
};

export function toPayment(r: PaymentRow) {
  return {
    id: r.id,
    bookingId: r.booking_id,
    amount: Number(r.amount),
    status: r.status,
    reference: r.reference,
    createdAt: r.created_at,
    refundedAt: r.refunded_at,
  };
}

type Summary = { status: PaymentStatus; amount: number | null; at: string | null };

/**
 * Spec rule: "paid" if an active paid payment exists, else "refunded" if the
 * latest payment was refunded, else "unpaid". The amount and date are those of
 * the paid payment, or of the latest refunded one.
 */
function summarise(rows: Pick<PaymentRow, "amount" | "status" | "created_at">[]): Summary {
  const paid = rows.find((r) => r.status === "paid");
  if (paid) return { status: "paid", amount: Number(paid.amount), at: paid.created_at };
  const latest = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  if (latest?.status === "refunded") return { status: "refunded", amount: Number(latest.amount), at: latest.created_at };
  return { status: "unpaid", amount: null, at: null };
}

/** Payment summaries by booking id. RLS limits rows to the caller's own bookings. Never reads the reference. */
async function loadSummaries(supabase: SupabaseClient, bookingIds: string[]) {
  const out = new Map<string, Summary>();
  if (bookingIds.length === 0) return out;
  const { data, error } = await supabase
    .from("payments")
    .select("booking_id, amount, status, created_at")
    .in("booking_id", bookingIds);
  if (error) throw error;
  const byBooking = new Map<string, Pick<PaymentRow, "amount" | "status" | "created_at">[]>();
  for (const r of data ?? []) {
    const list = byBooking.get(r.booking_id) ?? [];
    list.push(r as Pick<PaymentRow, "amount" | "status" | "created_at">);
    byBooking.set(r.booking_id, list);
  }
  for (const id of bookingIds) out.set(id, summarise(byBooking.get(id) ?? []));
  return out;
}

/**
 * deposit_for(price) for each distinct price, from SQL, in one request
 * (deposits_for, 010_deposits_batch.sql), so the count doesn't grow with prices.
 */
async function depositsFor(supabase: SupabaseClient, prices: number[]) {
  const unique = [...new Set(prices)];
  if (unique.length === 0) return new Map<number, number>();
  const { data, error } = await supabase.rpc("deposits_for", { prices: unique });
  if (error) throw error;
  return new Map(((data ?? []) as { price: number | string; deposit: number | string }[]).map((r) => [Number(r.price), Number(r.deposit)] as const));
}

/** PlanBooking.payment for each booking. Throws on a database error. */
export async function planPayments(supabase: SupabaseClient, bookings: { id: string; price: number }[]) {
  const [summaries, deposits] = await Promise.all([
    loadSummaries(supabase, bookings.map((b) => b.id)),
    depositsFor(supabase, bookings.map((b) => b.price)),
  ]);
  const out = new Map<string, PlanPayment>();
  for (const b of bookings) {
    const s = summaries.get(b.id)!;
    out.set(b.id, { status: s.status, depositAmount: deposits.get(b.price)!, paidAmount: s.amount, paidAt: s.at });
  }
  return out;
}

/** VendorBooking.payment for each booking (status and amount only, never the reference). */
export async function vendorPayments(supabase: SupabaseClient, bookingIds: string[]) {
  const summaries = await loadSummaries(supabase, bookingIds);
  const out = new Map<string, VendorPayment>();
  for (const [id, s] of summaries) out.set(id, { status: s.status, paidAmount: s.amount });
  return out;
}

/** Adds PlanBooking.payment to mapped plan bookings. Throws on a database error. */
export async function withPlanPayments<B extends { id: string; price: number }>(supabase: SupabaseClient, bookings: B[]) {
  const payments = await planPayments(supabase, bookings);
  return bookings.map((b) => ({ ...b, payment: payments.get(b.id)! }));
}

/** Adds VendorBooking.payment to mapped vendor bookings. Throws on a database error. */
export async function withVendorPayments<B extends { id: string }>(supabase: SupabaseClient, bookings: B[]) {
  const payments = await vendorPayments(supabase, bookings.map((b) => b.id));
  return bookings.map((b) => ({ ...b, payment: payments.get(b.id)! }));
}
