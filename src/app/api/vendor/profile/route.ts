import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parseArea } from "@/lib/areas";
import { errorResponse, readJson } from "@/lib/api-helpers";
import { VENDOR_DETAIL_COLUMNS, toVendorDetail } from "@/lib/server/shapes";
import { CONTACT_COLUMNS, NO_CONTACT, loadContact } from "@/lib/server/vendor-contacts";
import { requireVendorRole } from "@/lib/vendor-portal";
import {
  ABOUT_MAX,
  CONTACT_FIELDS,
  LOCATION_MAX,
  TERMS_MAX,
  contactValue,
  invalidFields,
  isCategoryLocked,
  optionalText,
  validCategory,
  validName,
  validPrice,
  type Contact,
  type ProfileFields,
} from "@/lib/vendor-profile";

const notLinked = () =>
  errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.");

async function loadOwnVendor(supabase: SupabaseClient, userId: string) {
  return supabase.from("vendors").select(VENDOR_DETAIL_COLUMNS).eq("owner", userId).maybeSingle();
}

/**
 * Saves the given contact fields; the ones left out keep their value. RLS: owner only.
 * Update first, then insert if there was no row yet. Not an upsert: that would
 * need UPDATE on vendor_id, which 016 doesn't grant so a row can't be moved.
 */
async function saveContact(supabase: SupabaseClient, vendorId: string, changes: Partial<Contact>) {
  const update = () =>
    supabase
      .from("vendor_contacts")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("vendor_id", vendorId)
      .select(CONTACT_COLUMNS)
      .maybeSingle();

  const updated = await update();
  if (updated.error || updated.data) return updated;

  const inserted = await supabase
    .from("vendor_contacts")
    .insert({ vendor_id: vendorId, ...changes })
    .select(CONTACT_COLUMNS)
    .single();
  // A simultaneous save created the row first: update it instead.
  if (inserted.error?.code === "23505") return update();
  return inserted;
}

/** Validates the contact fields present in the body. */
function parseContact(body: Record<string, unknown>, bad: string[]): Partial<Contact> {
  const changes: Partial<Contact> = {};
  for (const field of CONTACT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = contactValue(field, body[field]);
    if (value === undefined) bad.push(field);
    else changes[field] = value;
  }
  return changes;
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

    const [locked, contact] = await Promise.all([
      hasActiveBooking(supabase, vendor.id),
      loadContact(supabase, vendor.id),
    ]);
    if (locked === null) return errorResponse(500, "server_error", "Could not load bookings.");
    if (contact === null) return errorResponse(500, "server_error", "Could not load contact details.");

    return NextResponse.json({ vendor: toVendorDetail(vendor), contact, categoryLocked: locked });
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
    // About, location and terms are optional; left out means none.
    const about = body.about === undefined ? null : optionalText(body.about, ABOUT_MAX);
    const location = body.location === undefined ? null : optionalText(body.location, LOCATION_MAX);
    const area = body.area === undefined ? null : parseArea(body.area);
    const terms = body.terms === undefined ? null : optionalText(body.terms, TERMS_MAX);
    if (about === undefined) bad.push("about");
    if (location === undefined) bad.push("location");
    if (area === undefined) bad.push("area");
    if (terms === undefined) bad.push("terms");
    const contactChanges = parseContact(body, bad);
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
        about,
        location,
        area,
        terms,
        owner: auth.userId,
      })
      .select(VENDOR_DETAIL_COLUMNS)
      .single();
    if (error) {
      // vendors_owner_unique (004): a simultaneous create won the race.
      if (error.code === "23505") {
        return errorResponse(409, "profile_exists", "You already have a vendor profile.");
      }
      return errorResponse(500, "server_error", "Could not create vendor profile.");
    }

    // Everything was validated first, so this only fails on a database error.
    let contact = NO_CONTACT;
    if (Object.values(contactChanges).some((v) => v !== null)) {
      const { data, error: cErr } = await saveContact(supabase, vendor.id, contactChanges);
      if (cErr || !data) return errorResponse(500, "server_error", "Could not save contact details.");
      contact = data;
    }

    return NextResponse.json({ vendor: toVendorDetail(vendor), contact, categoryLocked: false }, { status: 201 });
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
    const editable = ["name", "category", "price", "about", "location", "area", "terms", ...CONTACT_FIELDS];
    if (!editable.some(has)) {
      return errorResponse(400, "validation_error", `Send at least one of ${editable.join(", ")}.`);
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
    // Empty text or null clears about, location, area and terms.
    for (const [field, max] of [["about", ABOUT_MAX], ["location", LOCATION_MAX], ["terms", TERMS_MAX]] as const) {
      if (!has(field)) continue;
      const value = optionalText(body[field], max);
      if (value === undefined) bad.push(field);
      else changes[field] = value;
    }
    if (has("area")) {
      const value = parseArea(body.area);
      if (value === undefined) bad.push("area");
      else changes.area = value;
    }
    const contactChanges = parseContact(body, bad);
    if (bad.length) return errorResponse(400, "validation_error", invalidFields(bad));

    let updated = vendor;
    if (Object.keys(changes).length > 0) {
      const { data, error } = await supabase
        .from("vendors")
        .update(changes)
        .eq("id", vendor.id)
        .select(VENDOR_DETAIL_COLUMNS)
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

    // Everything was validated first, so this only fails on a database error.
    if (Object.keys(contactChanges).length > 0) {
      const { error: cErr } = await saveContact(supabase, vendor.id, contactChanges);
      if (cErr) return errorResponse(500, "server_error", "Could not save contact details.");
    }

    const [locked, contact] = await Promise.all([
      hasActiveBooking(supabase, vendor.id),
      loadContact(supabase, vendor.id),
    ]);
    if (locked === null) return errorResponse(500, "server_error", "Could not load bookings.");
    if (contact === null) return errorResponse(500, "server_error", "Could not load contact details.");

    return NextResponse.json({ vendor: toVendorDetail(updated), contact, categoryLocked: locked });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
