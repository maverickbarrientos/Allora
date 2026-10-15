import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
