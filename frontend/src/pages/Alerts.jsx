import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import HealthBadge from "../components/HealthBadge.jsx";
import { compareStrings } from "../utils/tableSort.js";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams, Link } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import {
  ACTIVE_CLUSTER_KEY,
  persistPageCluster,
} from "../utils/clusterStorage.js";

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
    let active = "";
    try {
      active = window.localStorage.getItem(ACTIVE_CLUSTER_KEY) || "";
    } catch {
      active = "";
    }

    const pick =
      (urlCluster && clusterNames.includes(urlCluster) && urlCluster) ||
      (remembered && clusterNames.includes(remembered) && remembered) ||
      (active && clusterNames.includes(active) && active) ||
      "";

    if (clusterFilter !== pick) {
      setClusterFilter(pick);
    }
  }, [clusterNames, urlCluster, clusterFilter]);

  useEffect(() => {
    persistPageCluster("alerts", clusterFilter);
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
      <div className="page-toolbar">
        <h1 className="page-title">Alerts</h1>
        <span className="stat-chip">{filteredCount} alert{filteredCount !== 1 ? "s" : ""}</span>
        <span className="toolbar-spacer" />
        <select
          className="filter-select"
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
        >
          <option value="">All clusters</option>
          {clusterNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {urlCluster ? (
          <Link className="btn btn-secondary" to="/alerts">
            Clear URL filter
          </Link>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => load()}><span style={{ fontSize: "16px" }}>↻</span> Refresh</button>
      </div>

      {alerts.length === 0 ? (
        <p className="muted">No alerts recorded yet (scheduler runs every 5 minutes).</p>
      ) : filteredCount === 0 ? (
        <p className="muted">No alerts match the current filter.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh label="Time" sortKey="time" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Severity" sortKey="severity" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Cluster" sortKey="cluster" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Rule" sortKey="ruleId" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Message" sortKey="message" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((a) => {
                const ts = new Date(a.time);
                const sev = a.severity || "info";
                return (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {ts.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td><HealthBadge tone={sev} label={sev} /></td>
                    <td>{a.cluster}</td>
                    <td className="text-mono">{a.ruleId}</td>
                    <td>{a.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
