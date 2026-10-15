// Maps DB rows (snake_case) to the API shapes in docs/SPEC-events-booking.md.

export type EventType = "wedding" | "birthday" | "corporate";
export type BookingStatus = "pending" | "confirmed" | "declined";

export const EVENT_COLUMNS = "id, name, type, date, budget, guest_count, notes";
export const VENDOR_COLUMNS = "id, name, category, price, location";
/** A vendor with its profile text (docs/SPEC-vendor-profiles.md). */
export const VENDOR_DETAIL_COLUMNS = "id, name, category, price, about, location";
export const PLAN_BOOKING_COLUMNS =
  "id, event_id, vendor_id, category, status, created_at, vendor:vendors(name, price)";

type EventRow = {
  id: string;
  name: string;
  type: string;
  date: string;
  budget: number | string;
  guest_count: number;
  notes: string | null;
};
type VendorRow = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  location: string | null;
};
type VendorDetailRow = VendorRow & { about: string | null };
type PlanBookingRow = {
  id: string;
  event_id: string;
  vendor_id: string;
  category: string;
  status: string;
  created_at: string;
  // A single object at runtime; typed loosely because there are no generated DB types.
  vendor: VendorJoin | VendorJoin[] | null;
};
type VendorJoin = { name: string; price: number | string };

export function toEvent(row: EventRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type as EventType,
    date: row.date,
    budget: Number(row.budget),
    guestCount: row.guest_count,
    notes: row.notes ?? null,
  };
}

export function toVendor(row: VendorRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    location: row.location ?? null,
  };
}

export function toVendorDetail(row: VendorDetailRow) {
  return { ...toVendor(row), about: row.about ?? null };
}

export function toPlanBooking(row: PlanBookingRow) {
  const vendor = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor;
  return {
    id: row.id,
    eventId: row.event_id,
    vendorId: row.vendor_id,
    vendorName: vendor?.name ?? "",
    category: row.category,
    price: Number(vendor?.price ?? 0),
    status: row.status as BookingStatus,
    createdAt: row.created_at,
  };
}
