"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Profile } from "@/lib/api/types";
import { useLoad } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { SidebarContent } from "@/components/sidebar";
import { useLatestOnly, useRefreshOnMessages } from "@/lib/use-live-messages";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const ProfileContext = createContext<Profile | null>(null);

/** The signed-in profile. Only available inside AppShell once it has loaded. */
export function useProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useProfile must be used inside AppShell");
  return profile;
}

/**
 * Keeps the sidebar's unread total current. Renders nothing; it only exists once the
 * profile is known, so a logged-out page never asks for messages.
 * shortcut: sums the inbox list; a count-only endpoint is lighter when inboxes grow.
 */
function UnreadTracker({ onTotal }: { onTotal: (total: number) => void }) {
  const latestOnly = useLatestOnly();
  const refresh = () =>
    latestOnly(api.listConversations(), ({ conversations }) =>
      onTotal(conversations.reduce((sum, c) => sum + c.unread, 0)),
    );
  useRefreshOnMessages(refresh);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the profile arrives
  }, []);
  return null;
}

/**
 * Signed-in shell: fixed sidebar from 1024px, a drawer below it, and the
 * page container. Loads GET /api/me once; a 401 sends the user to /login.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, reload } = useLoad(() => api.me());
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (state.status === "error" && state.error.status === 401) router.replace("/login");
  }, [state, router]);

  // The drawer only exists below 1024px; close it if the window grows past that.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setDrawerOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.replace("/login");
    }
  }

  const profile = state.status === "loaded" ? state.data.profile : null;
  const sidebarProps = {
    profile,
    loading: state.status === "loading",
    loggingOut,
    onLogout: logout,
    unreadMessages,
  };

  return (
    // `relative` makes this the containing block for absolutely positioned
    // descendants (e.g. sr-only labels), so overflow-hidden clips them too.
    // Without it they escape the clip and scroll the whole window once main
    // is scrolled to the bottom.
    // print: only the page content is printed (the booking documents use this).
    <div className="relative flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden print:block print:h-auto print:min-h-0 print:overflow-visible">
      {profile && <UnreadTracker onTotal={setUnreadMessages} />}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-stone lg:block print:hidden">
        <SidebarContent {...sidebarProps} />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-stone px-2 lg:hidden print:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent aria-describedby={undefined}>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarContent {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-display text-2xl">Allora</span>
      </div>

      <main className="min-w-0 flex-1 lg:overflow-y-auto print:overflow-visible">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16 print:max-w-none print:p-0">
          {state.status === "loading" && (
            <div role="status" aria-label="Loading" className="flex flex-col gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-3/4 max-w-md" />
              <Skeleton className="h-5 w-1/2 max-w-xs" />
            </div>
          )}
          {state.status === "error" && state.error.status !== 401 && (
            <ErrorState
              error={state.error}
              onRetry={reload}
              message="Couldn't load your account. Please try again."
            />
          )}
          {profile && <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>}
        </div>
      </main>
    </div>
  );
}
