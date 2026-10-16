import { cn } from "@/lib/utils";

/**
 * A bar that stays at the bottom of the page content while something is
 * selected (docs/SPEC-bulk-payment.md). It is sticky inside the page, not fixed
 * to the window, so it never covers the sidebar. It sits above the planning
 * assistant's floating button (bottom-right, 4 to 6 rem from the edge).
 */
export function SelectionBar({
  label,
  className,
  children,
}: {
  /** Names the region for screen readers, e.g. "Pay selected bookings". */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "sticky bottom-20 z-20 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-background p-4 shadow-soft sm:bottom-24 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
