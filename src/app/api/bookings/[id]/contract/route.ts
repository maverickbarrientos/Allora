import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>) => (Array.isArray(v) ? v[0] : v) ?? null;

// A booking's contract (docs/SPEC-booking-documents.md): the booking facts,
// the terms frozen when the customer agreed, and who agreed when. Only the
// customer who owns the event gets it; anyone else, including the booking's
// vendor, gets 404 as if it didn't exist.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const notFound = () => errorResponse(404, "booking_not_found", "Booking not found.");
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    // The inner join plus the owner filter limits this to the caller's own events.
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, category, status, created_at, terms_snapshot, terms_accepted_at, vendor:vendors(name, price), event:events!inner(id, name, type, date, guest_count, owner)",
      )
      .eq("id", id)
      .eq("event.owner", auth.session.user.id)
      .maybeSingle();
    if (error) return errorResponse(500, "server_error", "Could not load booking.");
    if (!data) return notFound();

    const event = one(data.event as One<{ id: string; name: string | null; type: string; date: string; guest_count: number }>);
    const vendor = one(data.vendor as One<{ name: string; price: number | string }>);
    if (!event || !vendor) return notFound();

    return NextResponse.json({
      contract: {
        bookingId: data.id,
        category: data.category,
        status: data.status,
        bookedAt: data.created_at,
        event: { id: event.id, name: event.name, type: event.type, date: event.date, guestCount: event.guest_count },
        vendor: { name: vendor.name, price: Number(vendor.price) },
        customerName: auth.session.profile.name,
        terms: data.terms_snapshot ?? null,
        agreedAt: data.terms_snapshot ? data.terms_accepted_at : null,
      },
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
