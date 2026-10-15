import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";
import { VENDOR_COLUMNS, toVendor } from "@/lib/server/shapes";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    // Any signed-in user may read vendors.
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const category = req.nextUrl.searchParams.get("category");

    const { data, error } = await supabase
      .from("vendors")
      .select(VENDOR_COLUMNS)
      .order("name", { ascending: true })
      .order("id", { ascending: true });
    if (error) return errorResponse(500, "server_error", "Could not load vendors.");

    // Filtered here, not in the query: Supabase's firewall rejects some
    // free-text values (e.g. SQL-looking strings), which would turn an
    // unknown category into a 500 instead of an empty list.
    // An empty value is treated like no filter ("All").
    const rows = category ? (data ?? []).filter((v) => v.category === category) : (data ?? []);

    return NextResponse.json({ vendors: rows.map(toVendor) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
