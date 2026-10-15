/** Digits with an optional decimal part. No signs, commas or exponents. */
const NUMBER_RE = /^\d+(\.\d+)?$/;

export type AmountCheck =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "not_a_number" | "not_positive" | "decimals" | "too_high" };

/**
 * Reads a money field the way the server checks it: above 0, at most `max`,
 * at most 2 decimals. `raw` is the text as typed.
 */
export function parseAmount(raw: string, max: number): AmountCheck {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (/^-\d/.test(text)) return { ok: false, reason: "not_positive" };
  if (!NUMBER_RE.test(text)) return { ok: false, reason: "not_a_number" };
  if ((text.split(".")[1] ?? "").length > 2) return { ok: false, reason: "decimals" };
  const value = Number(text);
  if (value <= 0) return { ok: false, reason: "not_positive" };
  if (value > max) return { ok: false, reason: "too_high" };
  return { ok: true, value };
}

/** Whole cents, so sums of 2-decimal amounts stay exact. */
export const toCents = (n: number) => Math.round(n * 100);
