// TEMPORARY: local-only vendor API responses for frontend acceptance testing.
import type {
  BookingStatus,
  EventType,
  Vendor,
  VendorBooking,
  VendorProfile,
} from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";
import { readMockSession } from "@/mocks/auth";

type MockVendorData = {
  vendor: Vendor;
  bookings: VendorBooking[];
};

const CATEGORIES = ["venue", "catering", "photography", "music", "decoration"];
const PROFILE_PREFIX = "allora.mock.vendor.profile.";
const BOOKINGS_PREFIX = "allora.mock.vendor.bookings.";

// Short latency so saving and in-progress states are visible in the UI.
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));

function currentSession() {
  const session = readMockSession();
  if (!session) throw new ApiError(401, "unauthorized", "Not signed in.");
  return session;
}

function currentVendor() {
  const session = currentSession();
  if (session.profile.role !== "vendor") {
    throw new ApiError(403, "forbidden", "Vendor access is required.");
  }
  return session;
}

function baselineFor(email: string): MockVendorData | null {
  if (email === "vendor@test.com") {
    return {
      vendor: { id: "mock-venue", name: "Aurelia Hall", category: "venue", price: 8500 },
      bookings: [
        booking("pending-1", "pending", "wedding", "venue", "Avery Chen", 84000),
        booking("same", "confirmed", "corporate", "venue", "<img src=x onerror=alert(1)>", 100000000),
        booking("conflict", "declined", "birthday", "venue", "Jordan Williams-Summers-Montgomery", 275000),
        booking("missing", "declined", "wedding", "venue", "Morgan Ellis", 180000),
        booking("network-failure", "confirmed", "corporate", "venue", "Taylor Reed", 62000),
      ],
    };
  }
  if (email === "vendor-clear@test.com") {
    return {
      vendor: {
        id: "mock-catering",
        name: "Cedar & Lace",
        category: "catering",
        price: 4200,
      },
      bookings: [
        booking("declined-1", "declined", "birthday", "catering", "Riley Morgan", 12000),
      ],
    };
  }
  return null;
}

function booking(
  id: string,
  status: BookingStatus,
  type: EventType,
  category: string,
  customerName: string,
  budget: number,
): VendorBooking {
  return {
    id,
    category,
    status,
    createdAt: "2026-10-15T09:00:00.000Z",
    customerName,
    event: {
      type,
      date: "2027-06-12",
      guestCount: 120,
      budget,
    },
  };
}

function readStored<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function writeStored<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function dataFor(email: string): MockVendorData | null {
  const vendor = readStored<Vendor>(`${PROFILE_PREFIX}${email}`);
  const baseline = baselineFor(email);
  const selectedVendor = vendor ?? baseline?.vendor;
  if (!selectedVendor) return null;
  return {
    vendor: selectedVendor,
    bookings:
      readStored<VendorBooking[]>(`${BOOKINGS_PREFIX}${email}`) ??
      baseline?.bookings ??
      [],
  };
}

function categoryLocked(bookings: VendorBooking[]) {
  return bookings.some((item) => item.status === "pending" || item.status === "confirmed");
}

function validate(
  input: Partial<Omit<Vendor, "id">>,
  current: Vendor | null,
  creating: boolean,
) {
  const errors: string[] = [];
  if (creating || "name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 80) {
      errors.push("name");
    }
  }
  if (
    creating ||
    ("category" in input && input.category !== current?.category)
  ) {
    if (typeof input.category !== "string" || !CATEGORIES.includes(input.category)) {
      errors.push("category");
    }
  }
  if (creating || "price" in input) {
    const price = input.price;
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 100_000_000 ||
      Math.round(price * 100) !== price * 100
    ) {
      errors.push("price");
    }
  }
  if (errors.length) {
    throw new ApiError(
      400,
      "validation_error",
      `Invalid fields: ${[...new Set(errors)].join(", ")}.`,
    );
  }
}

export async function listMockCategories(): Promise<{ categories: string[] }> {
  currentSession();
  return { categories: [...CATEGORIES] };
}

export async function getMockVendorProfile(): Promise<VendorProfile> {
  const session = currentVendor();
  const data = dataFor(session.user.email);
  if (!data) throw new ApiError(404, "vendor_not_linked", "Vendor profile not found.");
  return {
    vendor: { ...data.vendor },
    categoryLocked: categoryLocked(data.bookings),
  };
}

export async function createMockVendorProfile(
  input: Omit<Vendor, "id">,
): Promise<{ vendor: Vendor; categoryLocked: false }> {
  const session = currentVendor();
  await delay();
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "validation_error", "Profile fields are required.");
  }
  if (dataFor(session.user.email)) {
    throw new ApiError(409, "profile_exists", "A vendor profile already exists.");
  }
  if (typeof input.name === "string" && input.name.trim() === "fail") {
    throw new ApiError(500, "server_error", "Could not create vendor profile.");
  }
  validate(input, null, true);
  if (input.price === 0) {
    throw new ApiError(400, "validation_error", "Invalid fields: price.");
  }
  const vendor: Vendor = {
    id: `mock-vendor-${session.user.id}`,
    name: input.name.trim(),
    category: input.category,
    price: input.price,
  };
  writeStored(`${PROFILE_PREFIX}${session.user.email}`, vendor);
  writeStored(`${BOOKINGS_PREFIX}${session.user.email}`, []);
  return { vendor, categoryLocked: false };
}

export async function updateMockVendorProfile(
  input: Partial<Omit<Vendor, "id">>,
): Promise<VendorProfile> {
  const session = currentVendor();
  await delay();
  const data = dataFor(session.user.email);
  if (!data) throw new ApiError(404, "vendor_not_linked", "Vendor profile not found.");
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "validation_error", "At least one profile field is required.");
  }
  const fields: Partial<Omit<Vendor, "id">> = {};
  if ("name" in input) fields.name = input.name;
  if ("category" in input) fields.category = input.category;
  if ("price" in input) fields.price = input.price;
  if (Object.keys(fields).length === 0) {
    throw new ApiError(400, "validation_error", "At least one profile field is required.");
  }
  if (typeof fields.name === "string" && fields.name.trim() === "fail") {
    throw new ApiError(500, "server_error", "Could not update vendor profile.");
  }
  validate(fields, data.vendor, false);
  if (
    fields.category !== undefined &&
    fields.category !== data.vendor.category &&
    categoryLocked(data.bookings)
  ) {
    throw new ApiError(409, "category_locked", "Category cannot change while bookings are active.");
  }
  const vendor = { ...data.vendor, ...fields };
  if (typeof vendor.name === "string") vendor.name = vendor.name.trim();
  writeStored(`${PROFILE_PREFIX}${session.user.email}`, vendor);
  return { vendor, categoryLocked: categoryLocked(data.bookings) };
}

export async function listMockVendorBookings(): Promise<{
  vendor: Vendor;
  bookings: VendorBooking[];
}> {
  const session = currentVendor();
  const data = dataFor(session.user.email);
  if (!data) throw new ApiError(404, "vendor_not_linked", "Vendor profile not found.");
  return {
    vendor: { ...data.vendor },
    bookings: data.bookings.map((item) => ({ ...item, event: { ...item.event } })),
  };
}

export async function decideMockVendorBooking(
  id: string,
  status: "confirmed" | "declined",
): Promise<{ booking: VendorBooking }> {
  const session = currentVendor();
  await delay();
  const data = dataFor(session.user.email);
  if (!data) throw new ApiError(404, "vendor_not_linked", "Vendor profile not found.");
  if (status !== "confirmed" && status !== "declined") {
    throw new ApiError(400, "validation_error", "status must be confirmed or declined.");
  }
  if (id === "missing") {
    throw new ApiError(404, "booking_not_found", "Booking not found.");
  }
  if (id === "same") {
    throw new ApiError(409, "status_unchanged", "This booking already has that status.");
  }
  if (id === "conflict") {
    throw new ApiError(
      409,
      "conflicting_booking",
      "Another active booking exists for this event.",
    );
  }
  if (id === "network-failure") {
    throw new ApiError(0, "server_error", "Network error.");
  }
  const bookingIndex = data.bookings.findIndex((item) => item.id === id);
  if (bookingIndex < 0) {
    throw new ApiError(404, "booking_not_found", "Booking not found.");
  }
  const booking = data.bookings[bookingIndex];
  if (booking.status === status) {
    throw new ApiError(409, "status_unchanged", "This booking already has that status.");
  }
  const updated = { ...booking, status };
  const bookings = [...data.bookings];
  bookings[bookingIndex] = updated;
  writeStored(`${BOOKINGS_PREFIX}${session.user.email}`, bookings);
  return { booking: { ...updated, event: { ...updated.event } } };
}
