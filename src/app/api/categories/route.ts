import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";
import { CATEGORIES } from "@/lib/vendor-profile";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    return NextResponse.json({ categories: [...CATEGORIES] });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
