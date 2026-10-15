import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson } from "@/lib/api-helpers";
import { VENDOR_COLUMNS, toVendor } from "@/lib/server/shapes";
import { requireVendorRole } from "@/lib/vendor-portal";
import {
  invalidFields,
  isCategoryLocked,
  validCategory,
  validName,
  validPrice,
  type ProfileFields,
} from "@/lib/vendor-profile";

const notLinked = () =>
  errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.");

async function loadOwnVendor(supabase: SupabaseClient, userId: string) {
  return supabase.from("vendors").select(VENDOR_COLUMNS).eq("owner", userId).maybeSingle();
}

/** True when the vendor has any pending or confirmed booking (RLS: own bookings only). */
async function hasActiveBooking(supabase: SupabaseClient, vendorId: string) {
  const { count, error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .in("status", ["pending", "confirmed"]);
  if (error) return null;
  return (count ?? 0) > 0;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const { data: vendor, error } = await loadOwnVendor(supabase, auth.userId);
    if (error) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return notLinked();

    const locked = await hasActiveBooking(supabase, vendor.id);
    if (locked === null) return errorResponse(500, "server_error", "Could not load bookings.");

    return NextResponse.json({ vendor: toVendor(vendor), categoryLocked: locked });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const body = await readJson(req);
    if (!body) return errorResponse(400, "validation_error", "Body must be a JSON object.");

    const bad: string[] = [];
    if (!validName(body.name)) bad.push("name");
    if (!validCategory(body.category)) bad.push("category");
    if (!validPrice(body.price)) bad.push("price");
    if (bad.length) return errorResponse(400, "validation_error", invalidFields(bad));

    const { data: existing, error: exErr } = await loadOwnVendor(supabase, auth.userId);
    if (exErr) return errorResponse(500, "server_error", "Could not load vendor.");
    if (existing) return errorResponse(409, "profile_exists", "You already have a vendor profile.");

    // owner always comes from the session, never from the body.
    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({
        name: (body.name as string).trim(),
        category: body.category,
        price: body.price,
        owner: auth.userId,
      })
      .select(VENDOR_COLUMNS)
      .single();
    if (error) {
      // vendors_owner_unique (004): a simultaneous create won the race.
      if (error.code === "23505") {
        return errorResponse(409, "profile_exists", "You already have a vendor profile.");
      }
      return errorResponse(500, "server_error", "Could not create vendor profile.");
    }

    return NextResponse.json({ vendor: toVendor(vendor), categoryLocked: false }, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const body = await readJson(req);
    if (!body) return errorResponse(400, "validation_error", "Body must be a JSON object.");

    // Unknown fields, including owner, are ignored.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (!has("name") && !has("category") && !has("price")) {
      return errorResponse(400, "validation_error", "Send at least one of name, category, price.");
    }

    const { data: vendor, error: vErr } = await loadOwnVendor(supabase, auth.userId);
    if (vErr) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return notLinked();

    const changes: ProfileFields = {};
    const bad: string[] = [];
    if (has("name")) {
      if (validName(body.name)) changes.name = body.name.trim();
      else bad.push("name");
    }
    // Category is checked only when it differs from the current value.
    if (has("category") && body.category !== vendor.category) {
      if (validCategory(body.category)) changes.category = body.category;
      else bad.push("category");
    }
    if (has("price")) {
      if (validPrice(body.price)) changes.price = body.price;
      else bad.push("price");
    }
    if (bad.length) return errorResponse(400, "validation_error", invalidFields(bad));

    let updated = vendor;
    if (Object.keys(changes).length > 0) {
      const { data, error } = await supabase
        .from("vendors")
        .update(changes)
        .eq("id", vendor.id)
        .select(VENDOR_COLUMNS)
        .single();
      if (error) {
        if (isCategoryLocked(error)) {
          return errorResponse(
            409,
            "category_locked",
            "Category can't change while you have pending or confirmed bookings.",
          );
        }
        return errorResponse(500, "server_error", "Could not update vendor profile.");
      }
      updated = data;
    }

    const locked = await hasActiveBooking(supabase, vendor.id);
    if (locked === null) return errorResponse(500, "server_error", "Could not load bookings.");

    return NextResponse.json({ vendor: toVendor(updated), categoryLocked: locked });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
