import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { parseRange } from "@/lib/availability";

// Customer view of one vendor's availability: only dates, never reasons.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    const range = parseRange(req.nextUrl.searchParams);
    if ("error" in range) return errorResponse(400, "validation_error", range.error);

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (vErr) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    const { data, error } = await supabase.rpc("vendor_unavailable_dates", {
      p_vendor_id: id,
      p_from: range.from,
      p_to: range.to,
    });
    if (error) return errorResponse(500, "server_error", "Could not load availability.");

    return NextResponse.json({
      vendorId: id,
      from: range.from,
      to: range.to,
      unavailable: (data ?? []) as string[],
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
