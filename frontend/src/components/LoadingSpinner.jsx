/**
 * Midnight Ember orbital spinner (from octopus-tangle / midnight-orbital-spinner).
 */
export default function LoadingSpinner({
  label = "Loading",
  compact = false,
}) {
  return (
    <div
      className={`loading-block${compact ? " loading-block--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`loading-orbital${compact ? " loading-orbital--compact" : ""}`}
        aria-hidden
      >
        <div className="orbital-ring orbital-ring-1" />
        <div className="orbital-ring orbital-ring-2" />
        <div className="orbital-ring orbital-ring-3" />
        <div className="orbital-ring orbital-ring-4" />
        <div className="orbital-core" />
        <div className="orbital-trail-dot orbital-td1" />
        <div className="orbital-trail-dot orbital-td2" />
      </div>
      <p className="loading-block-text">
        {label}
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
    </div>
  );
}
