/**
 * TEMPORARY MOCK. Delete this file (and the USE_MOCKS branch in
 * src/lib/api/client.ts) once the real backend is merged.
 *
 * Implements POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout
 * and GET /api/me as in docs/SPEC-setupa-and-auth.md. Enabled with
 * NEXT_PUBLIC_USE_MOCKS=true. The fake session and registered users live in
 * localStorage.
 *
 * Triggers: email taken@test.com -> 409 email_taken (signup);
 * password wrongpass -> 401 invalid_credentials (login);
 * bad/missing fields or password under 8 chars (signup) -> 400 validation_error.
 */

type Role = "customer" | "vendor";
type StoredUser = { id: string; email: string; password: string; name: string; role: Role };

const USERS_KEY = "allora.mock.users";
const SESSION_KEY = "allora.mock.session"; // holds the signed-in user id
const LATENCY_MS = 400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const users = (): StoredUser[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fail = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });
const sessionBody = (u: StoredUser) => ({
  user: { id: u.id, email: u.email },
  profile: { id: u.id, name: u.name, role: u.role },
});
const str = (v: unknown) => (typeof v === "string" ? v : "");

function signup(b: Record<string, unknown>) {
  const email = str(b.email).trim().toLowerCase();
  const password = str(b.password);
  const name = str(b.name).trim();
  const role = b.role;
  if (!EMAIL_RE.test(email)) return fail(400, "validation_error", "Invalid email");
  if (password.length < 8)
    return fail(400, "validation_error", "Password must be at least 8 characters");
  if (!name) return fail(400, "validation_error", "Name is required");
  if (role !== "customer" && role !== "vendor")
    return fail(400, "validation_error", "Role must be customer or vendor");
  if (email === "taken@test.com" || users().some((u) => u.email === email))
    return fail(409, "email_taken", "Email already registered");

  const user: StoredUser = { id: crypto.randomUUID(), email, password, name, role };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users(), user]));
  localStorage.setItem(SESSION_KEY, user.id);
  return json(201, sessionBody(user));
}

function login(b: Record<string, unknown>) {
  const email = str(b.email).trim().toLowerCase();
  const password = str(b.password);
  if (!EMAIL_RE.test(email) || !password)
    return fail(400, "validation_error", "Email and password are required");
  if (password === "wrongpass")
    return fail(401, "invalid_credentials", "Invalid login credentials");

  const known = users().find((u) => u.email === email);
  if (known && known.password !== password)
    return fail(401, "invalid_credentials", "Invalid login credentials");
  // Unregistered emails sign in as a customer so the flow is easy to try.
  const user: StoredUser = known ?? {
    id: crypto.randomUUID(),
    email,
    password,
    name: email.split("@")[0],
    role: "customer",
  };
  if (!known) localStorage.setItem(USERS_KEY, JSON.stringify([...users(), user]));
  localStorage.setItem(SESSION_KEY, user.id);
  return json(200, sessionBody(user));
}

function me() {
  const id = localStorage.getItem(SESSION_KEY);
  const user = users().find((u) => u.id === id);
  return user ? json(200, sessionBody(user)) : fail(401, "unauthorized", "Not signed in");
}

/** Stands in for fetch() for the four auth routes. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const method = (init.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  try {
    body = init.body ? JSON.parse(String(init.body)) : {};
  } catch {
    body = {};
  }

  if (method === "POST" && path === "/api/auth/signup") return signup(body);
  if (method === "POST" && path === "/api/auth/login") return login(body);
  if (method === "POST" && path === "/api/auth/logout") {
    localStorage.removeItem(SESSION_KEY);
    return new Response(null, { status: 204 });
  }
  if (method === "GET" && path === "/api/me") return me();
  return fail(500, "server_error", `No mock for ${method} ${path}`);
}
