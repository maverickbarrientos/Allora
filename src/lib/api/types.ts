// Shared shapes from docs/SPEC-setupa-and-auth.md ("Shared shapes").

export type Role = "customer" | "vendor";

export type User = { id: string; email: string };
export type Profile = { id: string; name: string; role: Role };
export type Session = { user: User; profile: Profile };

export type SignupInput = {
  email: string;
  password: string;
  name: string;
  role: Role;
};
export type LoginInput = { email: string; password: string };

// Shapes from docs/SPEC-events-booking.md ("Shared shapes").

export type EventType = "wedding" | "birthday" | "corporate";
export type BookingStatus = "pending" | "confirmed" | "declined";

export type Event = {
  id: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  budget: number;
  guestCount: number;
};
export type Vendor = { id: string; name: string; category: string; price: number };
export type PlanBooking = {
  id: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
};

// Shape from docs/SPEC-vendor-portal.md ("Shared shapes").
export type VendorBooking = {
  id: string;
  category: string;
  status: BookingStatus;
  createdAt: string;
  event: { type: EventType; date: string; guestCount: number };
};

// Shapes from docs/SPEC-matching.md ("Shared shapes" and API).
export type MatchedVendor = {
  id: string;
  name: string;
  price: number;
  matchPercent: number;
  reason: string;
};
export type MissingCard = {
  category: string;
  budgetShare: number;
  whyItMatters: string;
  vendors: MatchedVendor[];
};
export type MissingResponse = {
  eventId: string;
  textSource: "ai" | "fallback";
  cards: MissingCard[];
};

export type CreateEventInput = {
  type: EventType;
  date: string;
  budget: number;
  guestCount: number;
};

/** Error body for all errors: `{ error: { code, message } }`. */
export type ErrorBody = { error: { code: string; message: string } };
