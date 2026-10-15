import type {
  CreateEventInput,
  ErrorBody,
  Event,
  LoginInput,
  PlanBooking,
  Session,
  SignupInput,
  Vendor,
} from "./types";

/** An API error response (`{ error: { code, message } }`) with its HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

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
  createBooking: (input: { eventId: string; vendorId: string }) =>
    request<{ booking: PlanBooking }>("POST", "/api/bookings", input),
};
