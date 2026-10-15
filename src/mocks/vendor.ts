// TEMPORARY mock of GET /api/vendor/bookings and PATCH /api/vendor/bookings/:id
// with the payment field (docs/SPEC-payment.md). Used only when
// NEXT_PUBLIC_USE_MOCKS=true. Decisions follow SPEC-vendor-upgrade.md (a
// confirmed booking can be declined, same status -> 409 status_unchanged).
// Declining a paid booking refunds it, and the customer's mock plan shows it.

import { ApiError } from "@/lib/api/client";
import type { Vendor, VendorBooking } from "@/lib/api/types";
import { delay, load, mockRole, paidPayment, paymentStatus, refundIfPaid, save, type MockBooking } from "./payments";

const VENDOR: Vendor = { id: "mock-vendor", name: "Demo vendor", category: "venue", price: 120000 };

function toVendorBooking(b: MockBooking): VendorBooking {
  if (b.omitPayment) {
    const { payment: _omit, ...rest } = toVendorBooking({ ...b, omitPayment: false });
    void _omit;
    return rest;
  }
  return {
    id: b.id,
    category: b.category,
    status: b.status,
    createdAt: b.createdAt,
    event: { type: "wedding", date: "2027-06-12", guestCount: 150 },
    payment: { status: paymentStatus(b), paidAmount: paidPayment(b)?.amount ?? null },
  };
}

async function requireVendor() {
  if ((await mockRole()) !== "vendor") throw new ApiError(403, "forbidden", "Vendor accounts only.");
}

export async function listVendorBookings(): Promise<{ vendor: Vendor; bookings: VendorBooking[] }> {
  await delay();
  await requireVendor();
  const bookings = [...load().bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { vendor: VENDOR, bookings: bookings.map(toVendorBooking) };
}

export async function decideBooking(
  id: string,
  status: "confirmed" | "declined",
): Promise<{ booking: VendorBooking }> {
  await delay(700);
  await requireVendor();
  const store = load();
  const b = store.bookings.find((x) => x.id === id);
  if (!b) throw new ApiError(404, "booking_not_found", "Booking not found.");
  if (b.status === status) throw new ApiError(409, "status_unchanged", `This booking is already ${status}.`);
  b.status = status;
  if (status === "declined") refundIfPaid(b);
  save(store);
  return { booking: toVendorBooking(b) };
}
