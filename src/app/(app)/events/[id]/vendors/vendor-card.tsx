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
};
const captionFor = (category: string) => CAPTIONS[category] ?? "Table setting, natural light";

/**
 * Compact vendor card: image, category label, one-line name, then price and
 * the Book button. The lift on hover comes from Card (pointer devices only).
 */
export function VendorCard({
  vendor,
  booked,
  booking,
  onBook,
}: {
  vendor: Vendor;
  booked: boolean;
  booking: boolean;
  onBook: () => void;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col gap-2">
      <ImagePlaceholder caption={captionFor(vendor.category)} aspect="16 / 9" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="label">{vendor.category}</p>
        <h2 className="truncate font-display text-h2" title={vendor.name}>
          {vendor.name}
        </h2>
      </div>
      <div className="mt-auto flex items-center justify-between gap-4">
        <span>{formatNumber(vendor.price)}</span>
        <Button
          className="min-w-[5.5rem]"
          variant={booked ? "outline" : "default"}
          disabled={booked || booking}
          onClick={onBook}
          aria-label={booked ? `${vendor.name}, booked` : `Book ${vendor.name}`}
        >
          {booked ? "Booked" : booking ? "Booking…" : "Book"}
        </Button>
      </div>
    </Card>
  );
}

/** Placeholder with the same size and layout as a VendorCard. */
export function VendorCardSkeleton() {
  return (
    <div aria-hidden="true" className="surface-plum flex flex-col gap-2">
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
