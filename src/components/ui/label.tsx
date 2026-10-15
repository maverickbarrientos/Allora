import * as React from "react";
import { cn } from "@/lib/utils";

/** Small uppercase label above a field (see `.label` in globals.css). */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("label", className)} {...props} />;
}
