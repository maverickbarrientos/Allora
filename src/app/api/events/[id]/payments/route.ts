import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { PLAN_BOOKING_COLUMNS, toPlanBooking } from "@/lib/server/shapes";
import { charge, isTestMethod } from "@/lib/payments/mockProvider";
import { planPayments, toPayment, withPlanPayments, type PaymentRow } from "@/lib/payments/status";
import { toCents } from "@/lib/amount";

const MAX_BOOKINGS = 20;
const PLANS = ["deposit", "full"];

const notFound = () => errorResponse(404, "booking_not_found", "One of these bookings was not found.");

/**
 * Pays several confirmed bookings of one event in a single request
 * (docs/SPEC-bulk-payment.md). Body: `{ bookingIds, plan, testMethod }`, where
 * plan is "deposit" or "full". A booking whose deposit is already paid pays its
 * balance instead. An optional `expectedTotal` (the total the customer saw) must
 * match what would be charged, else 409 amount_changed and nothing is paid. Amounts and references are never read from the body: the
 * amounts come from pay_bookings() (which uses pay_booking() and deposit_for()),
 * the reference from the demo provider.
 *
 * Order: validation, event and bookings (RLS), status and already-paid checks,
 * then one demo charge for the whole batch, then pay_bookings(), which checks
 * everything again and is all or nothing. A decline records nothing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const body = await readJson(req);
    if (!body || !isTestMethod(body.testMethod)) {
      return errorResponse(400, "validation_error", "Invalid fields: testMethod.");
    }
    const plan = body.plan ?? "deposit";
    if (typeof plan !== "string" || !PLANS.includes(plan)) {
      return errorResponse(400, "validation_error", "Invalid fields: plan.");
    }
    const ids = body.bookingIds;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > MAX_BOOKINGS ||
      !ids.every((x) => typeof x === "string" && UUID_RE.test(x)) ||
      new Set(ids).size !== ids.length
    ) {
      return errorResponse(400, "validation_error", `Invalid fields: bookingIds (1 to ${MAX_BOOKINGS} different ids).`);
    }
    const bookingIds = ids as string[];
    // Optional: the total the customer was shown. If what the server would charge
    // differs (a stale page, a price change, a payment made in another tab), nothing is paid.
    const expected = body.expectedTotal;
    if (expected !== undefined && (typeof expected !== "number" || !Number.isFinite(expected) || expected < 0)) {
      return errorResponse(400, "validation_error", "Invalid fields: expectedTotal.");
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    // RLS: customers only see their own events and the bookings on them.
    const { data: event, error: eErr } = await supabase.from("events").select("id").eq("id", id).maybeSingle();
    if (eErr) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const { data: rows, error: bErr } = await supabase
      .from("bookings")
      .select("id, event_id, status, vendor:vendors(name, price)")
      .in("id", bookingIds);
    if (bErr) return errorResponse(500, "server_error", "Could not load bookings.");
    if ((rows ?? []).length !== bookingIds.length || (rows ?? []).some((r) => r.event_id !== id)) return notFound();

    const vendorOf = (r: { vendor: unknown }) =>
      ((Array.isArray(r.vendor) ? r.vendor[0] : r.vendor) as { name?: string; price?: number | string } | null) ?? {};
    const nameOf = (r: { vendor: unknown }) => vendorOf(r).name ?? "A vendor";

    const { data: paidRows, error: pErr } = await supabase
      .from("payments")
      .select("booking_id, kind")
      .in("booking_id", bookingIds)
      .eq("status", "paid");
    if (pErr) return errorResponse(500, "server_error", "Could not load payments.");
    const paidKinds = new Map<string, string[]>();
    for (const p of paidRows ?? []) paidKinds.set(p.booking_id, [...(paidKinds.get(p.booking_id) ?? []), p.kind]);

    // Same rules as pay_booking(), so an obvious refusal happens before the charge.
    // The kind to pay is decided here, from what is already paid, and sent to
    // the database explicitly: a booking with a deposit pays its balance, any
    // other pays the batch plan. pay_booking() checks it again under a lock, so
    // two identical requests at the same time cannot both pay.
    const kindOf = new Map<string, string>();
    for (const r of rows ?? []) {
      if (r.status !== "confirmed") {
        return errorResponse(409, "booking_not_confirmed", `${nameOf(r)} is not confirmed yet, so it cannot be paid.`);
      }
      const kinds = paidKinds.get(r.id) ?? [];
      if (kinds.includes("full") || kinds.includes("balance") || (kinds.length > 0 && !kinds.includes("deposit"))) {
        return errorResponse(409, "already_paid", `${nameOf(r)} is already paid.`);
      }
      kindOf.set(r.id, kinds.includes("deposit") ? "balance" : plan);
    }

    if (expected !== undefined) {
      // Same amounts the plan shows: deposit_for() for a deposit, the price for a full payment, what is left for a balance.
      const priced = (rows ?? []).map((r) => ({ id: r.id, price: Number(vendorOf(r).price) }));
      const due = await planPayments(supabase, priced);
      let cents = 0;
      for (const r of priced) {
        const p = due.get(r.id)!;
        const kind = kindOf.get(r.id);
        cents += toCents(kind === "balance" ? p.balanceDue : kind === "full" ? r.price : p.depositAmount);
      }
      if (toCents(expected) !== cents) {
        return errorResponse(409, "amount_changed", "The amounts changed since you looked. Please review and try again.");
      }
    }

    // The demo provider is the only thing that decides success. A decline records nothing.
    const result = charge(body.testMethod);
    if (!result.approved) return errorResponse(402, "payment_declined", "Payment declined.");

    const { data: paid, error: payErr } = await supabase.rpc("pay_bookings", {
      p_booking_ids: bookingIds,
      p_kinds: bookingIds.map((bid) => kindOf.get(bid)),
      p_reference: result.reference,
    });
    if (payErr) {
      // Nothing was recorded. pay_bookings() puts the failing booking id in `details`.
      const failed = (rows ?? []).find((r) => r.id === payErr.details);
      const who = failed ? nameOf(failed) : "One of these bookings";
      const msg = payErr.message ?? "";
      if (msg.includes("booking_not_found")) return notFound();
      if (msg.includes("booking_not_confirmed")) {
        return errorResponse(409, "booking_not_confirmed", `${who} is not confirmed yet, so it cannot be paid.`);
      }
      if (msg.includes("nothing_due")) return errorResponse(409, "nothing_due", `${who} has no balance to pay.`);
      if (msg.includes("already_paid") || payErr.code === "23505") {
        return errorResponse(409, "already_paid", `${who} is already paid.`);
      }
      if (msg.includes("invalid_booking_ids") || msg.includes("invalid_kind")) {
        return errorResponse(400, "validation_error", "Invalid fields.");
      }
      return errorResponse(500, "server_error", "Could not record the payments.");
    }

    const { data: updated, error: uErr } = await supabase
      .from("bookings")
      .select(PLAN_BOOKING_COLUMNS)
      .in("id", bookingIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (uErr || !updated) return errorResponse(500, "server_error", "Could not load bookings.");
    const bookings = await withPlanPayments(supabase, updated.map(toPlanBooking));

    return NextResponse.json(
      { payments: ((paid ?? []) as PaymentRow[]).map(toPayment), bookings },
      { status: 201 },
    );
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
