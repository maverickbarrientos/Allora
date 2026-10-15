"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, toApiError } from "@/lib/api/client";

/**
 * TEMPORARY client-side guard. Remove it if redundant: the real backend
 * (middleware) already redirects logged-out page requests to /login and
 * signed-in requests for /login and /signup to /. This exists so those
 * redirects also work in mock mode, where no middleware sees the session.
 *
 * "protected": 401 from GET /api/me -> /login.
 * "guest": a valid session -> /.
 */
export function SessionGuard({
  mode,
  children,
}: {
  mode: "protected" | "guest";
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(() => {
        if (!cancelled && mode === "guest") router.replace("/");
      })
      .catch((e) => {
        if (!cancelled && mode === "protected" && toApiError(e).status === 401)
          router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  return <>{children}</>;
}
