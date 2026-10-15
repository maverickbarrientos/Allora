import { WEIGHTS } from "@/lib/matching/config";
import { EMAIL_RE } from "@/lib/validation";

/**
 * Allowed vendor categories: every category in the feature 4 config, in config
 * order. Every checklist category has a weight, so WEIGHTS lists them all.
 */
export const CATEGORIES: readonly string[] = Object.keys(WEIGHTS);

export const NAME_MAX = 80;
export const PRICE_MAX = 100_000_000;
export const ABOUT_MAX = 1000;
export const LOCATION_MAX = 80;

export type ProfileFields = {
  name?: string;
  category?: string;
  price?: number;
  about?: string | null;
  location?: string | null;
};

export function validName(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const len = [...v.trim()].length;
  return len >= 1 && len <= NAME_MAX;
}

export function validPrice(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v > 0 &&
    v <= PRICE_MAX &&
    Math.round(v * 100) / 100 === v
  );
}

export function validCategory(v: unknown): v is string {
  return typeof v === "string" && CATEGORIES.includes(v);
}

/**
 * An optional text field (about, location): null, or a string of at most
 * `max` characters after trimming. Returns what to save (an empty string
 * clears it to null), or undefined when the value is invalid.
 */
export function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const text = v.trim();
  if ([...text].length > max) return undefined;
  return text === "" ? null : text;
}

export const CONTACT_FIELDS = ["phone", "email", "website"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type Contact = Record<ContactField, string | null>;

// The same rules as the vendor_contacts checks in 016_vendor_contacts.sql.
const CONTACT_RULES: Record<ContactField, (text: string) => boolean> = {
  phone: (t) => /^[0-9+(). -]{5,30}$/.test(t),
  // The sign-up email check, with the usual 254-character limit.
  email: (t) => t.length <= 254 && EMAIL_RE.test(t),
  // Only http and https links, so a stored link can never run code when clicked.
  website: (t) => {
    if (t.length > 200 || !/^https?:\/\/\S+$/i.test(t)) return false;
    try {
      return ["http:", "https:"].includes(new URL(t).protocol);
    } catch {
      return false;
    }
  },
};

/**
 * One contact field: null, or a string that passes its rule after trimming.
 * Returns what to save (an empty string clears it to null), or undefined when invalid.
 */
export function contactValue(field: ContactField, v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const text = v.trim();
  if (text === "") return null;
  return CONTACT_RULES[field](text) ? text : undefined;
}

export function invalidFields(fields: string[]) {
  return `Invalid fields: ${fields.join(", ")}.`;
}

/** Postgres error raised by the vendors_category_lock trigger (005). */
export function isCategoryLocked(err: { message?: string } | null) {
  return !!err?.message?.includes("category_locked");
}
