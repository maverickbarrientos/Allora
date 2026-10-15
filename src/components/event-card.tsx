import Link from "next/link";
import type { Event, EventType } from "@/lib/api/types";
import { capitalize, formatDateShort, formatNumber } from "@/lib/format";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Card } from "@/components/ui/card";

const CAPTIONS: Record<EventType, string> = {
  wedding: "Long table, candlelight",
  birthday: "Table setting, natural light",
  corporate: "Venue interior, morning light",
};

/** Compact event card: image, type, then date, budget and guests in one row between hairlines. */
export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="flex h-full flex-col gap-2">
        <ImagePlaceholder caption={CAPTIONS[event.type]} aspect="16 / 9" />
        <h2 className="font-display text-h2">{capitalize(event.type)}</h2>
        <dl className="grid grid-cols-[1.4fr_1fr_0.8fr] divide-x divide-border border-t border-border pt-2 text-sm">
          <Stat label="Date" value={formatDateShort(event.date)} first />
          <Stat label="Budget" value={formatNumber(event.budget)} />
          <Stat label="Guests" value={formatNumber(event.guestCount)} />
        </dl>
      </Card>
    </Link>
  );
}

function Stat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={first ? "min-w-0 pr-2" : "min-w-0 px-2"}>
      <dt className="label">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
