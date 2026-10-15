import { cn } from "@/lib/utils";

export type BookingStatus = "pending" | "confirmed" | "declined";

const styles: Record<BookingStatus, string> = {
  pending: "border border-brass text-brass-ink",
  confirmed: "bg-forest/10 text-forest",
  declined: "bg-brick/[0.08] text-brick",
};

/** Always shows the text label, never colour alone. */
export function StatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
        styles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
