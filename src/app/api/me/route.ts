import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, loadProfile } from "@/lib/api-helpers";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return errorResponse(401, "unauthorized", "Not signed in.");

    const result = await loadProfile(supabase, data.user);
    if (!result) return errorResponse(401, "unauthorized", "Not signed in.");
    return NextResponse.json(result);
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
