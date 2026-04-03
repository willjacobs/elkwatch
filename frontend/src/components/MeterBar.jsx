function barColor(pct) {
  if (pct == null) return "var(--clr-accent)";
  if (pct >= 90) return "var(--clr-red)";
  if (pct >= 80) return "var(--clr-yellow)";
  return "var(--clr-accent)";
}

function valColor(pct) {
  if (pct == null) return "var(--clr-muted)";
  if (pct >= 90) return "var(--clr-red)";
  if (pct >= 80) return "var(--clr-yellow)";
  return "var(--clr-accent)";
}

export default function MeterBar({ pct, label, forceColor }) {
  const color = forceColor ?? barColor(pct);
  const textColor = forceColor ?? valColor(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: textColor }}>
          {pct != null ? `${pct}%` : "\u2014"}
        </span>
        {label && <span style={{ fontSize: "10px", color: "var(--clr-dim)" }}>{label}</span>}
      </div>
      <div style={{ height: "4px", background: "var(--clr-border)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "4px", width: `${Math.min(100, pct ?? 0)}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
