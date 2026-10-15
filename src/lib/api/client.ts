import type {
  BudgetEntry,
  BudgetSummary,
  ChatIntent,
  ChatMessage,
  ChatResponse,
  CreateEventInput,
  Dashboard,
  ErrorBody,
  Event,
  EventService,
  EventTemplate,
  LoginInput,
  MissingResponse,
  Payment,
  PlanBooking,
  Session,
  SignupInput,
  TestMethod,
  UpdateEventInput,
  Vendor,
  VendorAvailability,
  VendorBooking,
  VendorCalendar,
  VendorProfile,
  VendorProfileInput,
  VendorDetail,
  VendorContact,
} from "./types";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

/** Normalises anything thrown (including network failures) into an ApiError. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, "server_error", "Something went wrong");
}

// TEMPORARY: NEXT_PUBLIC_USE_MOCKS=true serves the dashboard and the event list
// from src/mocks/dashboard.ts until GET /api/events/:id/dashboard is on main.
// Inlined at build time, so the mock module is dropped when the flag is off.
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function send(method: string, path: string, body?: unknown) {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await send(method, path, body);
  } catch {
    throw new ApiError(0, "server_error", "Network error");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "server_error",
      err?.message ?? "Something went wrong",
    );
  }
  return data as T;
}

export const api = {
  signup: (input: SignupInput) => request<Session>("POST", "/api/auth/signup", input),
  login: (input: LoginInput) => request<Session>("POST", "/api/auth/login", input),
  logout: () => request<void>("POST", "/api/auth/logout"),
  me: () => request<Session>("GET", "/api/me"),

  createEvent: (input: CreateEventInput) =>
    request<{ event: Event }>("POST", "/api/events", input),
  listEvents: () =>
    USE_MOCKS ? import("@/mocks/dashboard").then((m) => m.mockListEvents()) : request<{ events: Event[] }>("GET", "/api/events"),
  getDashboard: (eventId: string) =>
    USE_MOCKS
      ? import("@/mocks/dashboard").then((m) => m.mockDashboard(eventId))
      : request<Dashboard>("GET", `/api/events/${encodeURIComponent(eventId)}/dashboard`),
  listEventTemplates: () => request<{ templates: EventTemplate[] }>("GET", "/api/event-templates"),
  updateEvent: (eventId: string, input: UpdateEventInput) =>
    request<{ event: Event }>("PATCH", `/api/events/${encodeURIComponent(eventId)}`, input),
  getBudgets: (eventId: string) =>
    request<BudgetSummary>("GET", `/api/events/${encodeURIComponent(eventId)}/budgets`),
  saveBudgets: (eventId: string, budgets: BudgetEntry[]) =>
    request<BudgetSummary>("PUT", `/api/events/${encodeURIComponent(eventId)}/budgets`, { budgets }),
  getServices: (eventId: string) =>
    request<{ services: EventService[] }>("GET", `/api/events/${encodeURIComponent(eventId)}/services`),
  saveServices: (eventId: string, services: string[]) =>
    request<{ services: EventService[] }>("PUT", `/api/events/${encodeURIComponent(eventId)}/services`, {
      services,
    }),
  getPlan: (eventId: string) =>
    request<{ event: Event; bookings: PlanBooking[] }>(
      "GET",
      `/api/events/${encodeURIComponent(eventId)}/plan`,
    ),
  listVendors: (category?: string, eventId?: string, location?: string) => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (eventId) q.set("eventId", eventId);
    if (location) q.set("location", location);
    const qs = q.toString();
    return request<{ vendors: Vendor[] }>("GET", qs ? `/api/vendors?${qs}` : "/api/vendors");
  },
  /** One vendor's profile; with eventId it also says whether they are free on the event's date. */
  getVendor: (vendorId: string, eventId?: string) =>
    request<{ vendor: VendorDetail; contact: VendorContact | null; contactVisible: boolean }>(
      "GET",
      `/api/vendors/${encodeURIComponent(vendorId)}${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
    ),
  getVendorAvailability: (vendorId: string, from: string, to: string) =>
    request<VendorAvailability>(
      "GET",
      `/api/vendors/${encodeURIComponent(vendorId)}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  getVendorCalendar: (from: string, to: string) =>
    request<VendorCalendar>("GET", `/api/vendor/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getMissing: (eventId: string) =>
    request<MissingResponse>("GET", `/api/events/${encodeURIComponent(eventId)}/missing`),
  chat: (eventId: string, messages: ChatMessage[], intent?: ChatIntent) =>
    request<ChatResponse>("POST", `/api/events/${encodeURIComponent(eventId)}/chat`, { messages, intent }),
  createBooking: (input: { eventId: string; vendorId: string }) =>
    request<{ booking: PlanBooking }>("POST", "/api/bookings", input),
  payBooking: (bookingId: string, testMethod: TestMethod) =>
    request<{ payment: Payment; booking: PlanBooking }>(
      "POST",
      `/api/bookings/${encodeURIComponent(bookingId)}/pay`,
      { testMethod },
    ),

  listVendorBookings: () =>
    request<{ vendor: Vendor; bookings: VendorBooking[] }>("GET", "/api/vendor/bookings"),
  decideBooking: (id: string, status: "confirmed" | "declined") =>
    request<{ booking: VendorBooking }>(
      "PATCH",
      `/api/vendor/bookings/${encodeURIComponent(id)}`,
      { status },
    ),
  listCategories: () => request<{ categories: string[] }>("GET", "/api/categories"),
  getVendorProfile: () => request<VendorProfile>("GET", "/api/vendor/profile"),
  createVendorProfile: (input: VendorProfileInput) =>
    request<VendorProfile>("POST", "/api/vendor/profile", input),
  updateVendorProfile: (input: Partial<VendorProfileInput>) =>
    request<VendorProfile>("PATCH", "/api/vendor/profile", input),
};
