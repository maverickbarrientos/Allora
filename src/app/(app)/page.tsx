"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { Profile } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Card>
        {state.status === "loading" && (
          <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </CardContent>
        )}
        {state.status === "error" && (
          <CardContent className="flex flex-col gap-4 p-6">
            <Alert variant="destructive">Couldn&apos;t load your account. Please try again.</Alert>
            <Button variant="outline" onClick={retry}>
              Retry
            </Button>
          </CardContent>
        )}
        {state.status === "loaded" && (
          <>
            <CardHeader>
              <CardTitle>Hi, {state.profile.name}</CardTitle>
              <CardDescription>
                Signed in as a <span className="font-medium">{state.profile.role}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={logout} disabled={loggingOut}>
                {loggingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                Log out
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
