import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:bg-ink-muted disabled:text-ivory",
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-stone active:bg-foreground/10 disabled:text-ink-muted",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-stone active:bg-foreground/10 disabled:text-ink-muted",
        ghost: "hover:bg-foreground/10 active:bg-foreground/15 disabled:text-ink-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 disabled:bg-ink-muted disabled:text-ivory",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-11 px-5",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
