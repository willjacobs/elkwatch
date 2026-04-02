import LoadingSpinner from "../components/LoadingSpinner.jsx";
import MeterBar from "../components/MeterBar.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { Link } from "react-router-dom";

function statusBorderColor(status, hasError) {
  if (hasError) return "var(--clr-red)";
  if (status === "green")  return "var(--clr-green)";
  if (status === "yellow") return "var(--clr-yellow)";
  if (status === "red")    return "var(--clr-red)";
  return "var(--clr-dim)";
}

function badgeStyle(status, hasError) {
  if (hasError || status === "red")    return { background: "var(--clr-red-bg)",    color: "var(--clr-red)" };
  if (status === "yellow") return { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" };
  if (status === "green")  return { background: "var(--clr-green-bg)",  color: "var(--clr-green)" };
  return { background: "rgba(51,65,85,0.4)", color: "var(--clr-dim)" };
}

export default function Overview() {
  const { data, error, loading, refetch } = useClusters();

  if (loading && !data) return <LoadingSpinner label="Loading clusters" />;

  if (error) {
    return (
      <div>
        <p className="error">Failed to load clusters: {error}</p>
        <button type="button" className="btn btn-primary" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Overview</h1>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => refetch()}><span style={{ fontSize: "16px" }}>↻</span> Refresh</button>
      </div>

      <div className="cluster-grid">
        {(data || []).map((c) => {
          const borderColor = statusBorderColor(c.status, !!c.error);
          const badge = badgeStyle(c.status, !!c.error);
          return (
            <div key={c.name} className="card" style={{ borderTop: `2px solid ${borderColor}` }}>
              {/* Header */}
              <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px", color: "var(--clr-text)" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: borderColor, flexShrink: 0 }} />
                  <Link to={`/nodes?cluster=${encodeURIComponent(c.name)}`} style={{ color: "var(--clr-text)", textDecoration: "none" }}>
                    {c.name}
                  </Link>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", textTransform: "uppercase", letterSpacing: "0.05em", ...badge }}>
                  {c.error ? "unreachable" : c.status}
                </span>
              </div>

              {c.error ? (
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--clr-red-bg)", color: "var(--clr-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>!</div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--clr-red)" }}>Host could not be resolved</div>
                    <div style={{ fontSize: "11px", color: "var(--clr-muted2)", marginTop: "3px" }}>{c.error}</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* KPI row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "var(--clr-border)", borderTop: "1px solid var(--clr-border)", borderBottom: "1px solid var(--clr-border)" }}>
                    {[
                      { label: "Nodes",      value: c.numberOfNodes },
                      { label: "Pri Shards", value: c.activePrimaryShards },
                      { label: "Unassigned", value: c.unassignedShards, warn: c.unassignedShards > 0 },
                    ].map(({ label, value, warn }) => (
                      <div key={label} style={{ background: "var(--clr-surface)", padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: warn ? "var(--clr-yellow)" : "var(--clr-text)", lineHeight: 1 }}>{value ?? "—"}</div>
                        <div style={{ fontSize: "10px", color: "var(--clr-dim)", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Utilisation bars */}
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {c.diskUsedPercent != null && (
                      <MeterBar pct={c.diskUsedPercent} label="Disk" />
                    )}
                    {(() => {
                      const total = (c.activePrimaryShards ?? 0) + (c.unassignedShards ?? 0);
                      const pct = total > 0 ? Math.round((c.unassignedShards / total) * 100) : 0;
                      return pct > 0 ? <MeterBar pct={pct} label="Unassigned shards" forceColor="var(--clr-yellow)" /> : null;
                    })()}
                  </div>
                </>
              )}

              {/* Footer links */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--clr-border)", display: "flex", gap: "4px" }}>
                {[
                  { label: "Nodes",   to: `/nodes?cluster=${encodeURIComponent(c.name)}` },
                  { label: "Indices", to: `/indices?cluster=${encodeURIComponent(c.name)}` },
                  { label: "ILM",     to: `/ilm?cluster=${encodeURIComponent(c.name)}` },
                  { label: "Alerts",  to: `/alerts?cluster=${encodeURIComponent(c.name)}` },
                ].map(({ label, to }) => (
                  <Link key={label} to={to} style={{ fontSize: "11px", color: "var(--clr-muted2)", padding: "3px 8px", borderRadius: "4px", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--clr-surface-hi)"; e.currentTarget.style.color = "var(--clr-accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--clr-muted2)"; }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
