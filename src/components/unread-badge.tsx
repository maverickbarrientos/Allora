import { cn } from "@/lib/utils";

/** The number of unread messages; nothing at zero. `data-unread` is the exact count. */
export function UnreadBadge({ count, className }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      data-unread={count}
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}
