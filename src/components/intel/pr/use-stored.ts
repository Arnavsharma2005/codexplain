"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
/** Used when localStorage throws (blocked storage), so choices still last until reload. */
const memory = new Map<string, string>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("hashchange", listener);
  };
}

function read(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return memory.get(key) ?? fallback;
  }
}

/** A string kept in localStorage, shared by every component that reads the same key. */
export function useStored(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        memory.set(key, next);
      }
      notify();
    },
    [key],
  );
  return [value, set];
}

/** The URL hash, re-read on every render and whenever it changes. */
export function useHash(): [string, (href: string) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const replace = useCallback((href: string) => {
    window.history.replaceState(window.history.state, "", href);
    notify();
  }, []);
  return [hash, replace];
}
