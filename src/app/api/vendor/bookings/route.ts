import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";
import { requireVendorRole, toVendorBooking, type VendorBookingRow } from "@/lib/vendor-portal";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id, name, category, price")
      .eq("owner", auth.userId)
      .maybeSingle();
    if (vErr) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) {
      return errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.");
    }

    const { data: rows, error } = await supabase
      .rpc("vendor_incoming_bookings")
      .order("created_at", { ascending: false });
    if (error) return errorResponse(500, "server_error", "Could not load bookings.");

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        price: Number(vendor.price),
      },
      bookings: ((rows ?? []) as VendorBookingRow[]).map(toVendorBooking),
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
