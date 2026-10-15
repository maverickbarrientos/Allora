import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse, loadProfile } from "@/lib/api-helpers";

export type VendorBooking = {
  id: string;
  category: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  createdAt: string;
  cancelRequestedAt: string | null;
  customerName: string;
  event: {
    type: "wedding" | "birthday" | "corporate";
    date: string;
    guestCount: number;
    budget: number;
  };
};

export type VendorBookingRow = {
  id: string;
  category: string;
  status: VendorBooking["status"];
  created_at: string;
  cancel_requested_at: string | null;
  event_type: VendorBooking["event"]["type"];
  event_date: string;
  guest_count: number;
  event_budget: number | string;
  customer_name: string;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toVendorBooking(r: VendorBookingRow): VendorBooking {
  return {
    id: r.id,
    category: r.category,
    status: r.status,
    createdAt: r.created_at,
    cancelRequestedAt: r.cancel_requested_at ?? null,
    customerName: r.customer_name,
    event: {
      type: r.event_type,
      date: r.event_date,
      guestCount: r.guest_count,
      budget: Number(r.event_budget),
    },
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

/**
 * The caller's own vendor id: 401 if no session, 403 if not a vendor-role
 * user, 404 `vendor_not_linked` if the account has no vendor record yet.
 */
export async function requireOwnVendor(supabase: SupabaseClient) {
  const auth = await requireVendorRole(supabase);
  if (auth.error) return { error: auth.error };
  const { data, error } = await supabase.from("vendors").select("id").eq("owner", auth.userId).maybeSingle();
  if (error) return { error: errorResponse(500, "server_error", "Could not load vendor.") };
  if (!data) return { error: errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.") };
  return { vendorId: data.id as string };
}
