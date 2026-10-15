import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";

type Row = { booking_id: string; conversation_id: string; unread: number };

// Each of the caller's bookings with its conversation, for the Message links on
// the plan and the vendor's bookings page (docs/SPEC-messages.md). Both roles.
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { data, error } = await supabase.rpc("my_booking_conversations");
    if (error) return errorResponse(500, "server_error", "Could not load conversations.");

    const bookings: Record<string, { conversationId: string; unread: number }> = {};
    for (const row of (data ?? []) as Row[]) {
      bookings[row.booking_id] = { conversationId: row.conversation_id, unread: row.unread };
    }
    return NextResponse.json({ bookings });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
