import * as React from "react";
import { cn } from "@/lib/utils";

/** Stone block with a faint shimmer (see `.skeleton` in globals.css). */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton rounded-[calc(var(--radius)-0.25rem)]", className)}
      {...props}
    />
  );
}
