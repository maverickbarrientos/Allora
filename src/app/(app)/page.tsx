"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { Profile } from "@/lib/api/types";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type State =
  | { status: "loading" }
  | { status: "loaded"; profile: Profile }
  | { status: "error" };

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(() => {
    api
      .me()
      .then(({ profile }) => setState({ status: "loaded", profile }))
      .catch((e) => {
        if (toApiError(e).status === 401) router.replace("/login");
        else setState({ status: "error" });
      });
  }, [router]);

  useEffect(load, [load]);

  function retry() {
    setState({ status: "loading" });
    load();
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader>
        {state.status === "loaded" && (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {state.profile.name}
            </span>
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
        {state.status === "error" && (
          <div className="flex max-w-md flex-col items-start gap-4">
            <Alert variant="destructive">Couldn&apos;t load your account. Please try again.</Alert>
            <Button variant="outline" onClick={retry}>
              Retry
            </Button>
          </div>
        )}
        {state.status === "loaded" && (
          <Reveal>
            <PageHeader
              label="Your account"
              title={`Hi, ${state.profile.name}`}
              description={
                <>
                  Signed in as a{" "}
                  <span className="font-medium text-foreground">{state.profile.role}</span>.
                </>
              }
            />
          </Reveal>
        )}
      </main>
    </div>
  );
}
