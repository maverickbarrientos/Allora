import Link from "next/link";
import type { Vendor } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CAPTIONS: Record<string, string> = {
  venue: "Venue interior, morning light",
  catering: "Long table, candlelight",
  photography: "Window light, quiet moment",
  music: "Evening room, warm light",
  decoration: "Table setting, natural light",
  florist: "Fresh flowers, soft light",
  cake: "Tiered cake, close up",
  lighting: "String lights, evening",
  transport: "Car at the entrance",
  makeup: "Mirror, warm light",
};
export const captionFor = (category: string) => CAPTIONS[category] ?? "Table setting, natural light";

/**
 * Compact vendor card: image, category label, one-line name (a link to the
 * vendor's page), location, then price and the Book button. The lift on hover comes from Card (pointer devices only).
 */
export function VendorCard({
  vendor,
  href,
  booked,
  eventDate,
  onBook,
}: {
  vendor: Vendor;
  /** The vendor's page for this event. */
  href: string;
  booked: boolean;
  eventDate: string;
  /** Opens "Check availability"; nothing is booked until the customer confirms there. */
  onBook: () => void;
}) {
  const available = vendor.availableOnEventDate;
  return (
    <Card className="flex h-full min-w-0 flex-col gap-2">
      <ImagePlaceholder caption={captionFor(vendor.category)} aspect="16 / 9" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="label">{vendor.category}</p>
        <h2 className="min-w-0 font-display text-h2" title={vendor.name}>
          {/* -my-2 py-2: a 44px tap target without changing the layout */}
          <Link href={href} className="-my-2 block truncate py-2 underline-offset-4 hover:underline">
            {vendor.name}
          </Link>
        </h2>
        {vendor.location && (
          <p className="truncate text-sm text-muted-foreground" title={vendor.location}>
            {vendor.location}
          </p>
        )}
        {available !== undefined && (
          <p className={available ? "text-sm text-forest" : "text-sm text-brick"}>
            {available ? `Available on ${eventDate}` : `Unavailable on ${eventDate}`}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-4">
        <span>{formatNumber(vendor.price)}</span>
        <Button
          className="min-w-[5.5rem]"
          variant={booked ? "outline" : "default"}
          disabled={booked}
          onClick={onBook}
          aria-label={booked ? `${vendor.name}, booked` : `Book ${vendor.name}: check availability first`}
        >
          {booked ? "Booked" : "Book"}
        </Button>
      </div>
    </Card>
  );
}

/** Placeholder with the same size and layout as a VendorCard. */
export function VendorCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-[var(--radius)] bg-card p-7 text-card-foreground shadow-soft flex flex-col gap-2">
      <Skeleton className="aspect-[16/9] w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-3/4" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-11 w-[5.5rem] rounded-full" />
      </div>
    </div>
  );
}
