import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";

// Marks a conversation read for the caller only (docs/SPEC-messages.md).
// mark_conversation_read() sets just the caller's own read time and raises
// conversation_not_found for anyone who isn't in the conversation.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { id } = await params;
    const notFound = () => errorResponse(404, "conversation_not_found", "Conversation not found.");
    if (!UUID_RE.test(id)) return notFound();

    const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: id });
    if (error) {
      return error.message.includes("conversation_not_found")
        ? notFound()
        : errorResponse(500, "server_error", "Could not mark the conversation read.");
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
