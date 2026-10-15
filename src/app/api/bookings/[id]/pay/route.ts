import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { PLAN_BOOKING_COLUMNS, toPlanBooking } from "@/lib/server/shapes";
import { charge, isTestMethod } from "@/lib/payments/mockProvider";
import { toPayment, withPlanPayments, type PaymentRow } from "@/lib/payments/status";

const notFound = () => errorResponse(404, "booking_not_found", "Booking not found.");
const notConfirmed = () =>
  errorResponse(409, "booking_not_confirmed", "Only a confirmed booking can be paid.");
const alreadyPaid = () => errorResponse(409, "already_paid", "This payment is already made.");
const nothingDue = () => errorResponse(409, "nothing_due", "There is no balance to pay.");
const KINDS = ["deposit", "full", "balance"];

/**
 * Pays the demo deposit for a confirmed booking (docs/SPEC-payment.md).
 * Order: validation, ownership, status and already-paid checks, then the demo
 * provider, then pay_booking() (which locks the booking and checks everything
 * again). Only testMethod and plan (deposit, full or balance; default
 * deposit) are read from the body; amount, reference and any other fields are
 * ignored. The amount is decided in pay_booking().
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
    if (typeof plan !== "string" || !KINDS.includes(plan)) {
      return errorResponse(400, "validation_error", "Invalid fields: plan.");
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    // RLS: customers only see bookings on their own events.
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (bErr) return errorResponse(500, "server_error", "Could not load booking.");
    if (!booking) return notFound();
    if (booking.status !== "confirmed") return notConfirmed();

    const { data: paidRows, error: pErr } = await supabase
      .from("payments")
      .select("kind")
      .eq("booking_id", id)
      .eq("status", "paid");
    if (pErr) return errorResponse(500, "server_error", "Could not load payments.");
    const paidKinds = (paidRows ?? []).map((r) => r.kind);
    if (plan === "balance") {
      if (paidKinds.includes("balance")) return alreadyPaid();
      if (!paidKinds.includes("deposit")) return nothingDue();
    } else if (paidKinds.length > 0) {
      return alreadyPaid();
    }

    // The demo provider is the only thing that decides success. A decline records nothing.
    const result = charge(body.testMethod);
    if (!result.approved) return errorResponse(402, "payment_declined", "Payment declined.");

    const { data: paid, error: payErr } = await supabase.rpc("pay_booking", {
      p_booking_id: id,
      p_reference: result.reference,
      p_kind: plan,
    });
    if (payErr) {
      // Nothing was recorded. Map the database's re-check to the matching error.
      const msg = payErr.message ?? "";
      if (msg.includes("booking_not_found")) return notFound();
      if (msg.includes("booking_not_confirmed")) return notConfirmed();
      if (msg.includes("nothing_due")) return nothingDue();
      if (msg.includes("already_paid") || payErr.code === "23505") return alreadyPaid();
      return errorResponse(500, "server_error", "Could not record the payment.");
    }

    const { data: row, error: rowErr } = await supabase
      .from("bookings")
      .select(PLAN_BOOKING_COLUMNS)
      .eq("id", id)
      .single();
    if (rowErr || !row) return errorResponse(500, "server_error", "Could not load booking.");
    const [planBooking] = await withPlanPayments(supabase, [toPlanBooking(row)]);

    return NextResponse.json(
      { payment: toPayment(paid as PaymentRow), booking: planBooking },
      { status: 201 },
    );
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
