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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
