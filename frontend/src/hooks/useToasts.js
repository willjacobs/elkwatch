import { useEffect, useMemo, useState } from "react";

const listeners = new Set();
let seq = 0;
const recent = new Map(); // message -> ts

function emit(next) {
  for (const fn of listeners) {
    try {
      fn(next);
    } catch {
      // ignore listener failure
    }
  }
}

export function pushToast({ title, message, tone = "error", ttlMs = 5000 }) {
  const msg = message || title || "";
  const now = Date.now();
  const last = recent.get(msg) || 0;
  if (msg && now - last < 2500) return;
  if (msg) recent.set(msg, now);

  const id = String(++seq);
  emit({
    type: "push",
    toast: { id, title, message, tone, createdAt: now, ttlMs },
  });
  return id;
}

export function dismissToast(id) {
  emit({ type: "dismiss", id });
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onEvent = (ev) => {
      if (ev.type === "push") {
        setToasts((prev) => [ev.toast, ...prev].slice(0, 4));
      } else if (ev.type === "dismiss") {
        setToasts((prev) => prev.filter((t) => t.id !== ev.id));
      }
    };
    listeners.add(onEvent);
    return () => listeners.delete(onEvent);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismissToast(t.id), t.ttlMs ?? 5000)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts]);

  return useMemo(
    () => ({
      toasts,
      dismiss: dismissToast,
    }),
    [toasts]
  );
}

