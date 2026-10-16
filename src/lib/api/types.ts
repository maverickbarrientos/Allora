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
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export type Event = {
  id: string;
  name: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  budget: number;
  guestCount: number;
  notes: string | null;
  /** docs/SPEC-event-location.md: free text, or null when not set. */
  area: string | null;
};
export type Vendor = {
  id: string;
  name: string;
  category: string;
  price: number;
  /** docs/SPEC-vendor-profiles.md: free text, or null when the vendor hasn't set one. */
  location: string | null;
  /** docs/SPEC-event-location.md: the area the vendor serves, or null. Used to filter by event area. */
  area: string | null;
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
/** docs/SPEC-vendor-profiles.md: a vendor with its profile text; terms from docs/SPEC-booking-documents.md. */
export type VendorDetail = Vendor & { about: string | null; terms: string | null };
/** Contact details; shown to customers only after the vendor confirms their booking. */
export type VendorContact = { phone: string | null; email: string | null; website: string | null };
export type VendorProfile = { vendor: VendorDetail; contact: VendorContact; categoryLocked: boolean };
/** Body for creating or editing a vendor profile; null or "" clears an optional field. */
export type VendorProfileInput = {
  name: string;
  category: string;
  price: number;
  about?: string | null;
  location?: string | null;
  /** Free text up to 60 characters; the area the vendor serves. */
  area?: string | null;
  terms?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};
/** docs/SPEC-booking-documents.md: a booking's contract, for the event's customer only. */
export type BookingContract = {
  bookingId: string;
  category: string;
  status: BookingStatus;
  bookedAt: string;
  event: { id: string; name: string | null; type: EventType; date: string; guestCount: number };
  vendor: { name: string; price: number };
  customerName: string;
  /** The vendor's terms as the customer agreed to them; null when the vendor had none. */
  terms: string | null;
  agreedAt: string | null;
};
// Messages between a customer and a vendor (docs/SPEC-messages.md).
export type Message = { id: string; body: string; createdAt: string; mine: boolean };
export type ConversationDetail = {
  id: string;
  otherName: string;
  category: string;
  /** False when the pair has no pending or confirmed booking left: read-only. */
  open: boolean;
  /** False for a seeded vendor with no account: nobody will read the messages. */
  vendorHasAccount: boolean;
  /** Oldest first. */
  messages: Message[];
  hasMore: boolean;
};
export type ConversationSummary = {
  id: string;
  otherName: string;
  category: string;
  open: boolean;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
};
export type BookingConversation = { conversationId: string; unread: number };
export type PlanBooking = {
  id: string;
  eventId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
  /** When the customer asked to cancel; null if no request is open (docs/SPEC-customer-cancel.md). */
  cancelRequestedAt: string | null;
  /** docs/SPEC-payment.md. Always sent by the API; the UI still copes without it. */
  payment?: PlanPayment | null;
};

/** docs/SPEC-booking-documents.md: a booking's receipt, for the event's customer only. */
export type BookingReceipt = {
  bookingId: string;
  category: string;
  status: BookingStatus;
  bookedAt: string;
  event: { id: string; name: string | null; type: EventType; date: string; guestCount: number };
  vendor: { name: string; price: number };
  /** null when no deposit was ever paid. paidAt is when the deposit was paid. */
  deposit: { status: "paid" | "refunded"; amount: number | null; paidAt: string | null; fullyPaid: boolean } | null;
};

// Shape from docs/SPEC-vendor-portal.md ("Shared shapes").
export type VendorBooking = {
  id: string;
  category: string;
  status: BookingStatus;
  createdAt: string;
  cancelRequestedAt: string | null;
  customerName: string;
  event: { type: EventType; date: string; guestCount: number; budget: number };
  /** docs/SPEC-payment.md. Always sent by the API; the UI still copes without it. */
  payment?: VendorPayment | null;
};

// Shapes from docs/SPEC-payment.md ("Shared shapes").
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type PaymentKind = "deposit" | "full" | "balance";
export type Payment = {
  id: string;
  kind: PaymentKind;
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
  /** True once the whole price is paid (a full payment, or deposit plus balance). */
  fullyPaid: boolean;
  /** What is still owed after a deposit; 0 otherwise. */
  balanceDue: number;
};
export type VendorPayment = { status: PaymentStatus; paidAmount: number | null; fullyPaid: boolean };
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
  affordability?: Affordability;
  summary?: PlanSummary;
};
export type ChatIntent = "affordability" | "summary";
export type Verdict = "within_budget" | "tight" | "cannot_cover_all" | "over_budget";
export type Affordability = {
  budget: number;
  committed: number;
  remaining: number;
  projectedMinimum: number;
  verdict: Verdict;
  rows: { category: string; share: number; booked: number; difference: number; lowestPrice: number | null }[];
};
export type PlanSummary = {
  daysUntilEvent: number;
  budget: number;
  committed: number;
  remaining: number;
  counts: { pending: number; confirmed: number; declined: number };
  rows: {
    category: string;
    state: "confirmed" | "pending" | "needs_replacement" | "missing";
    vendorName: string | null;
    amount: number;
  }[];
};

// Shapes from docs/SPEC-dashboard.md.
export type DashboardActionType = "pay_deposit" | "find_replacement" | "awaiting_vendor";
export type DashboardAction = {
  type: DashboardActionType;
  bookingId: string;
  vendorName: string;
  category: string;
  /** The deposit amount for pay_deposit, otherwise null. */
  amount: number | null;
};
export type MissingService = { category: string; budgetShare: number };
export type Dashboard = {
  event: Event;
  bookingCounts: { pending: number; confirmed: number; declined: number };
  actions: DashboardAction[];
  missing: MissingService[];
};

export type CreateEventInput = {
  name: string;
  type: EventType;
  date: string;
  budget: number;
  guestCount: number;
  notes?: string | null;
  /** Free text up to 60 characters; null or "" clears it. */
  area?: string | null;
  /** The event's services in order. Omitted: the type's default list. */
  services?: string[];
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
  /** The type's default services, in order. */
  services: string[];
};
/** Only the fields present are changed. `notes: null` clears the notes. */
export type UpdateEventInput = Partial<Omit<CreateEventInput, "services">>;

// Budgets by service (GET and PUT /api/events/:id/budgets). One entry per
// checklist service, in checklist order. `amount` is null when no budget is set;
// `share` is the set amount, or the suggested share when none is set.
export type ServiceBudget = { category: string; amount: number | null; share: number; booked: number };
export type BudgetSummary = { eventBudget: number; allocated: number; budgets: ServiceBudget[] };
/** `amount: null` clears that service's budget. */
export type BudgetEntry = { category: string; amount: number | null };

// The event's own service list (GET /api/events/:id/services), in list order.
// `status` is the strongest active booking (confirmed over pending), or null for a gap.
export type EventService = { category: string; status: "pending" | "confirmed" | null };

/** Error body for all errors: `{ error: { code, message } }`. */
export type ErrorBody = { error: { code: string; message: string } };
