import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { compareStrings } from "../utils/tableSort.js";
import { pushToast } from "../hooks/useToasts.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

function failedText(row) {
  return (
    row.failedStep ||
    (row.error ? JSON.stringify(row.error) : "") ||
    ""
  );
}

function extractPoliciesMap(policiesPayload) {
  if (!policiesPayload) return {};
  const body = policiesPayload.body ?? policiesPayload;
  if (!body || typeof body !== "object") return {};
  return body;
}

function renderDiffPath(path) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return <span>$</span>;
  return (
    <span className="diff-path-breadcrumb" title={path}>
      {parts.map((part, idx) => (
        <span
          key={`${part}-${idx}`}
          className={idx === parts.length - 1 ? "diff-path-leaf" : "diff-path-part"}
        >
          {idx > 0 ? <span className="diff-path-sep">›</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}

function diffGroupKey(path) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return "$";
  if (parts[0].startsWith("_")) return parts[0];
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return parts[0];
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

  const [editorPolicyName, setEditorPolicyName] = useState("");
  const [editorText, setEditorText] = useState("");
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [includeMetaDiff, setIncludeMetaDiff] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => {
    if (!names.length) return;

    const key = "elkwatch.cluster.ilm";
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
    persistPageCluster("ilm", clusterName);
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

  const policiesMap = useMemo(
    () => extractPoliciesMap(data?.policies),
    [data]
  );

  const policyNames = useMemo(() => {
    const keys = Object.keys(policiesMap || {});
    keys.sort((a, b) => a.localeCompare(b));
    return keys;
  }, [policiesMap]);

  useEffect(() => {
    if (!policyNames.length) return;
    if (!editorPolicyName || !policyNames.includes(editorPolicyName)) {
      setEditorPolicyName(policyNames[0]);
    }
  }, [policyNames, editorPolicyName]);

  const loadPolicyIntoEditor = useCallback(
    (name) => {
      const wrapper = policiesMap?.[name];
      const policy = wrapper?.policy ?? null;
      if (!policy) {
        pushToast({
          title: "Policy not found",
          message: `No policy payload for "${name}"`,
          tone: "error",
        });
        return;
      }
      setEditorText(JSON.stringify(policy, null, 2));
      setDryRunResult(null);
    },
    [policiesMap]
  );

  useEffect(() => {
    if (!editorPolicyName) return;
    if (!editorText.trim()) {
      loadPolicyIntoEditor(editorPolicyName);
    }
  }, [editorPolicyName, editorText, loadPolicyIntoEditor]);

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

  const visibleDiff = useMemo(() => {
    const all = Array.isArray(dryRunResult?.diff) ? dryRunResult.diff : [];
    const limit = Math.min(200, diffExpanded ? all.length : 50);
    return all.slice(0, limit);
  }, [dryRunResult, diffExpanded]);

  const groupedDiff = useMemo(() => {
    const map = new Map();
    for (const item of visibleDiff) {
      const key = diffGroupKey(item.path);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [visibleDiff]);

  if (clustersLoading && !clusters) {
    return <LoadingSpinner label="Loading clusters" />;
  }

  if (clustersError) {
    return <p className="error">{clustersError}</p>;
  }

  const runDryRun = async () => {
    if (!clusterName || !editorPolicyName) return;
    setDryRunLoading(true);
    setDryRunResult(null);
    setDiffExpanded(false);
    setCollapsedGroups({});
    try {
      const res = await fetch(
        `/api/ilm/${encodeURIComponent(clusterName)}/dry-run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            policyName: editorPolicyName,
            proposedPolicyText: editorText,
            includeMetaDiff,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setDryRunResult(json);
      if (json.validationErrors?.length) {
        pushToast({
          title: "Dry-run validation issues",
          message: json.validationErrors[0],
          tone: "warning",
        });
      } else {
        pushToast({
          title: "Dry-run ok",
          message: `${json.diff?.length ?? 0} change(s) detected`,
          tone: "success",
        });
      }
    } catch (e) {
      pushToast({ title: "Dry-run failed", message: e.message, tone: "error" });
      setDryRunResult({ error: e.message });
    } finally {
      setDryRunLoading(false);
    }
  };

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

      {data?.policies && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3 className="subpanel-title">Policy editor (dry-run)</h3>
          <div className="muted" style={{ marginBottom: "0.75rem" }}>
            No writes are performed. This checks JSON validity, shows a structural diff,
            and lists indices currently using the selected policy.
          </div>
          <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
            <div className="cluster-select">
              <label htmlFor="ilm-policy">Policy</label>
              <select
                id="ilm-policy"
                className="select-elk"
                value={editorPolicyName}
                onChange={(e) => {
                  setEditorPolicyName(e.target.value);
                  setDryRunResult(null);
                }}
              >
                {policyNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-actions">
              <label className="diff-toggle-inline">
                <input
                  type="checkbox"
                  checked={includeMetaDiff}
                  onChange={(e) => setIncludeMetaDiff(e.target.checked)}
                />
                Include _meta in diff
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => loadPolicyIntoEditor(editorPolicyName)}
                disabled={!editorPolicyName}
              >
                Load current
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runDryRun}
                disabled={dryRunLoading || !editorPolicyName}
              >
                {dryRunLoading ? "Validating…" : "Validate dry-run"}
              </button>
            </div>
          </div>

          <textarea
            className="input-elk"
            style={{
              width: "100%",
              minHeight: "220px",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: "12px",
              lineHeight: "1.4",
            }}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            spellCheck={false}
          />

          {dryRunResult?.error && (
            <p className="error" style={{ marginTop: "0.75rem" }}>
              {dryRunResult.error}
            </p>
          )}

          {dryRunResult && !dryRunResult.error && (
            <div style={{ marginTop: "0.75rem" }}>
              {dryRunResult.validationErrors?.length > 0 && (
                <div className="card" style={{ padding: "0.75rem", marginBottom: "0.75rem" }}>
                  <div className="error" style={{ marginBottom: "0.25rem" }}>
                    Validation issues
                  </div>
                  <ul className="muted" style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {dryRunResult.validationErrors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
                <div className="table-meta muted">
                  Diff: {dryRunResult.diff?.length ?? 0} change(s) (showing up to 200)
                </div>
                <div className="table-meta muted">
                  Affected indices: {dryRunResult.affectedIndices?.length ?? 0}
                </div>
              </div>

              {!includeMetaDiff ? (
                <div className="muted" style={{ marginBottom: "0.5rem" }}>
                  _meta changes are hidden by default.
                </div>
              ) : null}

              {Array.isArray(dryRunResult.diff) && dryRunResult.diff.length > 0 && (
                <div className="card table-wrap" style={{ padding: "0.5rem" }}>
                  <div className="diff-header">
                    <div className="muted">
                      Showing {diffExpanded ? Math.min(200, dryRunResult.diff.length) : Math.min(50, dryRunResult.diff.length)} of{" "}
                      {Math.min(200, dryRunResult.diff.length)} changes
                    </div>
                    {dryRunResult.diff.length > 50 ? (
                      <button
                        type="button"
                        className="btn btn-secondary diff-toggle"
                        onClick={() => setDiffExpanded((v) => !v)}
                      >
                        {diffExpanded ? "Show fewer" : "Show all"}
                      </button>
                    ) : null}
                  </div>
                  <div className="diff-groups">
                    {groupedDiff.map((g) => {
                      const collapsed = collapsedGroups[g.key] === true;
                      return (
                        <section key={g.key} className="diff-group">
                          <button
                            type="button"
                            className="diff-group-toggle"
                            onClick={() =>
                              setCollapsedGroups((prev) => ({
                                ...prev,
                                [g.key]: !prev[g.key],
                              }))
                            }
                          >
                            <span className="diff-group-title">{g.key}</span>
                            <span className="diff-group-count">
                              {g.items.length} change{g.items.length === 1 ? "" : "s"}
                            </span>
                            <span className="diff-group-chevron">{collapsed ? "▸" : "▾"}</span>
                          </button>
                          {!collapsed ? (
                            <table className="diff-table">
                              <thead>
                                <tr>
                                  <th>Path</th>
                                  <th className="diff-col-before">Before</th>
                                  <th className="diff-col-after">After</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((d, idx) => (
                                  <tr key={`${g.key}-${d.path}-${idx}`}>
                                    <td className="diff-path">
                                      {renderDiffPath(d.path)}
                                    </td>
                                    <td className="diff-before">
                                      <code className="diff-code">
                                        <span className="diff-sign diff-sign--before">-</span>
                                        {typeof d.before === "string"
                                          ? d.before
                                          : JSON.stringify(d.before)}
                                      </code>
                                    </td>
                                    <td className="diff-after">
                                      <code className="diff-code">
                                        <span className="diff-sign diff-sign--after">+</span>
                                        {typeof d.after === "string"
                                          ? d.after
                                          : JSON.stringify(d.after)}
                                      </code>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                  {dryRunResult.diff.length > 200 ? (
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      Showing up to 200 diff entries.
                    </div>
                  ) : null}
                </div>
              )}

              {Array.isArray(dryRunResult.affectedIndices) &&
                dryRunResult.affectedIndices.length > 0 && (
                  <div className="card table-wrap" style={{ padding: "0.5rem", marginTop: "0.75rem" }}>
                    <h4 className="subpanel-title" style={{ marginBottom: "0.5rem" }}>
                      Indices using “{dryRunResult.policyName}”
                    </h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Index</th>
                          <th>Managed</th>
                          <th>Phase</th>
                          <th>Action</th>
                          <th>Step</th>
                          <th>Failed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRunResult.affectedIndices.slice(0, 50).map((row) => (
                          <tr key={row.index}>
                            <td>{row.index}</td>
                            <td>{row.managed ? "yes" : "no"}</td>
                            <td>{row.phase ?? "—"}</td>
                            <td>{row.action ?? "—"}</td>
                            <td>{row.step ?? "—"}</td>
                            <td className={row.failedStep || row.error ? "error" : "muted"}>
                              {row.failedStep ||
                                (row.error ? JSON.stringify(row.error) : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {dryRunResult.affectedIndices.length > 50 && (
                      <div className="muted" style={{ marginTop: "0.5rem" }}>
                        Showing first 50 indices.
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

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
