import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

export default function Templates() {
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

  useEffect(() => {
    if (!names.length) return;

    const key = "elkwatch.cluster.templates";
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
    persistPageCluster("templates", clusterName);
  }, [clusterName]);

  const load = useCallback(async () => {
    if (!clusterName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/templates/${encodeURIComponent(clusterName)}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Templates failed", message: e.message, tone: "error" });
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

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  const templateCount = data?.templates?.length ?? 0;

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Index templates</h1>
        {data?.templates && (
          <span className="stat-chip">{templateCount} template{templateCount !== 1 ? "s" : ""}</span>
        )}
        <span className="toolbar-spacer" />
        <select
          className="filter-select"
          value={clusterName}
          onChange={(e) => setClusterName(e.target.value)}
        >
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => load()}><span style={{ fontSize: "16px" }}>↻</span> Refresh</button>
      </div>

      <p className="muted" style={{ marginBottom: "1rem" }}>
        Composable index templates (Elasticsearch 7.8+). Read-only view.
      </p>

      {loading && <LoadingSpinner compact label="Loading templates" />}
      {error && <p className="error">{error}</p>}

      {data?.templates && !loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Index patterns</th>
                <th>Priority</th>
                <th>Composed of</th>
              </tr>
            </thead>
            <tbody>
              {data.templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No composable index templates found.
                  </td>
                </tr>
              ) : (
                data.templates.map((t) => (
                  <tr key={t.name}>
                    <td className="text-mono">{t.name}</td>
                    <td>
                      {(t.indexPatterns || []).length > 0
                        ? t.indexPatterns.map((p) => (
                            <span key={p} style={{ display: "inline-block", margin: "1px 3px 1px 0", padding: "1px 6px", background: "var(--clr-surface-hi)", border: "1px solid var(--clr-border)", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace" }}>{p}</span>
                          ))
                        : "—"}
                    </td>
                    <td className="tabular-num">{t.priority}</td>
                    <td className="muted">
                      {(t.composedOf || []).join(", ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="table-footer">
            {templateCount} template{templateCount !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
