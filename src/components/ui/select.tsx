import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select styled like Input. */
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-ivory px-4 py-2 text-base",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-[invalid=true]:border-destructive",
        "disabled:cursor-not-allowed disabled:bg-stone disabled:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
