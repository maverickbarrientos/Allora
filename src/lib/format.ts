/** Plain number with thousands separators, no currency symbol. */
export const formatNumber = (n: number) => n.toLocaleString("en-US");

/** Money amount: thousands separators, at most 2 decimals, no currency symbol. */
export const formatAmount = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** "YYYY-MM-DD" to e.g. "February 14, 2027", read as a local date. */
export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** ISO timestamp to e.g. "October 15, 2026, 1:20 PM", in local time. */
export const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
