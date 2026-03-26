import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { compareStrings } from "../utils/tableSort.js";
import { pushToast } from "../hooks/useToasts.js";

function failedText(row) {
  return (
    row.failedStep ||
    (row.error ? JSON.stringify(row.error) : "") ||
    ""
  );
}

export default function ILM() {
  const { data: clusters, loading: clustersLoading, error: clustersError } =
    useClusters();
  const names = useMemo(
    () => (clusters || []).map((c) => c.name),
    [clusters]
  );
  const [clusterName, setClusterName] = useState("");
  const [indexSearch, setIndexSearch] = useState("");
  const [managedFilter, setManagedFilter] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("index");
  const [sortDir, setSortDir] = useState("asc");
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster");

  useEffect(() => {
    if (!names.length) return;

    const key = "elkwatch.cluster.ilm";
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
      window.localStorage.setItem("elkwatch.cluster.ilm", clusterName);
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
        `/api/ilm/${encodeURIComponent(clusterName)}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "ILM failed", message: e.message, tone: "error" });
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

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const rows = data?.indices;
    if (!rows?.length) return [];
    const q = indexSearch.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (q && !String(r.index || "").toLowerCase().includes(q)) return false;
      if (managedFilter === "yes" && !r.managed) return false;
      if (managedFilter === "no" && r.managed) return false;
      if (errorsOnly && !(r.failedStep || r.error)) return false;
      if (phaseFilter && String(r.phase || "") !== phaseFilter) return false;
      return true;
    });
    const mul = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "index":
          cmp = compareStrings(a.index, b.index);
          break;
        case "managed":
          cmp = (a.managed ? 1 : 0) - (b.managed ? 1 : 0);
          break;
        case "phase":
          cmp = compareStrings(a.phase, b.phase);
          break;
        case "action":
          cmp = compareStrings(a.action, b.action);
          break;
        case "step":
          cmp = compareStrings(a.step, b.step);
          break;
        case "failedStep":
          cmp = compareStrings(failedText(a), failedText(b));
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
    return list;
  }, [data, sortKey, sortDir, indexSearch, managedFilter, errorsOnly, phaseFilter]);

  const phaseOptions = useMemo(() => {
    const rows = data?.indices || [];
    const set = new Set();
    for (const r of rows) {
      if (r.phase) set.add(String(r.phase));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">ILM</h1>
      </header>
      <div className="toolbar">
        <div className="cluster-select">
          <label htmlFor="ilm-cluster">Cluster</label>
          <select
            id="ilm-cluster"
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

      {loading && <LoadingSpinner compact label="Loading ILM" />}
      {error && <p className="error">{error}</p>}

      {data?.indices && (
        <div className="card table-wrap">
          <h3 className="subpanel-title">Per-index lifecycle</h3>
          <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
            <div className="cluster-select">
              <label htmlFor="ilm-search">Search</label>
              <input
                id="ilm-search"
                className="input-elk"
                value={indexSearch}
                onChange={(e) => setIndexSearch(e.target.value)}
                placeholder="index name contains…"
              />
            </div>
            <div className="cluster-select">
              <label htmlFor="ilm-managed">Managed</label>
              <select
                id="ilm-managed"
                className="select-elk"
                value={managedFilter}
                onChange={(e) => setManagedFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </div>
            <div className="cluster-select">
              <label htmlFor="ilm-phase">Phase</label>
              <select
                id="ilm-phase"
                className="select-elk"
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
              >
                <option value="">All</option>
                {phaseOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="cluster-select">
              <label htmlFor="ilm-errors">Errors only</label>
              <select
                id="ilm-errors"
                className="select-elk"
                value={errorsOnly ? "yes" : "no"}
                onChange={(e) => setErrorsOnly(e.target.value === "yes")}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </div>
          </div>
          <div className="table-meta muted" style={{ marginBottom: "0.5rem" }}>
            Showing {sortedRows.length} of {data.indices.length}
          </div>
          <table>
            <thead>
              <tr>
                <SortableTh
                  label="Index"
                  sortKey="index"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Managed"
                  sortKey="managed"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Phase"
                  sortKey="phase"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Action"
                  sortKey="action"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Step"
                  sortKey="step"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Failed step"
                  sortKey="failedStep"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.index}>
                  <td>{row.index}</td>
                  <td>{row.managed ? "yes" : "no"}</td>
                  <td>{row.phase ?? "—"}</td>
                  <td>{row.action ?? "—"}</td>
                  <td>{row.step ?? "—"}</td>
                  <td className={row.failedStep || row.error ? "error" : "muted"}>
                    {row.failedStep || (row.error ? JSON.stringify(row.error) : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
