// Availability on an event's date, shared by the vendor list and the one-vendor
// endpoint so a vendor card and a vendor page always agree (docs/SPEC-availability.md).

import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID_RE, errorResponse } from "@/lib/api-helpers";

/**
 * The date of one of the caller's events. RLS hides events the caller doesn't
 * own, so those (and malformed ids) give 404 event_not_found.
 */
export async function loadEventDate(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ date: string } | { response: NextResponse }> {
  if (!UUID_RE.test(eventId)) return { response: errorResponse(404, "event_not_found", "Event not found.") };
  const { data, error } = await supabase.from("events").select("date").eq("id", eventId).maybeSingle();
  if (error) return { response: errorResponse(500, "server_error", "Could not load event.") };
  if (!data) return { response: errorResponse(404, "event_not_found", "Event not found.") };
  return { date: data.date as string };
}

/** Ids of the vendors who are unavailable on a date, or null if the query fails. */
export async function unavailableVendorIds(supabase: SupabaseClient, date: string): Promise<Set<string> | null> {
  const { data, error } = await supabase.rpc("vendors_unavailable_on", { p_date: date });
  if (error) return null;
  return new Set((data ?? []) as string[]);
}
