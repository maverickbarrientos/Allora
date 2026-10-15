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

/** useLoad that quietly refetches (no loading state) whenever messages or read marks change. */
export function useLiveLoad<T>(fn: () => Promise<T>) {
  const { state, setState, reload } = useLoad(fn);
  useRefreshOnMessages(() => {
    fn()
      .then((data) => setState({ status: "loaded", data }))
      .catch(() => {});
  });
  return { state, reload };
}
