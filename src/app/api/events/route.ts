import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { EVENT_COLUMNS, toEvent } from "@/lib/server/shapes";

const EVENT_TYPES = ["wedding", "birthday", "corporate"];
const MAX_INT = 2147483647;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 1 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const body = await readJson(req);
    const { type, date, budget, guestCount } = body ?? {};

    const invalid: string[] = [];
    if (typeof type !== "string" || !EVENT_TYPES.includes(type)) invalid.push("type");
    if (!isValidDate(date)) invalid.push("date");
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) invalid.push("budget");
    if (
      typeof guestCount !== "number" ||
      !Number.isInteger(guestCount) ||
      guestCount <= 0 ||
      guestCount > MAX_INT
    ) {
      invalid.push("guestCount");
    }
    if (invalid.length > 0) {
      return errorResponse(400, "validation_error", `Invalid fields: ${invalid.join(", ")}.`);
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ type, date, budget, guest_count: guestCount })
      .select(EVENT_COLUMNS)
      .single();
    if (error || !data) return errorResponse(500, "server_error", "Could not create event.");

    return NextResponse.json({ event: toEvent(data) }, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    // RLS limits this to the caller's own events.
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return errorResponse(500, "server_error", "Could not load events.");

    return NextResponse.json({ events: (data ?? []).map(toEvent) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
