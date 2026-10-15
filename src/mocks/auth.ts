// TEMPORARY: local-only authentication responses for frontend acceptance testing.
import type { LoginInput, Profile, Session } from "@/lib/api/types";
import { ApiError } from "@/lib/api/errors";

const SESSION_KEY = "allora.mock.session";

const ACCOUNTS: Record<string, { id: string; name: string; role: Profile["role"] }> = {
  "vendor@test.com": { id: "mock-vendor", name: "Aurelia Hall", role: "vendor" },
  "vendor-clear@test.com": { id: "mock-vendor-clear", name: "Cedar & Lace", role: "vendor" },
  "unlinked@test.com": { id: "mock-vendor-unlinked", name: "New Vendor", role: "vendor" },
  "customer@test.com": { id: "mock-customer", name: "Morgan Ellis", role: "customer" },
};

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return Boolean(
    candidate.user &&
      candidate.profile &&
      (candidate.profile.role === "customer" || candidate.profile.role === "vendor"),
  );
}

export function readMockSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isSession(value) ? value : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function loginWithMock({ email, password }: LoginInput): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase();
  const account = ACCOUNTS[normalizedEmail];
  if (!normalizedEmail || !password) {
    throw new ApiError(400, "validation_error", "Email and password are required.");
  }
  if (!account || password !== "Allora123") {
    throw new ApiError(401, "invalid_credentials", "Wrong email or password.");
  }
  const session: Session = {
    user: { id: account.id, email: normalizedEmail },
    profile: { id: account.id, name: account.name, role: account.role },
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function logoutMock(): Promise<void> {
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
}

export async function getMockSession(): Promise<Session> {
  const session = readMockSession();
  if (!session) throw new ApiError(401, "unauthorized", "Not signed in.");
  return session;
}
