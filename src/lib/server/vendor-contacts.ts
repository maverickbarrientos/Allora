// A vendor's contact details (docs/SPEC-vendor-profiles.md). RLS on
// vendor_contacts decides who gets a row: the vendor's owner, and customers
// with a confirmed booking with that vendor.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact } from "@/lib/vendor-profile";

export const CONTACT_COLUMNS = "phone, email, website";
export const NO_CONTACT: Contact = { phone: null, email: null, website: null };

/** The contact details the caller may read (all null when there is no row), or null if the query fails. */
export async function loadContact(supabase: SupabaseClient, vendorId: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("vendor_contacts")
    .select(CONTACT_COLUMNS)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (error) return null;
  return data ?? NO_CONTACT;
}
