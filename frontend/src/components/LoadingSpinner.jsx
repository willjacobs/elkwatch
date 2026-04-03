export default function LoadingSpinner({ label, compact }) {
  return (
    <div className={`loading-wrap${compact ? " compact" : ""}`} role="status" aria-label={label ?? "Loading"}>
      <div className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}
