"use client";

import { useEffect, useRef } from "react";
import { useLoad } from "@/lib/use-load";
import { useMessageInserts } from "@/lib/use-message-inserts";

const MESSAGES_READ = "allora:messages-read";

/** Tell this page's other parts (sidebar, lists) that a conversation was just marked read. */
export const announceMessagesRead = () => window.dispatchEvent(new Event(MESSAGES_READ));

/**
 * Runs `refresh` when a message arrives for me, when listening (re)starts, and
 * when a conversation is marked read here.
 * shortcut: reads in another browser tab aren't seen until the next message or reload.
 */
export function useRefreshOnMessages(refresh: () => void) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useMessageInserts(null, () => latest.current(), () => latest.current());
  useEffect(() => {
    const onRead = () => latest.current();
    window.addEventListener(MESSAGES_READ, onRead);
    return () => window.removeEventListener(MESSAGES_READ, onRead);
  }, []);
}

/**
 * Wraps a refetch so only the latest one's result is used: several can be in
 * flight at once, and an older one finishing last must not overwrite a newer one.
 */
export function useLatestOnly() {
  const latest = useRef(0);
  return <T>(request: Promise<T>, apply: (value: T) => void) => {
    const mine = ++latest.current;
    request.then((value) => mine === latest.current && apply(value)).catch(() => {});
  };
}

/**
 * useLoad that quietly refetches (no loading state) whenever messages or read marks change.
 * shortcut: the very first load isn't covered by the latest-only rule; it would need useLoad to change.
 */
export function useLiveLoad<T>(fn: () => Promise<T>) {
  const { state, setState, reload } = useLoad(fn);
  const latestOnly = useLatestOnly();
  useRefreshOnMessages(() => latestOnly(fn(), (data) => setState({ status: "loaded", data })));
  return { state, reload };
}
