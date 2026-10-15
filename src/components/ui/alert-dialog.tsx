"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * shadcn-style AlertDialog (same part names), built on the native <dialog>
 * element so it needs no new dependency. showModal() gives a focus trap, Esc
 * to close and an inert page behind it. Controlled: pass `open` and
 * `onOpenChange`. It does not close on a backdrop click.
 */
export function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      className="surface-plum m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius)] border border-pink/50 bg-card p-7 text-card-foreground shadow-soft backdrop:bg-black/50"
    >
      {open && children}
    </dialog>
  );
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-display text-h2", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function AlertDialogCancel(props: ButtonProps) {
  return <Button variant="outline" {...props} />;
}

export function AlertDialogAction(props: ButtonProps) {
  return <Button {...props} />;
}
