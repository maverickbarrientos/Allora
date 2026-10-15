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
        booking("pending-1", "pending", "wedding", "venue"),
        booking("same", "confirmed", "corporate", "venue"),
        booking("conflict", "declined", "birthday", "venue"),
        booking("missing", "declined", "wedding", "venue"),
        booking("network-failure", "confirmed", "corporate", "venue"),
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
        booking("declined-1", "declined", "birthday", "catering"),
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
): VendorBooking {
  return {
    id,
    category,
    status,
    createdAt: "2026-10-15T09:00:00.000Z",
    event: {
      type,
      date: "2027-06-12",
      guestCount: 120,
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
  creating: boolean,
) {
  const errors: string[] = [];
  if (creating || "name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 80) {
      errors.push("name");
    }
  }
  if (creating || "category" in input) {
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
  if (dataFor(session.user.email)) {
    throw new ApiError(409, "profile_exists", "A vendor profile already exists.");
  }
  if (typeof input.name === "string" && input.name.trim() === "fail") {
    throw new ApiError(500, "server_error", "Could not create vendor profile.");
  }
  validate(input, true);
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
  const data = dataFor(session.user.email);
  if (!data) throw new ApiError(404, "vendor_not_linked", "Vendor profile not found.");
  if (Object.keys(input).length === 0) {
    throw new ApiError(400, "validation_error", "At least one profile field is required.");
  }
  if (typeof input.name === "string" && input.name.trim() === "fail") {
    throw new ApiError(500, "server_error", "Could not update vendor profile.");
  }
  validate(input, false);
  if (
    input.category !== undefined &&
    input.category !== data.vendor.category &&
    categoryLocked(data.bookings)
  ) {
    throw new ApiError(409, "category_locked", "Category cannot change while bookings are active.");
  }
  const vendor = { ...data.vendor, ...input };
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
