import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { compareStrings } from "../utils/tableSort.js";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams, Link } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

export default function Alerts() {
  const { data: clusters } = useClusters();
  const clusterNames = useMemo(
    () => (clusters || []).map((c) => c.name),
    [clusters]
  );
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster") || "";

  const [clusterFilter, setClusterFilter] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("time");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!clusterNames.length) return;

    const key = "elkwatch.cluster.alerts";
    let remembered = "";
    try {
      remembered = window.localStorage.getItem(key) || "";
    } catch {
      remembered = "";
    }

    const pick =
      (urlCluster && clusterNames.includes(urlCluster) && urlCluster) ||
      (remembered && clusterNames.includes(remembered) && remembered) ||
      "";

    if (clusterFilter !== pick) {
      setClusterFilter(pick);
    }
  }, [clusterNames, urlCluster, clusterFilter]);

  useEffect(() => {
    try {
      window.localStorage.setItem("elkwatch.cluster.alerts", clusterFilter);
    } catch {
      // ignore
    }
  }, [clusterFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Alerts failed", message: e.message, tone: "error" });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRegisterGlobalRefresh(() => {
    load();
  });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "time" ? "desc" : "asc");
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const base = data?.alerts || [];
    const alerts = clusterFilter
      ? base.filter((a) => a.cluster === clusterFilter)
      : base;
    if (!alerts.length) return [];
    const list = [...alerts];
    const mul = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "time": {
          const ta = Date.parse(a.time) || 0;
          const tb = Date.parse(b.time) || 0;
          cmp = ta - tb;
          break;
        }
        case "cluster":
          cmp = compareStrings(a.cluster, b.cluster);
          break;
        case "ruleId":
          cmp = compareStrings(a.ruleId, b.ruleId);
          break;
        case "severity":
          cmp =
            (SEVERITY_ORDER[a.severity] ?? 99) -
            (SEVERITY_ORDER[b.severity] ?? 99);
          break;
        case "message":
          cmp = compareStrings(a.message, b.message);
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
    return list;
  }, [data, sortKey, sortDir]);

  if (loading && !data) {
    return <LoadingSpinner label="Loading alerts" />;
  }

  if (error) {
    return (
      <div>
        <p className="error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => load()}>
          Retry
        </button>
      </div>
    );
  }

  const alerts = data?.alerts || [];
  const filteredCount = sortedRows.length;

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Alerts</h1>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="cluster-select">
          <label htmlFor="alerts-cluster">Cluster</label>
          <select
            id="alerts-cluster"
            className="select-elk"
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
          >
            <option value="">All clusters</option>
            {clusterNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {urlCluster ? (
          <div className="toolbar-actions">
            <Link className="btn btn-secondary" to="/alerts">
              Clear URL filter
            </Link>
          </div>
        ) : null}
      </div>

      {alerts.length === 0 ? (
        <p className="muted">No alerts recorded yet (scheduler runs every 5 minutes).</p>
      ) : filteredCount === 0 ? (
        <p className="muted">No alerts match the current filter.</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh
                  label="Time"
                  sortKey="time"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Cluster"
                  sortKey="cluster"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Rule"
                  sortKey="ruleId"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Severity"
                  sortKey="severity"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Message"
                  sortKey="message"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{a.time}</td>
                  <td>{a.cluster}</td>
                  <td>{a.ruleId}</td>
                  <td>{a.severity}</td>
                  <td>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
