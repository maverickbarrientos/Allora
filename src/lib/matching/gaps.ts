type BookingLike = { category: string; status: string };

/**
 * The event's services with no pending or confirmed booking, in list order.
 * Declined bookings and categories outside the list are ignored.
 */
export function findGaps(services: readonly string[], bookings: readonly BookingLike[]): string[] {
  const covered = new Set(
    bookings
      .filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "cancel_requested")
      .map((b) => b.category),
  );
  return services.filter((category) => !covered.has(category));
}
