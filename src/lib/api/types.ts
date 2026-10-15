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

/** Error body for all errors: `{ error: { code, message } }`. */
export type ErrorBody = { error: { code: string; message: string } };
