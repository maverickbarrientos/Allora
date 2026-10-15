import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse, loadProfile } from "@/lib/api-helpers";

export type VendorBooking = {
  id: string;
  category: string;
  status: "pending" | "confirmed" | "declined";
  createdAt: string;
  event: { type: "wedding" | "birthday" | "corporate"; date: string; guestCount: number };
};

export type VendorBookingRow = {
  id: string;
  category: string;
  status: VendorBooking["status"];
  created_at: string;
  event_type: VendorBooking["event"]["type"];
  event_date: string;
  guest_count: number;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toVendorBooking(r: VendorBookingRow): VendorBooking {
  return {
    id: r.id,
    category: r.category,
    status: r.status,
    createdAt: r.created_at,
    event: { type: r.event_type, date: r.event_date, guestCount: r.guest_count },
  };
}

/** 401 if no session, 403 if the caller is not a vendor-role user. */
export async function requireVendorRole(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: errorResponse(401, "unauthorized", "Not signed in.") };
  const result = await loadProfile(supabase, data.user);
  if (!result) return { error: errorResponse(401, "unauthorized", "Not signed in.") };
  if (result.profile.role !== "vendor") {
    return { error: errorResponse(403, "forbidden", "Vendor accounts only.") };
  }
  return { userId: data.user.id };
}
