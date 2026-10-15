import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson } from "@/lib/api-helpers";
import { parseDates } from "@/lib/availability";
import { requireOwnVendor } from "@/lib/vendor-portal";

// Block dates on the caller's own calendar (docs/SPEC-availability.md).
// All or nothing: one database call, which refuses the whole batch if any
// date has a confirmed booking.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const own = await requireOwnVendor(supabase);
    if ("error" in own) return own.error;

    const parsed = parseDates(await readJson(req));
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    const { data, error } = await supabase.rpc("block_vendor_dates", { p_dates: parsed.dates });
    if (error) {
      if (error.message === "date_has_confirmed_booking") {
        return errorResponse(
          409,
          "date_has_confirmed_booking",
          error.details
            ? `These dates have a confirmed booking: ${error.details}.`
            : "Some of these dates have a confirmed booking.",
        );
      }
      if (error.message === "invalid_dates") return errorResponse(400, "validation_error", "The dates are not valid.");
      // Only reachable if the role or vendor link changed since the checks above.
      if (error.message === "forbidden") return errorResponse(403, "forbidden", "Vendor accounts only.");
      if (error.message === "vendor_not_linked") {
        return errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.");
      }
      return errorResponse(500, "server_error", "Could not block dates.");
    }

    const changed = ((data ?? []) as string[]).slice().sort();
    return NextResponse.json({ changed });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
