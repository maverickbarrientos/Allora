import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";
import { EVENT_TEMPLATES } from "@/lib/templates/config";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    return NextResponse.json({ templates: EVENT_TEMPLATES });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
