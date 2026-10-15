import type { OrderItem } from "@/lib/api/types";

/** Label for position i of n: "First", "Last", or the number in between. */
function positionLabel(i: number, n: number) {
  if (n === 1) return "First and last";
  if (i === 0) return "First";
  if (i === n - 1) return "Last";
  return String(i + 1);
}

/**
 * The assistant's suggested booking order. A real <ol> (with role="list" so
 * screen readers keep the list semantics with the bullets removed), and each
 * item says its position in words as well.
 */
export function OrderList({ items }: { items: OrderItem[] }) {
  return (
    <ol role="list" aria-label="Suggested order" className="flex flex-col divide-y divide-border border-y border-border">
      {items.map((item, i) => (
        <li key={`${item.category}-${i}`} className="flex gap-4 py-3">
          <span className="label w-24 shrink-0 pt-1">{positionLabel(i, items.length)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium capitalize [overflow-wrap:anywhere]">{item.category}</p>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.reason}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
