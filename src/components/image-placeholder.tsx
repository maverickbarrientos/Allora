import { cn } from "@/lib/utils";

/**
 * The only way to show a photo slot. Without `src` it renders a soft
 * placeholder; with `src` it renders the real image.
 */
export function ImagePlaceholder({
  caption,
  aspect = "16 / 9",
  src,
  loading = "lazy",
  className,
}: {
  caption: string;
  aspect?: string;
  src?: string;
  /** "eager" for a picture that is visible on first load. */
  loading?: "lazy" | "eager";
  className?: string;
}) {
  if (src) {
    return (
      <div
        className={cn("overflow-hidden rounded-[calc(var(--radius)-0.25rem)]", className)}
        style={{ aspectRatio: aspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // PLACEHOLDER: replace with photography
  return (
    <div
      data-placeholder
      role="img"
      aria-label={caption}
      className={cn("relative overflow-hidden rounded-[calc(var(--radius)-0.25rem)]", className)}
      style={{
        aspectRatio: aspect,
        background:
          "linear-gradient(135deg, var(--stone), color-mix(in srgb, var(--brass) 18%, var(--stone)))",
      }}
    >
      <span className="absolute bottom-2 left-3 right-3 text-xs text-muted-foreground">
        {caption}
      </span>
    </div>
  );
}
