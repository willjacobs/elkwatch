import { useEffect, useMemo } from "react";

const listeners = new Set();

function emitGlobalRefresh(reason) {
  for (const fn of listeners) {
    try {
      fn(reason);
    } catch {
      // ignore individual listener failures
    }
  }
}

export function useRegisterGlobalRefresh(handler) {
  useEffect(() => {
    if (typeof handler !== "function") return;
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [handler]);
}

export function useGlobalRefreshController() {
  return useMemo(
    () => ({
      refreshNow: () => emitGlobalRefresh("manual"),
      refreshAuto: () => emitGlobalRefresh("auto"),
    }),
    []
  );
}

