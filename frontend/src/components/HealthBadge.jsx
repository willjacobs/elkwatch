const STYLES = {
  green:   { background: "var(--clr-green-bg)",  color: "var(--clr-green)" },
  yellow:  { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" },
  red:     { background: "var(--clr-red-bg)",    color: "var(--clr-red)" },
  error:   { background: "var(--clr-red-bg)",    color: "var(--clr-red)" },
  warning: { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" },
  info:    { background: "var(--clr-accent-bg)", color: "var(--clr-accent)" },
  unknown: { background: "rgba(51,65,85,0.4)",   color: "var(--clr-dim)" },
};

const DOT_COLOR = {
  green: "var(--clr-green)", yellow: "var(--clr-yellow)", red: "var(--clr-red)",
  error: "var(--clr-red)",   warning: "var(--clr-yellow)", info: "var(--clr-accent)",
  unknown: "var(--clr-dim)",
};

export default function HealthBadge({ tone = "unknown", label, dot = true }) {
  const style = STYLES[tone] ?? STYLES.unknown;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 8px", borderRadius: "99px",
      fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
      ...style,
    }}>
      {dot && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: DOT_COLOR[tone], flexShrink: 0 }} />}
      {label ?? tone}
    </span>
  );
}
