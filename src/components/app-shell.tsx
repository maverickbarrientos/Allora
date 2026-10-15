"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Profile } from "@/lib/api/types";
import { useLoad } from "@/lib/use-load";
import { AppHeader } from "@/components/app-header";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ProfileContext = createContext<Profile | null>(null);

/** The signed-in profile. Only available inside AppShell once it has loaded. */
export function useProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useProfile must be used inside AppShell");
  return profile;
}

/**
 * Header (wordmark, name, log out) and page container for signed-in pages.
 * Loads GET /api/me once; a 401 sends the user to /login.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, reload } = useLoad(() => api.me());
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (state.status === "error" && state.error.status === 401) router.replace("/login");
  }, [state, router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.replace("/login");
    }
  }

  const profile = state.status === "loaded" ? state.data.profile : null;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader>
        {profile && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">{profile.name}</span>
            <Button variant="outline" size="sm" onClick={logout} disabled={loggingOut}>
              {loggingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              Log out
            </Button>
          </>
        )}
      </AppHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 lg:py-24">
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
      </main>
    </div>
  );
}
