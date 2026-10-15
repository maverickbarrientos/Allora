import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson } from "@/lib/api-helpers";
import { parseDates } from "@/lib/availability";
import { requireOwnVendor } from "@/lib/vendor-portal";

// Unblock dates on the caller's own calendar (docs/SPEC-availability.md).
// One delete statement, so the batch applies all or nothing; dates that
// weren't blocked are ignored. RLS limits it to the caller's own rows.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const own = await requireOwnVendor(supabase);
    if ("error" in own) return own.error;

    const parsed = parseDates(await readJson(req));
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    const { data, error } = await supabase
      .from("vendor_blocked_dates")
      .delete()
      .eq("vendor_id", own.vendorId)
      .in("date", parsed.dates)
      .select("date");
    if (error) return errorResponse(500, "server_error", "Could not unblock dates.");

    const changed = (data ?? []).map((r) => r.date as string).sort();
    return NextResponse.json({ changed });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
