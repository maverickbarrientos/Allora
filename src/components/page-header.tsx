import { cn } from "@/lib/utils";

/**
 * Label, serif title, optional description, then a short gradient rule
 * (brass fading out) that draws left to right: the one highlight on the screen.
 * `action` sits on the right of the title (e.g. a button).
 */
export function PageHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {label && <p className="label">{label}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-h1">{title}</h1>
        {action}
      </div>
      {description && (
        <p className="max-w-[65ch] text-muted-foreground">{description}</p>
      )}
      <div aria-hidden="true" className="hairline-draw mt-1 h-px w-full bg-linear-to-r from-brass to-transparent" />
    </header>
  );
}
