"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { capitalize } from "@/lib/format";

export const TABPANEL_ID = "vendor-tabpanel";
export const tabId = (c: string | null) => `vendor-tab-${c ?? "all"}`;

/**
 * Category tabs for the vendors page. Plain label-style text with one sliding
 * rose underline on the active tab. Arrow keys, Home and End move between
 * tabs (roving tabindex). The row scrolls sideways on mobile with the
 * scrollbar hidden, keeps the active tab in view, and sticks to the top.
 * `null` is the "All" tab.
 */
export function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string | null;
  onChange: (category: string | null) => void;
}) {
  const tabs: (string | null)[] = [null, ...categories];
  const row = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  // Place the underline under the active tab and scroll that tab into view
  // (sideways only, so the page itself never jumps).
  useLayoutEffect(() => {
    const el = refs.current.get(tabId(active));
    const container = row.current;
    if (!el || !container) return;
    const place = () => setBar({ left: el.offsetLeft, width: el.offsetWidth });
    place();
    const left = el.offsetLeft; // the tablist is the offset parent
    const right = left + el.offsetWidth;
    if (left < container.scrollLeft) container.scrollLeft = left - 16;
    else if (right > container.scrollLeft + container.clientWidth)
      container.scrollLeft = right - container.clientWidth + 16;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, categories.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.indexOf(active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]);
    refs.current.get(tabId(tabs[next]))?.focus();
  }

  return (
    // The fixed page gradient is repeated on the sticky row so it blends into the page.
    <div className="sticky top-0 z-10 -mx-4 bg-[image:var(--page-gradient)] bg-fixed px-4 sm:static sm:mx-0 sm:bg-none sm:px-0">
      <div
        ref={row}
        role="tablist"
        aria-label="Vendor category"
        onKeyDown={onKeyDown}
        className="relative flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((c) => {
          const selected = c === active;
          return (
            <button
              key={tabId(c)}
              ref={(el) => {
                if (el) refs.current.set(tabId(c), el);
                else refs.current.delete(tabId(c));
              }}
              id={tabId(c)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={TABPANEL_ID}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(c)}
              className="label min-h-11 shrink-0 whitespace-nowrap px-1"
            >
              {c ? capitalize(c) : "All"}
            </button>
          );
        })}
        {bar && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-brass transition-[transform,width] duration-200 ease-out"
            style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
          />
        )}
      </div>
    </div>
  );
}
