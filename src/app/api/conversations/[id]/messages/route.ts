import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { MESSAGE_MAX, messageBody } from "@/lib/messages";
import { MESSAGE_COLUMNS, PAGE_SIZE, loadConversation, toMessage } from "@/lib/server/conversations";

const notFound = () => errorResponse(404, "conversation_not_found", "Conversation not found.");

// A conversation with its latest messages (docs/SPEC-messages.md). Both roles;
// RLS limits it to the customer and the vendor's owner.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();
    // "Load earlier": messages older than the given message, by time and then
    // id, so messages sent in the same instant are never skipped or repeated.
    const before = req.nextUrl.searchParams.get("before");
    if (before !== null && !UUID_RE.test(before)) {
      return errorResponse(400, "validation_error", "before must be a message id.");
    }

    // Membership first: anyone outside the conversation gets 404, whatever else they send.
    const [{ conversation, error }, cursorResult] = await Promise.all([
      loadConversation(supabase, id),
      before === null
        ? null
        : supabase.from("messages").select("id, created_at").eq("id", before).eq("conversation_id", id).maybeSingle(),
    ]);
    if (error) return errorResponse(500, "server_error", "Could not load conversation.");
    if (!conversation) return notFound();
    if (cursorResult?.error) return errorResponse(500, "server_error", "Could not load messages.");
    if (cursorResult && !cursorResult.data) {
      return errorResponse(400, "validation_error", "before must be a message in this conversation.");
    }
    const cursor = cursorResult?.data ?? null;

    let query = supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (cursor) {
      // Values are quoted: a timestamp holds characters PostgREST filters treat specially.
      const at = `"${cursor.created_at}"`;
      query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
    }

    const messages = await query;
    if (messages.error) return errorResponse(500, "server_error", "Could not load messages.");

    const rows = messages.data ?? [];
    const userId = auth.session.user.id;
    return NextResponse.json({
      id: conversation.id,
      otherName: conversation.other_name,
      category: conversation.category,
      open: conversation.open,
      vendorHasAccount: conversation.vendor_has_account,
      // Oldest first on the page.
      messages: rows.slice(0, PAGE_SIZE).reverse().map((m) => toMessage(m, userId)),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    const json = await readJson(req);
    const body = messageBody(json?.body);
    if (body === undefined) {
      return errorResponse(400, "validation_error", `Write a message of 1 to ${MESSAGE_MAX} characters.`);
    }

    const { conversation, error } = await loadConversation(supabase, id);
    if (error) return errorResponse(500, "server_error", "Could not load conversation.");
    if (!conversation) return notFound();
    if (!conversation.open) {
      return errorResponse(409, "conversation_closed", "This conversation is read-only because there's no active booking.");
    }

    const userId = auth.session.user.id;
    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: userId, body })
      .select(MESSAGE_COLUMNS)
      .single();
    if (insertError) {
      // RLS refuses the insert when the last active booking was declined just now.
      if (insertError.code === "42501") {
        return errorResponse(409, "conversation_closed", "This conversation is read-only because there's no active booking.");
      }
      return errorResponse(500, "server_error", "Could not send message.");
    }

    return NextResponse.json({ message: toMessage(data, userId) }, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
