// An event's own service list (docs/SPEC-event-services.md).

import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Each service with its strongest active booking: confirmed over pending, or null for a gap. */
export function withServiceStatus(
  services: readonly string[],
  bookings: readonly { category: string; status: string }[],
): EventService[] {
  return services.map((category) => {
    const statuses = bookings.filter((b) => b.category === category).map((b) => b.status);
    const status = statuses.includes("confirmed") ? "confirmed" : statuses.includes("pending") ? "pending" : null;
    return { category, status };
  });
}
