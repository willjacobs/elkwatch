import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { Link } from "react-router-dom";

function statusTone(status) {
  if (status === "green") return "green";
  if (status === "yellow") return "yellow";
  if (status === "red") return "red";
  return "unknown";
}

export default function Overview() {
  const { data, error, loading, refetch } = useClusters();

  if (loading) {
    return (
      <LoadingSpinner label={data ? "Refreshing clusters" : "Loading clusters"} />
    );
  }

  if (error) {
    return (
      <div>
        <p className="error">Failed to load clusters: {error}</p>
        <button type="button" className="btn btn-primary" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Cluster overview</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </header>
      <div className="page-grid page-grid--stack">
        {(data || []).map((c) => (
          <section
            key={c.name}
            className={`overview-pane${c.error ? " overview-pane--error" : ""}`}
            aria-label={`Cluster ${c.name}`}
          >
            <header className="overview-pane-header">
              <div className="overview-pane-title">
                <span
                  className={`overview-status-dot overview-status-dot--${statusTone(c.status)}`}
                  aria-hidden
                />
                <Link
                  className="overview-pane-title-link"
                  to={`/nodes?${new URLSearchParams({ cluster: c.name })}`}
                >
                  {c.name}
                </Link>
              </div>
              <div className="overview-pane-header-right">
                <span className={`overview-status-pill overview-status-pill--${statusTone(c.status)}`}>
                  {c.error ? "unreachable" : c.status}
                </span>
                <Link
                  className="overview-pane-action"
                  to={`/indices?${new URLSearchParams({ cluster: c.name })}`}
                >
                  View indices
                </Link>
              </div>
            </header>

            {c.error ? (
              <div className="overview-pane-body overview-pane-body--error">
                <div className="overview-error-row">
                  <span className="overview-error-icon" aria-hidden>
                    !
                  </span>
                  <div>
                    <div className="overview-error-title">Host could not be resolved</div>
                    <div className={c.errorTone === "muted" ? "muted" : "error"}>
                      {c.error}
                    </div>
                  </div>
                </div>
                <a
                  className="btn btn-secondary overview-error-cta"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  title="Edit config.yml to remove the cluster"
                >
                  How to remove from config ↗
                </a>
              </div>
            ) : (
              <>
                <div className="overview-pane-body">
                  <div className="overview-metric-tiles">
                    <div className="overview-metric-tile">
                      <div className="overview-metric-label">Nodes</div>
                      <div className="overview-metric-value">{c.numberOfNodes}</div>
                    </div>
                    <div className="overview-metric-tile">
                      <div className="overview-metric-label">Primary shards</div>
                      <div className="overview-metric-value">{c.activePrimaryShards}</div>
                    </div>
                    <div className="overview-metric-tile">
                      <div className="overview-metric-label">Relocating</div>
                      <div className="overview-metric-value">{c.relocatingShards}</div>
                    </div>
                  </div>

                  <div className="overview-bars">
                    {(() => {
                      const unassigned = c.unassignedShards ?? 0;
                      const totalPrimary =
                        (c.activePrimaryShards ?? 0) + (c.unassignedShards ?? 0);
                      const pct =
                        totalPrimary > 0
                          ? Math.round((unassigned / totalPrimary) * 100)
                          : 0;
                      return (
                        <div className="overview-bar">
                          <div className="overview-bar-row">
                            <span className="overview-bar-label">Unassigned shards</span>
                            <span className="overview-bar-value">
                              {unassigned} / {totalPrimary}
                            </span>
                          </div>
                          <div className="overview-progress">
                            <div
                              className="overview-progress-fill overview-progress-fill--warn"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {c.diskUsedPercent != null && (
                      <div className="overview-bar">
                        <div className="overview-bar-row">
                          <span className="overview-bar-label">Disk used</span>
                          <span className="overview-bar-value">{c.diskUsedPercent}%</span>
                        </div>
                        <div className="overview-progress">
                          <div
                            className="overview-progress-fill overview-progress-fill--disk"
                            style={{ width: `${Math.min(100, c.diskUsedPercent)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <footer className="overview-pane-footer">
                  <Link
                    className="overview-footer-link"
                    to={`/nodes?${new URLSearchParams({ cluster: c.name })}`}
                  >
                    Nodes
                  </Link>
                  <Link
                    className="overview-footer-link"
                    to={`/ilm?${new URLSearchParams({
                      cluster: c.name,
                      focus: "ilmErrors",
                    })}`}
                  >
                    ILM
                  </Link>
                  <Link
                    className="overview-footer-link"
                    to={`/alerts?${new URLSearchParams({ cluster: c.name })}`}
                  >
                    Alerts
                  </Link>
                  <Link
                    className="overview-footer-link overview-footer-link--quiet"
                    to={`/nodes?${new URLSearchParams({
                      cluster: c.name,
                      focus: "unassignedShards",
                    })}`}
                    title="Jump to nodes (focus: unassigned shards)"
                  >
                    Unassigned →
                  </Link>
                </footer>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
