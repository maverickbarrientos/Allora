import type {
  ChatMessage,
  ChatResponse,
  CreateEventInput,
  ErrorBody,
  Event,
  LoginInput,
  MissingResponse,
  Payment,
  PlanBooking,
  Session,
  SignupInput,
  TestMethod,
  Vendor,
  VendorBooking,
  VendorProfile,
} from "./types";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

/** Normalises anything thrown (including network failures) into an ApiError. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, "server_error", "Something went wrong");
}

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
  listEvents: () => request<{ events: Event[] }>("GET", "/api/events"),
  getPlan: (eventId: string) =>
    request<{ event: Event; bookings: PlanBooking[] }>(
      "GET",
      `/api/events/${encodeURIComponent(eventId)}/plan`,
    ),
  listVendors: (category?: string) =>
    request<{ vendors: Vendor[] }>(
      "GET",
      category ? `/api/vendors?category=${encodeURIComponent(category)}` : "/api/vendors",
    ),
  getMissing: (eventId: string) =>
    request<MissingResponse>("GET", `/api/events/${encodeURIComponent(eventId)}/missing`),
  chat: (eventId: string, messages: ChatMessage[]) =>
    request<ChatResponse>("POST", `/api/events/${encodeURIComponent(eventId)}/chat`, { messages }),
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
  createVendorProfile: (input: Omit<Vendor, "id">) =>
    request<{ vendor: Vendor; categoryLocked: false }>("POST", "/api/vendor/profile", input),
  updateVendorProfile: (input: Partial<Omit<Vendor, "id">>) =>
    request<VendorProfile>("PATCH", "/api/vendor/profile", input),
};
