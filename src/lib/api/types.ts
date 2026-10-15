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
  name: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  budget: number;
  guestCount: number;
  notes: string | null;
};
export type Vendor = {
  id: string;
  name: string;
  category: string;
  price: number;
  /** docs/SPEC-availability.md: present only when listVendors is called with an eventId. */
  availableOnEventDate?: boolean;
};

// Shapes from docs/SPEC-availability.md. Dates are "YYYY-MM-DD".
export type VendorAvailability = { vendorId: string; from: string; to: string; unavailable: string[] };
export type VendorCalendarBooking = {
  bookingId: string;
  date: string;
  status: "pending" | "confirmed";
  eventType: EventType;
  customerName: string;
};
export type VendorCalendar = { from: string; to: string; blocked: string[]; bookings: VendorCalendarBooking[] };
export type VendorProfile = { vendor: Vendor; categoryLocked: boolean };
export type PlanBooking = {
  id: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
  /** docs/SPEC-payment.md. Always sent by the API; the UI still copes without it. */
  payment?: PlanPayment | null;
};

// Shape from docs/SPEC-vendor-portal.md ("Shared shapes").
export type VendorBooking = {
  id: string;
  category: string;
  status: BookingStatus;
  createdAt: string;
  customerName: string;
  event: { type: EventType; date: string; guestCount: number; budget: number };
  /** docs/SPEC-payment.md. Always sent by the API; the UI still copes without it. */
  payment?: VendorPayment | null;
};

// Shapes from docs/SPEC-payment.md ("Shared shapes").
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  status: "paid" | "refunded";
  reference: string;
  createdAt: string;
  refundedAt: string | null;
};
export type PlanPayment = {
  status: PaymentStatus;
  depositAmount: number;
  paidAmount: number | null;
  paidAt: string | null;
};
export type VendorPayment = { status: PaymentStatus; paidAmount: number | null };
export type TestMethod = "approve" | "decline";

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

// Shapes from docs/SPEC-chatbot.md ("Shared shapes").
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type OrderItem = { category: string; reason: string };
export type ChatResponse = {
  reply: string;
  order: OrderItem[] | null;
  source: "ai" | "fallback";
};

export type CreateEventInput = {
  name: string;
  type: EventType;
  date: string;
  budget: number;
  guestCount: number;
  notes?: string | null;
};

// Event upgrades (the merged backend: GET /api/event-templates, PATCH /api/events/:id).

/** Placeholder defaults for the create form, one per event type. */
export type EventTemplate = {
  type: EventType;
  label: string;
  name: string;
  guestCount: number;
  budget: number;
  notes: string;
};
/** Only the fields present are changed. `notes: null` clears the notes. */
export type UpdateEventInput = Partial<CreateEventInput>;

/** Error body for all errors: `{ error: { code, message } }`. */
export type ErrorBody = { error: { code: string; message: string } };
