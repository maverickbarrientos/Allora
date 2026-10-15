// Service budgets (docs/SPEC-event-upgrades.md, part B): shapes and validation.

import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetShare, roundShare, type SetBudgets } from "@/lib/matching/shares";
import { isMoney } from "@/lib/server/event-input";
import { CATEGORIES } from "@/lib/vendor-profile";

/** At most one entry per known category. */
export const MAX_ENTRIES = CATEGORIES.length;

export type ServiceBudget = { category: string; amount: number | null; share: number; booked: number };
export type BudgetSummary = { eventBudget: number; allocated: number; budgets: ServiceBudget[] };
export type BudgetEntry = { category: string; amount: number | null };

const toCents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function toSetBudgets(rows: readonly { category: string; amount: number | string }[]): SetBudgets {
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.amount)]));
}

type VendorPrice = { price: number | string };
type BookingRow = { category: string; status: string; vendor: VendorPrice | VendorPrice[] | null };

/** One entry per service on the event's list, in list order. Null if a query fails. */
export async function loadBudgetSummary(
  supabase: SupabaseClient,
  event: { id: string; services: readonly string[]; budget: number },
): Promise<BudgetSummary | null> {
  const [budgetsResult, bookingsResult] = await Promise.all([
    supabase.from("event_budgets").select("category, amount").eq("event_id", event.id),
    supabase.from("bookings").select("category, status, vendor:vendors(price)").eq("event_id", event.id),
  ]);
  if (budgetsResult.error || bookingsResult.error) return null;

  const set = toSetBudgets(budgetsResult.data ?? []);
  const booked = new Map<string, number>();
  for (const b of (bookingsResult.data ?? []) as unknown as BookingRow[]) {
    if (b.status !== "pending" && b.status !== "confirmed") continue;
    const vendor = Array.isArray(b.vendor) ? b.vendor[0] : b.vendor;
    booked.set(b.category, (booked.get(b.category) ?? 0) + Number(vendor?.price ?? 0));
  }

  const budgets = event.services.map((category) => ({
    category,
    amount: Object.prototype.hasOwnProperty.call(set, category) ? set[category] : null,
    share: roundShare(budgetShare(event.services, event.budget, category, set)),
    booked: toCents(booked.get(category) ?? 0),
  }));
  const allocated = toCents(budgets.reduce((sum, b) => sum + (b.amount ?? 0), 0));
  return { eventBudget: event.budget, allocated, budgets };
}

/** Validates the PUT body. Returns the entries, or a message for a 400. */
export function parseBudgetEntries(
  body: Record<string, unknown> | null,
  services: readonly string[],
  eventBudget: number,
): { entries: BudgetEntry[] } | { error: string } {
  const list = body?.budgets;
  if (!Array.isArray(list)) return { error: "budgets must be an array." };
  if (list.length < 1 || list.length > MAX_ENTRIES) {
    return { error: `budgets must have 1 to ${MAX_ENTRIES} entries.` };
  }

  const seen = new Set<string>();
  const entries: BudgetEntry[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: "Each entry must be an object." };
    }
    const { category, amount } = raw as Record<string, unknown>;
    if (typeof category !== "string" || !services.includes(category)) {
      return { error: `Category is not one of this event's services: ${String(category)}.` };
    }
    if (seen.has(category)) return { error: `Duplicate category: ${category}.` };
    seen.add(category);
    if (amount === null) entries.push({ category, amount: null });
    else if (isMoney(amount, eventBudget)) entries.push({ category, amount });
    else {
      return { error: `Invalid amount for ${category}: above 0, at most the event budget, 2 decimals.` };
    }
  }
  return { entries };
}
