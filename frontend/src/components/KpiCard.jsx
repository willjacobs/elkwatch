const TONE_STYLES = {
  default: { color: "var(--clr-text)" },
  green:   { color: "var(--clr-green)" },
  blue:    { color: "var(--clr-accent)" },
  yellow:  { color: "var(--clr-yellow)" },
  red:     { color: "var(--clr-red)" },
  purple:  { color: "var(--clr-purple)" },
};

export default function KpiCard({ label, value, sub, tone = "default" }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--clr-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1, ...TONE_STYLES[tone] }}>
        {value ?? "\u2014"}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--clr-muted2)", marginTop: "5px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
