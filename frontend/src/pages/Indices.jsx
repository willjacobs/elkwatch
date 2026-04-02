import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import HealthBadge from "../components/HealthBadge.jsx";
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

  const unhealthyCount = useMemo(() => {
    const rows = indices?.indices || [];
    return rows.filter((r) => r.health !== "green").length;
  }, [indices]);

  const maxBytes = useMemo(
    () => Math.max(1, ...(indices?.indices || []).map((i) => parseStoreSizeToBytes(i.storeSize) || 0)),
    [indices]
  );

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Indices</h1>
        {indices?.indices && (
          <>
            <span className="stat-chip">{indices.indices.length} total</span>
            {unhealthyCount > 0 && (
              <span className="stat-chip" style={{ color: "var(--clr-red)" }}>
                {unhealthyCount} unhealthy
              </span>
            )}
          </>
        )}
        <span className="toolbar-spacer" />
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" />
        </div>
        <select
          className="filter-select"
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
        >
          <option value="">All health</option>
          <option value="green">green</option>
          <option value="yellow">yellow</option>
          <option value="red">red</option>
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All status</option>
          <option value="open">open</option>
          <option value="close">close</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {loading && <LoadingSpinner compact label="Loading indices" />}
      {error && <p className="error">{error}</p>}

      {indices?.indices && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh label="Index" sortKey="index" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Health" sortKey="health" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Pri" sortKey="docsCount" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Rep" sortKey="docsCount" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Docs" sortKey="docsCount" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Store size" sortKey="storeSize" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableTh label="Created" sortKey="creationDate" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((idx) => {
                const storeBytes = parseStoreSizeToBytes(idx.storeSize) || 0;
                const barPct = Math.round((storeBytes / maxBytes) * 100);
                return (
                  <tr key={idx.index}>
                    <td className="text-mono">{idx.index}</td>
                    <td><HealthBadge tone={idx.health} label={idx.health} /></td>
                    <td>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px",
                        background: idx.status === "open"
                          ? "color-mix(in srgb, var(--clr-green) 15%, transparent)"
                          : "color-mix(in srgb, var(--clr-muted2) 15%, transparent)",
                        color: idx.status === "open" ? "var(--clr-green)" : "var(--clr-muted2)"
                      }}>
                        {idx.status}
                      </span>
                    </td>
                    <td className="tabular-num">{idx.pri ?? "—"}</td>
                    <td className="tabular-num">{idx.rep ?? "—"}</td>
                    <td className="tabular-num">{idx.docsCount}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="tabular-num" style={{ minWidth: "48px", textAlign: "right" }}>{idx.storeSize || "—"}</span>
                        <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--clr-surface-hi)" }}>
                          <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "2px", background: "var(--clr-accent)" }} />
                        </div>
                      </div>
                    </td>
                    <td className="muted">{idx.creationDate || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            Showing {sortedRows.length} of {indices.indices.length} indices
          </div>
        </div>
      )}
    </div>
  );
}
