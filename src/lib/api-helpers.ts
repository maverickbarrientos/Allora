import { NextResponse } from "next/server";
import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";

export type Role = "customer" | "vendor";

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function loadProfile(supabase: SupabaseClient, user: AuthUser) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: { id: data.id as string, name: data.name as string, role: data.role as Role },
  };
}

export { EMAIL_RE } from "@/lib/validation";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads the signed-in caller's session and profile. Returns an error response
 * instead when logged out (401) or, if `role` is given, when the caller's role
 * differs (403).
 */
export async function requireSession(supabase: SupabaseClient, role?: Role) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response: errorResponse(401, "unauthorized", "Not signed in.") };
  }
  const session = await loadProfile(supabase, data.user);
  if (!session) return { response: errorResponse(401, "unauthorized", "Not signed in.") };
  if (role && session.profile.role !== role) {
    return { response: errorResponse(403, "forbidden", "Not allowed for this role.") };
  }
  return { session };
}
