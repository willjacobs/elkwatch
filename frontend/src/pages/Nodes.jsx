import { useCallback, useEffect, useMemo, useState } from "react";
import ClusterDonut from "../components/ClusterDonut.jsx";
import KpiCard from "../components/KpiCard.jsx";
import MeterBar from "../components/MeterBar.jsx";
import SparklineChart from "../components/SparklineChart.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useNodeHistory } from "../hooks/useNodeHistory.js";
import { formatBytes } from "../utils/format.js";
import { Link, useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

function parsePublishAddress(addr) {
  if (!addr) return { host: "—", port: "" };
  const s = String(addr);
  const lastColon = s.lastIndexOf(":");
  if (lastColon < 0) return { host: s, port: "" };
  const after = s.slice(lastColon + 1);
  return /^\d+$/.test(after) ? { host: s.slice(0, lastColon), port: `:${after}` } : { host: s, port: "" };
}

function heapColor(pct) {
  if (pct == null) return "#a78bfa";
  if (pct >= 90) return "#f87171";
  if (pct >= 80) return "#facc15";
  return "#a78bfa";
}

export default function Nodes() {
  const { data: clusters, loading: clustersLoading, error: clustersError } = useClusters();
  const names = useMemo(() => (clusters || []).map((c) => c.name), [clusters]);
  const [clusterName, setClusterName] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster");
  const { appendNodeData, getHistory } = useNodeHistory();

  useEffect(() => {
    if (!names.length) return;
    let remembered = "";
    try { remembered = window.localStorage.getItem("elkwatch.cluster.nodes") || ""; } catch { /* */ }
    let active = "";
    try { active = window.localStorage.getItem(ACTIVE_CLUSTER_KEY) || ""; } catch { /* */ }
    const pick = (urlCluster && names.includes(urlCluster) && urlCluster) ||
      (remembered && names.includes(remembered) && remembered) ||
      (active && names.includes(active) && active) || names[0];
    if (clusterName !== pick) setClusterName(pick);
  }, [names, clusterName, urlCluster]);

  useEffect(() => { if (clusterName) persistPageCluster("nodes", clusterName); }, [clusterName]);

  const load = useCallback(async () => {
    if (!clusterName) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(clusterName)}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const json = await res.json();
      setData(json);
      appendNodeData(clusterName, json.nodes);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Nodes failed", message: e.message, tone: "error" });
      setData(null);
    } finally { setLoading(false); }
  }, [clusterName, appendNodeData]);

  useEffect(() => { load(); }, [load]);
  useRegisterGlobalRefresh(() => { load(); });

  const summary = data?.summary;

  const onSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return prev; }
      setSortDir("asc"); return key;
    });
  }, []);

  const nodeRows = useMemo(() => {
    const list = [...(data?.nodes || [])];
    const mul = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") return mul * String(a.name).localeCompare(String(b.name));
      if (sortKey === "disk") return mul * ((a.diskUsedPercent ?? -1) - (b.diskUsedPercent ?? -1));
      if (sortKey === "heap") return mul * ((a.heapUsedPercent ?? -1) - (b.heapUsedPercent ?? -1));
      return 0;
    });
    return list.map((n) => {
      const addr = n.httpPublishAddress || n.host || n.ip || "";
      const { host, port } = parsePublishAddress(addr);
      return { ...n, hostLabel: host, portLabel: port };
    });
  }, [data, sortKey, sortDir]);

  if (clustersLoading && !clusters) return <LoadingSpinner label="Loading clusters" />;
  if (clustersError) return <p className="error">{clustersError}</p>;

  const statusColor = summary?.status === "green" ? "var(--clr-green)" : summary?.status === "yellow" ? "var(--clr-yellow)" : "var(--clr-red)";

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Nodes</h1>
        {summary && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--clr-muted2)" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor }} />
            {clusterName} · {summary.status}
          </span>
        )}
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => load()}><span style={{ fontSize: "16px" }}>↻</span> Refresh</button>
      </div>

      {loading && <LoadingSpinner compact label="Loading nodes" />}
      {error && <p className="error">{error}</p>}

      {data && !loading && (
        <>
          {/* KPI strip */}
          <div className="kpi-grid">
            <KpiCard label="Nodes" value={summary?.numberOfNodes} sub={summary?.numberOfNodes === 1 ? "1 master" : ""} tone="blue" />
            <KpiCard label="Active Shards" value={summary?.activeShards} sub={`of ${(summary?.activeShards ?? 0) + (summary?.unassignedShards ?? 0)} total`} />
            <KpiCard label="Unassigned" value={summary?.unassignedShards} sub="replica shards" tone={summary?.unassignedShards > 0 ? "yellow" : "green"} />
            <KpiCard label="Cluster Status" value={summary?.status} tone={summary?.status === "green" ? "green" : summary?.status === "yellow" ? "yellow" : "red"} />
          </div>

          {/* Viz panels */}
          <div className="viz-panels">
            <div className="card card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div className="section-title" style={{ alignSelf: "flex-start" }}>DISK USAGE</div>
              <ClusterDonut variant="disk" summary={summary} formatBytes={formatBytes} compact />
            </div>
            <div className="card card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div className="section-title" style={{ alignSelf: "flex-start" }}>SHARD DISTRIBUTION</div>
              <ClusterDonut variant="shards" summary={summary} formatBytes={formatBytes} compact />
            </div>
            <div className="card card-body">
              <div className="section-title" style={{ marginBottom: "14px" }}>HEAP PER NODE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {nodeRows.map((n) => {
                  const history = getHistory(clusterName, n.name);
                  const color = heapColor(n.heapUsedPercent);
                  return (
                    <div key={n.nodeId}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--clr-muted2)" }}>{n.name}</span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color }}>{n.heapUsedPercent != null ? `${n.heapUsedPercent}%` : "—"}</span>
                      </div>
                      {history.length > 1
                        ? <SparklineChart data={history} color={color} height={30} />
                        : <div style={{ height: "30px", background: "var(--clr-border)", borderRadius: "3px" }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Node table */}
          <div className="table-wrap">
            <div className="card-header">
              <span className="section-title">NODE LIST</span>
              <span style={{ fontSize: "11px", color: "var(--clr-dim)" }}>{nodeRows.length} node{nodeRows.length !== 1 ? "s" : ""}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} label="Node" />
                  <th>Host</th>
                  <th>Roles</th>
                  <SortableTh sortKey="disk" activeKey={sortKey} dir={sortDir} onSort={onSort} label="Disk used" />
                  <SortableTh sortKey="heap" activeKey={sortKey} dir={sortDir} onSort={onSort} label="Heap" />
                </tr>
              </thead>
              <tbody>
                {nodeRows.map((n) => (
                  <tr key={n.nodeId}>
                    <td className="text-mono" style={{ color: "var(--clr-text)", fontWeight: 500 }}>{n.name}</td>
                    <td className="text-mono">
                      {n.hostLabel}
                      {n.portLabel && <span style={{ color: "var(--clr-dim)" }}>{n.portLabel}</span>}
                    </td>
                    <td>
                      {(n.roles || []).map((r) => (
                        <span key={r} style={{
                          display: "inline-block", marginRight: "3px", padding: "1px 6px", borderRadius: "4px",
                          fontSize: "10px", fontWeight: 500,
                          background: r === "master" ? "var(--clr-accent-bg)" : "var(--clr-surface-hi)",
                          color: r === "master" ? "var(--clr-accent)" : "var(--clr-muted2)",
                          border: `1px solid ${r === "master" ? "rgba(59,130,246,0.2)" : "var(--clr-border)"}`,
                        }}>{r}</span>
                      ))}
                    </td>
                    <td style={{ minWidth: "130px" }}><MeterBar pct={n.diskUsedPercent} label={n.diskUsedPercent != null ? formatBytes(n.diskUsedBytes) : undefined} /></td>
                    <td style={{ minWidth: "130px" }}><MeterBar pct={n.heapUsedPercent} forceColor={heapColor(n.heapUsedPercent)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary && (
            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <Link to={`/indices?cluster=${encodeURIComponent(clusterName)}`} style={{ fontSize: "11px", color: "var(--clr-muted2)" }}>
                View indices →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
