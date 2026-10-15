/** Plain number with thousands separators, no currency symbol. */
export const formatNumber = (n: number) => n.toLocaleString("en-US");

/** "YYYY-MM-DD" to e.g. "February 14, 2027", read as a local date. */
export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
