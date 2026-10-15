// An event's own service list (docs/SPEC-event-services.md).

import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES } from "@/lib/vendor-profile";

export type EventService = { category: string; status: "pending" | "confirmed" | null };

/** The event's services in list order, or null if the query fails. */
export async function loadEventServices(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("event_services")
    .select("category")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => r.category as string);
}

/**
 * Validates `body.services`: 1 or more known categories, no duplicates.
 * Returns the list in the order given, or a message for a 400.
 */
export function parseServices(body: Record<string, unknown> | null): { services: string[] } | { error: string } {
  const list = body?.services;
  if (!Array.isArray(list)) return { error: "services must be an array." };
  if (list.length < 1 || list.length > CATEGORIES.length) {
    return { error: `services must have 1 to ${CATEGORIES.length} entries.` };
  }
  const seen = new Set<string>();
  for (const c of list) {
    if (typeof c !== "string" || !CATEGORIES.includes(c)) return { error: "Unknown service." };
    if (seen.has(c)) return { error: "A service is listed twice." };
    seen.add(c);
  }
  return { services: [...seen] };
}

/** Each service with its strongest active booking: confirmed over pending, or null for a gap. */
export function withServiceStatus(
  services: readonly string[],
  bookings: readonly { category: string; status: string }[],
): EventService[] {
  return services.map((category) => {
    const statuses = bookings.filter((b) => b.category === category).map((b) => b.status);
    const status = statuses.includes("confirmed") ? "confirmed" : statuses.includes("pending") || statuses.includes("cancel_requested") ? "pending" : null;
    return { category, status };
  });
}
