import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";

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

  useEffect(() => {
    if (names.length && !clusterName) {
      setClusterName(names[0]);
    }
  }, [names, clusterName]);

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

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Index templates</h1>
      </header>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Composable index templates (Elasticsearch 7.8+). Read-only view.
      </p>
      <div className="toolbar">
        <div className="cluster-select">
          <label htmlFor="tpl-cluster">Cluster</label>
          <select
            id="tpl-cluster"
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

      {loading && <LoadingSpinner compact label="Loading templates" />}
      {error && <p className="error">{error}</p>}

      {data?.templates && !loading && (
        <div className="card table-wrap">
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
                    <td>{t.name}</td>
                    <td>{(t.indexPatterns || []).join(", ") || "—"}</td>
                    <td>{t.priority}</td>
                    <td className="muted">
                      {(t.composedOf || []).join(", ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
