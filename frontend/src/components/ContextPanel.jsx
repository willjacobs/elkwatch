import { useLocation } from "react-router-dom";

const THEME_ICONS = { dark: "\u{1F319}", light: "\u2600\uFE0F", charcoal: "\u2B24" };
const THEMES = ["dark", "light", "charcoal"];

function statusDotClass(status) {
  if (status === "green") return "status-dot--green";
  if (status === "yellow") return "status-dot--yellow";
  if (status === "red" || !status) return "status-dot--red";
  return "status-dot--unknown";
}

function badgeClass(status) {
  if (status === "green") return "ctx-nav-badge--green";
  if (status === "yellow") return "ctx-nav-badge--yellow";
  return "ctx-nav-badge--red";
}

export default function ContextPanel({
  visible,
  clusters,
  activeCluster,
  onClusterChange,
  theme,
  onThemeChange,
  refreshIntervalMs,
  onRefreshChange,
  appVersion,
}) {
  const location = useLocation();
  const isOverview = location.pathname === "/";
  const activeRow = (clusters || []).find((c) => c.name === activeCluster);

  const nextTheme = () => {
    const idx = THEMES.indexOf(theme);
    onThemeChange(THEMES[(idx + 1) % THEMES.length]);
  };

  return (
    <aside className={`ctx-panel${visible ? "" : " hidden"}`} aria-label="Context panel">
      {isOverview ? (
        <>
          <div className="ctx-section-label">Clusters</div>
          {(clusters || []).map((c) => (
            <div
              key={c.name}
              className={`ctx-nav-item${c.name === activeCluster ? " active" : ""}`}
              onClick={() => onClusterChange(c.name)}
            >
              <span className={`status-dot ${statusDotClass(c.error ? "red" : c.status)}`} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
              <span className={`ctx-nav-badge ${badgeClass(c.error ? "red" : c.status)}`}>
                {c.error ? "err" : c.status}
              </span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="ctx-section-label">Active Cluster</div>
          {activeRow && (
            <div className="ctx-cluster-card">
              <div className="ctx-cluster-name">
                <span className={`status-dot ${statusDotClass(activeRow.error ? "red" : activeRow.status)}`} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeRow.name}
                </span>
              </div>
              <div className="ctx-cluster-meta">elasticsearch</div>
              {!activeRow.error && (
                <div className="ctx-cluster-kpis">
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val">{activeRow.numberOfNodes ?? "\u2014"}</div>
                    <div className="ctx-cluster-kpi-label">nodes</div>
                  </div>
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val">{activeRow.activePrimaryShards ?? "\u2014"}</div>
                    <div className="ctx-cluster-kpi-label">shards</div>
                  </div>
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val" style={{ color: `var(--clr-${activeRow.status === "green" ? "green" : activeRow.status === "yellow" ? "yellow" : "red"})` }}>{"\u25CF"}</div>
                    <div className="ctx-cluster-kpi-label">status</div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="ctx-section-label">Switch Cluster</div>
          {(clusters || []).map((c) => (
            <div
              key={c.name}
              className={`ctx-nav-item${c.name === activeCluster ? " active" : ""}`}
              onClick={() => onClusterChange(c.name)}
            >
              <span className={`status-dot ${statusDotClass(c.error ? "red" : c.status)}`} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="ctx-spacer" />

      <div className="ctx-footer">
        <div className="ctx-footer-row">
          Auto-refresh
          <select value={refreshIntervalMs} onChange={(e) => onRefreshChange(Number(e.target.value))}>
            <option value={0}>Off</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
        </div>
        <div className="ctx-footer-row">
          Theme
          <button className="ctx-theme-btn" onClick={nextTheme} title={`Current: ${theme} \u2014 click to cycle`}>
            {THEME_ICONS[theme] ?? "\u25D0"}
          </button>
        </div>
        {appVersion && <div className="ctx-version">v{appVersion}</div>}
      </div>
    </aside>
  );
}
