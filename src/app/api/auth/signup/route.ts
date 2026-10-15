import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE, errorResponse, loadProfile, readJson } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const body = await readJson(req);
  const { email, password, name, role } = body ?? {};

  if (
    typeof email !== "string" || !EMAIL_RE.test(email.trim()) ||
    typeof password !== "string" || password.length < 8 ||
    typeof name !== "string" || name.trim() === "" ||
    (role !== "customer" && role !== "vendor")
  ) {
    return errorResponse(400, "validation_error", "Invalid email, password, name or role.");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), role } },
    });

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") {
        return errorResponse(409, "email_taken", "Email already registered.");
      }
      if (error.code === "weak_password" || error.code === "email_address_invalid" || error.code === "validation_failed") {
        return errorResponse(400, "validation_error", error.message);
      }
      return errorResponse(500, "server_error", "Sign up failed.");
    }
    // With email confirmation on, an existing email returns a fake user with no identities.
    if (!data.user || data.user.identities?.length === 0) {
      return errorResponse(409, "email_taken", "Email already registered.");
    }
    // No session means email confirmation is enabled; the spec requires a signed-in user.
    if (!data.session) {
      return errorResponse(500, "server_error", "Email confirmation must be disabled in Supabase.");
    }

    const result = await loadProfile(supabase, data.user);
    if (!result) return errorResponse(500, "server_error", "Profile was not created.");
    return NextResponse.json(result, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
