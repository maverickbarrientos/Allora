"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const toggleClass = cn(
  "absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg text-muted-foreground",
  "transition-colors hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-50",
);

/** Password field with an inline show/hide toggle. */
export function PasswordInput({ className, disabled, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        disabled={disabled}
        type={show ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        disabled={disabled}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        aria-controls={props.id}
        className={toggleClass}
      >
        {show ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
