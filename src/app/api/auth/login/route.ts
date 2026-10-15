import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE, errorResponse, loadProfile, readJson } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const body = await readJson(req);
  const { email, password } = body ?? {};

  if (
    typeof email !== "string" || !EMAIL_RE.test(email.trim()) ||
    typeof password !== "string" || password === ""
  ) {
    return errorResponse(400, "validation_error", "Email and password are required.");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      if (error?.code === "invalid_credentials" || error?.status === 400) {
        return errorResponse(401, "invalid_credentials", "Wrong email or password.");
      }
      return errorResponse(500, "server_error", "Login failed.");
    }

    const result = await loadProfile(supabase, data.user);
    if (!result) return errorResponse(500, "server_error", "Profile not found.");
    return NextResponse.json(result, { status: 200 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
