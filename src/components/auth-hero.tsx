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
    <aside className="paper-grain surface-plum flex flex-col gap-2 rounded-none border-0 bg-[radial-gradient(circle_at_100%_0%,rgb(183_110_121/0.12),transparent_55%),var(--surface-gradient)] px-4 py-5 shadow-none sm:px-6 lg:min-h-screen lg:justify-between lg:gap-12 lg:p-16">
      <span className="font-display text-2xl">Allora</span>
      <p className="max-w-[65ch] text-muted-foreground lg:hidden">{line}</p>
      <div className="hidden flex-col gap-12 lg:flex">
        <h2 className="font-display text-display max-w-[14ch]">{headline}</h2>
        <ImagePlaceholder caption="Table setting, natural light" aspect="16 / 9" />
      </div>
    </aside>
  );
}
