import { useCallback, useEffect, useMemo, useState } from "react";
import ClusterDonut from "../components/ClusterDonut.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { formatBytes } from "../utils/format.js";
import "./nodes.css";
import { Link, useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

function parsePublishAddress(addr) {
  if (addr == null || addr === "") return { host: "—", port: "" };
  const s = String(addr);
  const lastColon = s.lastIndexOf(":");
  if (lastColon < 0) return { host: s, port: "" };
  const after = s.slice(lastColon + 1);
  if (/^\d+$/.test(after)) {
    return { host: s.slice(0, lastColon), port: `:${after}` };
  }
  return { host: s, port: "" };
}

function diskBarClass(pct) {
  if (pct == null) return "nodes-meter-fill nodes-meter-fill--disk";
  if (pct >= 90) return "nodes-meter-fill nodes-meter-fill--disk-bad";
  if (pct >= 80) return "nodes-meter-fill nodes-meter-fill--disk-warn";
  return "nodes-meter-fill nodes-meter-fill--disk";
}

function heapBarClass(pct) {
  if (pct == null) return "nodes-meter-fill nodes-meter-fill--heap";
  if (pct >= 90) return "nodes-meter-fill nodes-meter-fill--heap-bad";
  if (pct >= 80) return "nodes-meter-fill nodes-meter-fill--heap-warn";
  return "nodes-meter-fill nodes-meter-fill--heap";
}

function rolesLabel(roles) {
  if (!roles?.length) return "—";
  return roles.join(", ");
}

function statusLabel(status) {
  if (!status) return "unknown";
  if (status === "green") return "healthy";
  if (status === "yellow") return "degraded";
  if (status === "red") return "error";
  return String(status);
}

export default function Nodes() {
  const { data: clusters, loading: clustersLoading, error: clustersError } =
    useClusters();
  const names = useMemo(
    () => (clusters || []).map((c) => c.name),
    [clusters]
  );
  const [clusterName, setClusterName] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster");
  const focus = searchParams.get("focus");

  useEffect(() => {
    if (!names.length) return;

    const key = "elkwatch.cluster.nodes";
    let remembered = "";
    try {
      remembered = window.localStorage.getItem(key) || "";
    } catch {
      remembered = "";
    }
    let active = "";
    try {
      active = window.localStorage.getItem(ACTIVE_CLUSTER_KEY) || "";
    } catch {
      active = "";
    }

    const pick =
      (urlCluster && names.includes(urlCluster) && urlCluster) ||
      (remembered && names.includes(remembered) && remembered) ||
      (active && names.includes(active) && active) ||
      names[0];

    if (!clusterName || clusterName !== pick) {
      setClusterName(pick);
    }
  }, [names, clusterName, urlCluster]);

  useEffect(() => {
    if (!clusterName) return;
    persistPageCluster("nodes", clusterName);
  }, [clusterName]);

  const load = useCallback(async () => {
    if (!clusterName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(clusterName)}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Nodes failed", message: e.message, tone: "error" });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clusterName]);

  useEffect(() => {
    load();
  }, [load]);

  useRegisterGlobalRefresh(() => {
    load();
  });

  const summary = data?.summary;
  const healthClass =
    summary?.status === "green"
      ? "health-green"
      : summary?.status === "yellow"
        ? "health-yellow"
        : summary?.status === "red"
          ? "health-red"
          : "health-yellow";

  const nodeCount = summary?.numberOfNodes ?? 0;
  const nodeCountLabel =
    nodeCount === 1 ? "1 node" : `${nodeCount} nodes`;

  const nodesList = useMemo(() => {
    const list = data?.nodes || [];
    if (focus === "unassignedShards") {
      return [...list].sort(
        (a, b) => (b.diskUsedPercent ?? -1) - (a.diskUsedPercent ?? -1)
      );
    }
    return list;
  }, [data, focus]);

  const nodeRows = useMemo(() => {
    const list = nodesList || [];
    return list.map((n) => {
      const addr = n.httpPublishAddress || n.host || n.ip || "";
      const { host, port } = parsePublishAddress(addr);
      return {
        ...n,
        hostLabel: host,
        portLabel: port,
      };
    });
  }, [nodesList]);

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  return (
    <div className="nodes-page">
      <header className="page-header">
        <h1 className="page-title">Nodes</h1>
      </header>

      <div className="nodes-subtitle">
        {clusterName ? (
          <>
            <span className="nodes-subtitle-main">{clusterName}</span>
            <span className="nodes-subtitle-sep">·</span>
            <span className="nodes-subtitle-muted">last updated just now</span>
          </>
        ) : null}
      </div>

      <div className="toolbar nodes-toolbar">
        <div className="nodes-toolbar-left">
          <div className="cluster-select">
            <label htmlFor="nodes-cluster">Cluster</label>
            <select
              id="nodes-cluster"
              className="select-elk"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn btn-primary" onClick={() => load()}>
              Refresh
            </button>
          </div>
        </div>
        {summary && (
          <div className="nodes-toolbar-status">
            <span className={`nodes-health-dot ${healthClass}`} />
            <span className="nodes-toolbar-status-text">
              Cluster status{" "}
              <span className={`nodes-status-word ${healthClass}`}>
                {summary.status}
              </span>{" "}
              <span className="nodes-status-sub">{statusLabel(summary.status)}</span>
            </span>
          </div>
        )}
      </div>

      {loading && <LoadingSpinner compact label="Loading nodes" />}
      {error && <p className="error">{error}</p>}

      {data && !loading && !error && (
        <>
          <section className="nodes-kpis" aria-label="Cluster summary">
            <div className="nodes-kpi">
              <div className="nodes-kpi-label">Nodes</div>
              <div className="nodes-kpi-value">{summary?.numberOfNodes ?? "—"}</div>
              <div className="nodes-kpi-sub"> {nodeCount === 1 ? "1 master" : ""}</div>
            </div>
            <div className="nodes-kpi">
              <div className="nodes-kpi-label">Active shards</div>
              <div className="nodes-kpi-value">{summary?.activeShards ?? "—"}</div>
              <div className="nodes-kpi-sub">
                of{" "}
                {summary?.activeShards != null && summary?.unassignedShards != null
                  ? summary.activeShards + summary.unassignedShards
                  : "—"}{" "}
                total
              </div>
            </div>
            <div className="nodes-kpi nodes-kpi--warn">
              <div className="nodes-kpi-label">Unassigned</div>
              <div className="nodes-kpi-value">
                {summary?.unassignedShards ?? "—"}
              </div>
              <div className="nodes-kpi-sub">replica shards</div>
            </div>
            <div className="nodes-kpi">
              <div className="nodes-kpi-label">Cluster status</div>
              <div className={`nodes-kpi-value nodes-kpi-status ${healthClass}`}>
                {summary?.status ?? "—"}
              </div>
              <div className="nodes-kpi-sub">{statusLabel(summary?.status)}</div>
            </div>
          </section>

          <section className="nodes-grid" aria-label="Cluster details">
            <div className="card nodes-panel">
              <div className="nodes-panel-header">
                <div className="nodes-panel-title">Shard distribution</div>
                <Link
                  to={`/indices?cluster=${encodeURIComponent(clusterName)}`}
                  className="nodes-panel-link"
                >
                  View indices
                </Link>
              </div>
              <div className="nodes-shards-wrap">
                <ClusterDonut
                  variant="shards"
                  summary={summary}
                  formatBytes={formatBytes}
                  compact
                />
              </div>
            </div>

            <div className="card nodes-panel">
              <div className="nodes-panel-header">
                <div className="nodes-panel-title">Disk</div>
              </div>
              <div className="nodes-panel-body">
                <div className="nodes-panel-donut">
                  <ClusterDonut
                    variant="disk"
                    summary={summary}
                    formatBytes={formatBytes}
                    compact
                  />
                </div>
                <div className="nodes-panel-metrics">
                  <div className="nodes-mini-row">
                    <div className="nodes-mini-swatch nodes-mini-swatch--disk" />
                    <div className="nodes-mini-label">Used</div>
                    <div className="nodes-mini-value">
                      {formatBytes(summary?.diskUsedBytes)}
                    </div>
                  </div>
                  <div className="nodes-mini-row">
                    <div className="nodes-mini-swatch nodes-mini-swatch--muted" />
                    <div className="nodes-mini-label">Free</div>
                    <div className="nodes-mini-value">
                      {formatBytes(summary?.diskFreeBytes)}
                    </div>
                  </div>
                  <div className="nodes-mini-divider" />
                  <div className="nodes-mini-row">
                    <div className="nodes-mini-swatch nodes-mini-swatch--heap" />
                    <div className="nodes-mini-label">Heap</div>
                    <div className="nodes-mini-value">
                      {summary?.heapUsedPercent != null
                        ? `${summary.heapUsedPercent}%`
                        : "—"}
                    </div>
                  </div>
                  <div className="nodes-mini-sub">
                    {summary?.heapUsedBytes != null && summary?.heapMaxBytes != null
                      ? `${formatBytes(summary.heapUsedBytes)} / ${formatBytes(summary.heapMaxBytes)}`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card nodes-table" aria-label="Node list">
            <div className="nodes-panel-header">
              <div className="nodes-panel-title">Node list</div>
              <div className="nodes-panel-muted">{nodeCountLabel}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Host</th>
                    <th>Disk used</th>
                    <th>Heap</th>
                    <th>Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {nodeRows.map((n) => {
                    const diskPct = n.diskUsedPercent;
                    const heapPct = n.heapUsedPercent;
                    return (
                      <tr key={n.nodeId}>
                        <td className="nodes-td-strong">{n.name}</td>
                        <td className="nodes-td-mono">
                          {n.hostLabel}
                          {n.portLabel ? (
                            <span className="nodes-td-muted">{n.portLabel}</span>
                          ) : null}
                        </td>
                        <td>
                          <div className="nodes-td-stack">
                            <div className="nodes-td-accent">
                              {diskPct != null ? `${diskPct}%` : "—"}
                            </div>
                            <div className="nodes-meter">
                              <div
                                className={diskBarClass(diskPct)}
                                style={{
                                  width:
                                    diskPct != null
                                      ? `${Math.min(100, diskPct)}%`
                                      : "0%",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="nodes-td-stack">
                            <div className="nodes-td-accent nodes-td-accent--heap">
                              {heapPct != null ? `${heapPct}%` : "—"}
                            </div>
                            <div className="nodes-meter">
                              <div
                                className={heapBarClass(heapPct)}
                                style={{
                                  width:
                                    heapPct != null
                                      ? `${Math.min(100, heapPct)}%`
                                      : "0%",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="nodes-td-muted" title={rolesLabel(n.roles)}>
                          {rolesLabel(n.roles)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
