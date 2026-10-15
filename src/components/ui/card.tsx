import * as React from "react";
import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "card-surface rounded-[var(--radius)] bg-card p-7 text-card-foreground shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("flex flex-col gap-1.5 p-[1.125rem]", className)} {...props} />;
}

export function CardTitle({ className, ...props }: DivProps) {
  return <h3 className={cn("font-display text-h2", className)} {...props} />;
}

export function CardDescription({ className, ...props }: DivProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("p-[1.125rem] pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div className={cn("flex items-center p-[1.125rem] pt-0", className)} {...props} />
  );
}
