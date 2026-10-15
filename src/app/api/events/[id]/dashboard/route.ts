import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { findGaps } from "@/lib/matching/gaps";
import { budgetShare, roundShare } from "@/lib/matching/shares";
import { planPayments } from "@/lib/payments/status";
import { toSetBudgets } from "@/lib/server/budgets";
import { loadEventServices } from "@/lib/server/services";
import { EVENT_COLUMNS, PLAN_BOOKING_COLUMNS, toEvent, toPlanBooking } from "@/lib/server/shapes";

// Customer dashboard for one event (docs/SPEC-dashboard.md). Deterministic:
// no LLM call. Gaps and shares come from src/lib/matching/, payment status
// and deposits from src/lib/payments/.

type ActionType = "pay_deposit" | "find_replacement" | "awaiting_vendor";
type DashboardAction = { type: ActionType; bookingId: string; vendorName: string; category: string; amount: number | null };

const ORDER: Record<ActionType, number> = { pay_deposit: 0, find_replacement: 1, awaiting_vendor: 2 };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const [bookingsResult, budgetsResult, services] = await Promise.all([
      supabase
        .from("bookings")
        .select(PLAN_BOOKING_COLUMNS)
        .eq("event_id", id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase.from("event_budgets").select("category, amount").eq("event_id", id),
      loadEventServices(supabase, id),
    ]);
    if (bookingsResult.error || budgetsResult.error || !services) return errorResponse(500, "server_error", "Could not load the plan.");

    const bookings = (bookingsResult.data ?? []).map(toPlanBooking);

    // Payment status and the current deposit, only for confirmed bookings:
    // they are the only ones that can need a deposit.
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    let payments;
    try {
      payments = await planPayments(supabase, confirmed);
    } catch {
      return errorResponse(500, "server_error", "Could not load payments.");
    }

    const bookingCounts = { pending: 0, confirmed: 0, declined: 0 };
    // A cancelled booking counts as declined.
    for (const b of bookings) bookingCounts[b.status === "cancelled" ? "declined" : b.status] += 1;

    const gaps = findGaps(services, bookings);
    const gapSet = new Set(gaps);

    const actions: DashboardAction[] = [];
    for (const b of bookings) {
      const base = { bookingId: b.id, vendorName: b.vendorName, category: b.category };
      if (b.status === "confirmed") {
        const p = payments.get(b.id);
        // Not currently paid: no active paid deposit (a refunded one counts as unpaid).
        if (p && p.status !== "paid") actions.push({ type: "pay_deposit", ...base, amount: p.depositAmount });
      } else if (b.status === "declined" || b.status === "cancelled") {
        if (gapSet.has(b.category)) actions.push({ type: "find_replacement", ...base, amount: null });
      } else {
        actions.push({ type: "awaiting_vendor", ...base, amount: null });
      }
    }
    // Bookings are already in createdAt order, and the sort is stable.
    actions.sort((a, b) => ORDER[a.type] - ORDER[b.type]);

    const setBudgets = toSetBudgets(budgetsResult.data ?? []);
    const missing = gaps.map((category) => ({
      category,
      budgetShare: roundShare(budgetShare(services, Number(event.budget), category, setBudgets)),
    }));

    return NextResponse.json({ event: toEvent(event), bookingCounts, actions, missing });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
