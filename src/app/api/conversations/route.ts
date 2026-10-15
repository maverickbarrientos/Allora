import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";
import { toSummary, type ConversationRow } from "@/lib/server/conversations";

// The caller's inbox, newest activity first (docs/SPEC-messages.md). Both roles;
// my_conversations() only returns the caller's own conversations.
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { data, error } = await supabase.rpc("my_conversations");
    if (error) return errorResponse(500, "server_error", "Could not load conversations.");

    return NextResponse.json({ conversations: ((data ?? []) as ConversationRow[]).map(toSummary) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
