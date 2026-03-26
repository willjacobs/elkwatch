import { useCallback, useEffect, useMemo, useState } from "react";
import ClusterDonut from "../components/ClusterDonut.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { formatBytes } from "../utils/format.js";
import "./nodes.css";
import { useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";

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

    const pick =
      (urlCluster && names.includes(urlCluster) && urlCluster) ||
      (remembered && names.includes(remembered) && remembered) ||
      names[0];

    if (!clusterName || clusterName !== pick) {
      setClusterName(pick);
    }
  }, [names, clusterName, urlCluster]);

  useEffect(() => {
    if (!clusterName) return;
    try {
      window.localStorage.setItem("elkwatch.cluster.nodes", clusterName);
    } catch {
      // ignore
    }
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => load()}
            >
              Refresh
            </button>
          </div>
        </div>
        {summary && (
          <div className="nodes-toolbar-status">
            <span
              className={`nodes-health-dot ${healthClass}`}
              title={`Cluster status: ${summary.status}`}
            />
            <span>
              {nodeCountLabel} · {summary.status}
            </span>
          </div>
        )}
      </div>

      {loading && <LoadingSpinner compact label="Loading nodes" />}
      {error && <p className="error">{error}</p>}

      {data && !loading && !error && (
        <section className="nodes-summary-card" aria-label="Cluster nodes summary">
          <div className="nodes-donuts">
            <div>
              <h2 className="donut-column-title">Disk usage</h2>
              <ClusterDonut
                variant="disk"
                summary={summary}
                formatBytes={formatBytes}
              />
            </div>
            <div>
              <h2 className="donut-column-title">Heap memory</h2>
              <ClusterDonut
                variant="heap"
                summary={summary}
                formatBytes={formatBytes}
              />
            </div>
            <div>
              <h2 className="donut-column-title">Shards</h2>
              <ClusterDonut
                variant="shards"
                summary={summary}
                formatBytes={formatBytes}
              />
            </div>
          </div>

          <div className="nodes-divider" />

          <div className="nodes-node-rows">
            {nodesList.map((n) => {
              const addr =
                n.httpPublishAddress || n.host || n.ip || "";
              const { host, port } = parsePublishAddress(addr);
              const diskPct = n.diskUsedPercent;
              const heapPct = n.heapUsedPercent;
              return (
                <div key={n.nodeId} className="nodes-node-row">
                  <div>
                    <div className="nodes-node-label">Node</div>
                    <div className="nodes-node-value">{n.name}</div>
                    <div className="nodes-node-sub">{rolesLabel(n.roles)}</div>
                  </div>
                  <div>
                    <div className="nodes-node-label">Host</div>
                    <div className="nodes-node-value">{host}</div>
                    {port ? (
                      <div className="nodes-node-sub">{port}</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="nodes-node-label">Disk used</div>
                    <div className="nodes-node-value">
                      {diskPct != null ? `${diskPct}%` : "—"}
                    </div>
                    <div
                      className="nodes-meter"
                      title={
                        diskPct != null
                          ? `${diskPct}% of disk used on this node`
                          : undefined
                      }
                    >
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
                  <div>
                    <div className="nodes-node-label">Total</div>
                    <div className="nodes-node-value">
                      {formatBytes(n.diskTotalBytes)}
                    </div>
                    <div className="nodes-node-sub">disk</div>
                  </div>
                  <div>
                    <div className="nodes-node-label">Free</div>
                    <div className="nodes-node-value">
                      {formatBytes(n.diskFreeBytes)}
                    </div>
                    <div className="nodes-node-sub">disk</div>
                  </div>
                  <div>
                    <div className="nodes-node-label">Heap</div>
                    <div className="nodes-node-value">
                      {n.jvmHeapUsedBytes != null &&
                      n.jvmHeapMaxBytes != null
                        ? `${formatBytes(n.jvmHeapUsedBytes)} / ${formatBytes(n.jvmHeapMaxBytes)}`
                        : "—"}
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
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
