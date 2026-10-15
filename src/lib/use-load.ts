"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, toApiError } from "@/lib/api/client";

export type Load<T> =
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "error"; error: ApiError };

/** Runs `fn` on mount and whenever `reload` is called. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [run, setRun] = useState(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    fnRef
      .current()
      .then((data) => !cancelled && setState({ status: "loaded", data }))
      .catch((e) => !cancelled && setState({ status: "error", error: toApiError(e) }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setRun((n) => n + 1);
  }, []);

  return { state, setState, reload };
}
