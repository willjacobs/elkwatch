import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import {
  compareStrings,
  HEALTH_ORDER,
  parseStoreSizeToBytes,
} from "../utils/tableSort.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

export default function Indices() {
  const { data: clusters, loading: clustersLoading, error: clustersError } =
    useClusters();
  const names = useMemo(
    () => (clusters || []).map((c) => c.name),
    [clusters]
  );
  const [clusterName, setClusterName] = useState("");
  const [filter, setFilter] = useState("*");
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [indices, setIndices] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("index");
  const [sortDir, setSortDir] = useState("asc");
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster");

  useEffect(() => {
    if (!names.length) return;

    const key = "elkwatch.cluster.indices";
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
    persistPageCluster("indices", clusterName);
  }, [clusterName]);

  const load = useCallback(async () => {
    if (!clusterName) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ filter });
      const res = await fetch(
        `/api/indices/${encodeURIComponent(clusterName)}?${q}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setIndices(json);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Indices failed", message: e.message, tone: "error" });
      setIndices(null);
    } finally {
      setLoading(false);
    }
  }, [clusterName, filter]);

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
    const rows = indices?.indices;
    if (!rows?.length) return [];
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (q && !String(r.index || "").toLowerCase().includes(q)) return false;
      if (healthFilter && r.health !== healthFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
    const mul = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "index":
          cmp = compareStrings(a.index, b.index);
          break;
        case "health":
          cmp =
            (HEALTH_ORDER[a.health] ?? 99) - (HEALTH_ORDER[b.health] ?? 99);
          break;
        case "status":
          cmp = compareStrings(a.status, b.status);
          break;
        case "docsCount": {
          const na = parseInt(String(a.docsCount).replace(/,/g, ""), 10) || 0;
          const nb = parseInt(String(b.docsCount).replace(/,/g, ""), 10) || 0;
          cmp = na - nb;
          break;
        }
        case "storeSize":
          cmp =
            parseStoreSizeToBytes(a.storeSize) -
            parseStoreSizeToBytes(b.storeSize);
          break;
        case "creationDate":
          cmp = compareStrings(a.creationDate, b.creationDate);
          break;
        default:
          cmp = 0;
      }
      return cmp * mul;
    });
    return list;
  }, [indices, sortKey, sortDir, search, healthFilter, statusFilter]);

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Indices</h1>
      </header>
      <div className="toolbar">
        <div className="cluster-select">
          <label htmlFor="idx-cluster">Cluster</label>
          <select
            id="idx-cluster"
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
        <div className="cluster-select">
          <label htmlFor="idx-filter">Pattern</label>
          <input
            id="idx-filter"
            className="input-elk"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="cluster-select">
          <label htmlFor="idx-search">Search</label>
          <input
            id="idx-search"
            className="input-elk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="index name contains…"
          />
        </div>
        <div className="cluster-select">
          <label htmlFor="idx-health">Health</label>
          <select
            id="idx-health"
            className="select-elk"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="green">green</option>
            <option value="yellow">yellow</option>
            <option value="red">red</option>
          </select>
        </div>
        <div className="cluster-select">
          <label htmlFor="idx-status">Status</label>
          <select
            id="idx-status"
            className="select-elk"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="open">open</option>
            <option value="close">close</option>
          </select>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-primary" onClick={() => load()}>
            Apply
          </button>
        </div>
      </div>

      {loading && (
        <LoadingSpinner compact label="Loading indices" />
      )}
      {error && <p className="error">{error}</p>}

      {indices?.indices && (
        <div className="card table-wrap">
          <div className="table-meta muted" style={{ marginBottom: "0.5rem" }}>
            Showing {sortedRows.length} of {indices.indices.length}
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
                  label="Health"
                  sortKey="health"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Docs"
                  sortKey="docsCount"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Store"
                  sortKey="storeSize"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Created"
                  sortKey="creationDate"
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
                  <td className={row.health === "green" ? "status-green" : row.health === "yellow" ? "status-yellow" : "status-red"}>
                    {row.health}
                  </td>
                  <td>{row.status}</td>
                  <td>{row.docsCount}</td>
                  <td>{row.storeSize}</td>
                  <td className="muted">{row.creationDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
