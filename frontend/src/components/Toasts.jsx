import { useToasts } from "../hooks/useToasts.js";

export default function Toasts() {
  const { toasts } = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toasts-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone ?? "info"}`} role="alert">
          {t.title && <div className="toast-title">{t.title}</div>}
          {t.message && <div className="toast-msg">{t.message}</div>}
        </div>
      ))}
    </div>
  );
}
