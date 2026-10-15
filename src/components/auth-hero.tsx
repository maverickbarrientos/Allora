import { ImagePlaceholder } from "@/components/image-placeholder";

/**
 * Left panel of /login and /signup. On mobile it shrinks to a compact strip
 * (wordmark and one line, no image).
 */
export function AuthHero({
  headline,
  line,
}: {
  headline: string;
  line: string;
}) {
  return (
    <aside className="paper-grain flex flex-col gap-2 bg-stone px-4 py-5 sm:px-6 lg:min-h-screen lg:justify-between lg:gap-12 lg:p-16">
      <span className="font-display text-2xl">Allora</span>
      <p className="max-w-[65ch] text-muted-foreground lg:hidden">{line}</p>
      <div className="hidden flex-col gap-12 lg:flex">
        <h2 className="font-display text-display max-w-[14ch]">{headline}</h2>
        <ImagePlaceholder
          caption="Event room with floral centerpieces and warm lighting"
          aspect="16 / 9"
          src="/images/auth-hero.jpg"
        />
      </div>
    </aside>
  );
}
