import { cn } from "@/lib/utils";

export type BookingStatus = "pending" | "confirmed" | "declined";

const styles: Record<BookingStatus, string> = {
  pending: "border border-plum bg-ivory text-plum",
  confirmed: "border border-[#1f3a32] bg-ivory text-[#1f3a32]",
  declined: "border border-brick bg-ivory text-brick",
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
