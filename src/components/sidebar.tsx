"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, ClipboardList, Loader2, Ticket } from "lucide-react";
import type { Profile } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Route prefixes that also highlight this item (the longest match wins). */
  prefixes: string[];
};

// Only pages that exist on main.
const NAV: Record<Profile["role"], NavItem[]> = {
  customer: [
    { href: "/", label: "My events", icon: Ticket, prefixes: ["/events"] },
    { href: "/events/new", label: "New event", icon: CalendarPlus, prefixes: ["/events/new"] },
  ],
  vendor: [{ href: "/vendor", label: "Bookings", icon: ClipboardList, prefixes: ["/vendor"] }],
};

function matchLength(item: NavItem, pathname: string): number {
  let best = item.href === "/" && pathname === "/" ? 1 : -1;
  for (const p of [item.href === "/" ? "" : item.href, ...item.prefixes]) {
    if (p && (pathname === p || pathname.startsWith(p + "/"))) best = Math.max(best, p.length);
  }
  return best;
}

/** The nav item to mark active: the longest matching route prefix. */
function activeHref(items: NavItem[], pathname: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const item of items) {
    const len = matchLength(item, pathname);
    if (len > 0 && (!best || len > best.len)) best = { href: item.href, len };
  }
  return best?.href ?? null;
}

/**
 * Sidebar body, shared by the desktop sidebar and the mobile drawer:
 * wordmark, role nav (skeleton items while loading), user and log out.
 */
export function SidebarContent({
  profile,
  loading,
  loggingOut,
  onLogout,
  onNavigate,
}: {
  profile: Profile | null;
  loading: boolean;
  loggingOut: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = profile ? NAV[profile.role] : [];
  const active = activeHref(items, pathname);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pb-4 pt-6">
        <span className="font-display text-2xl">Allora</span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <div role="status" aria-label="Loading navigation" className="flex flex-col gap-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive = item.href === active;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-r-xl border-l-2 px-4 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-foreground hover:bg-foreground/10",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {profile && (
        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-medium" title={profile.name}>
              {profile.name}
            </p>
            <p className="label mt-1">{profile.role}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} disabled={loggingOut}>
            {loggingOut && <Loader2 className="h-4 w-4 animate-spin" />}
            Log out
          </Button>
        </div>
      )}
    </div>
  );
}
