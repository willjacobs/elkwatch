import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Overview from "./pages/Overview.jsx";
import Indices from "./pages/Indices.jsx";
import ILM from "./pages/ILM.jsx";
import Alerts from "./pages/Alerts.jsx";
import Nodes from "./pages/Nodes.jsx";
import Templates from "./pages/Templates.jsx";
import Docs from "./pages/Docs.jsx";
import Settings from "./pages/Settings.jsx";
import { IconHelp } from "./components/SidebarIcons.jsx";
import { useGlobalRefreshController } from "./hooks/useGlobalRefresh.js";
import { useClusters } from "./hooks/useCluster.js";
import Toasts from "./components/Toasts.jsx";
import IconRail from "./components/IconRail.jsx";
import ContextPanel from "./components/ContextPanel.jsx";
import { syncAllClusterKeys } from "./utils/clusterStorage.js";

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.1.0";

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [ctxVisible, setCtxVisible] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(0);
  const { refreshNow, refreshAuto } = useGlobalRefreshController();
  const { data: clusters } = useClusters();
  const location = useLocation();
  const navigate = useNavigate();

  const clusterNames = useMemo(() => (clusters || []).map((c) => c.name), [clusters]);

  const activeCluster = useMemo(() => {
    const q = new URLSearchParams(location.search).get("cluster");
    if (q && clusterNames.includes(q)) return q;
    try {
      const a = window.localStorage.getItem("elkwatch.cluster.active");
      if (a && clusterNames.includes(a)) return a;
    } catch { /* ignore */ }
    return clusterNames[0] ?? "";
  }, [clusterNames, location.search]);

  const toWithCluster = (path) =>
    activeCluster ? `${path}?cluster=${encodeURIComponent(activeCluster)}` : path;

  const onClusterChange = (name) => {
    syncAllClusterKeys(name);
    const sp = new URLSearchParams(location.search);
    sp.set("cluster", name);
    navigate({ pathname: location.pathname, search: `?${sp.toString()}` }, { replace: true });
  };

  // Persist theme
  useEffect(() => {
    try { const s = window.localStorage.getItem("elkwatch.theme"); if (["dark","light","charcoal"].includes(s)) setTheme(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("elkwatch.theme", theme); } catch { /* ignore */ }
  }, [theme]);

  // Persist ctx visibility
  useEffect(() => {
    try { const v = window.localStorage.getItem("elkwatch.ctx.visible"); if (v === "0") setCtxVisible(false); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("elkwatch.ctx.visible", ctxVisible ? "1" : "0"); } catch { /* ignore */ }
  }, [ctxVisible]);

  // Persist refresh interval
  useEffect(() => {
    try { const s = parseInt(window.localStorage.getItem("elkwatch.refreshIntervalMs") || "0", 10); if ([0,30000,60000,300000].includes(s)) setRefreshIntervalMs(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("elkwatch.refreshIntervalMs", String(refreshIntervalMs)); } catch { /* ignore */ }
  }, [refreshIntervalMs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") refreshAuto(); }, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refreshIntervalMs, refreshAuto]);

  // Current page title for breadcrumb
  const pageLabel = useMemo(() => {
    const p = location.pathname;
    if (p === "/") return "Overview";
    if (p === "/nodes") return "Nodes";
    if (p === "/indices") return "Indices";
    if (p === "/ilm") return "ILM";
    if (p === "/alerts") return "Alerts";
    if (p === "/templates") return "Templates";
    if (p === "/docs") return "Documentation";
    if (p === "/settings") return "Settings";
    return "";
  }, [location.pathname]);

  return (
    <div className="shell">
      <IconRail clusters={clusters} toWithCluster={toWithCluster} />
      <ContextPanel
        visible={ctxVisible}
        clusters={clusters}
        activeCluster={activeCluster}
        onClusterChange={onClusterChange}
        theme={theme}
        onThemeChange={setTheme}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshChange={setRefreshIntervalMs}
        appVersion={APP_VERSION}
      />
      <div className="shell-main">
        <Toasts />
        <div className="topbar">
          <div className="topbar-breadcrumb">
            <strong>{pageLabel}</strong>
            {activeCluster && location.pathname !== "/" && (
              <><span className="topbar-sep">{"\u203A"}</span>{activeCluster}</>
            )}
          </div>
          <div className="topbar-spacer" />
          <button
            type="button"
            className="topbar-pill"
            onClick={() => setCtxVisible((v) => !v)}
            title={ctxVisible ? "Hide panel" : "Show panel"}
            style={{ fontSize: "16px" }}
          >
            {ctxVisible ? "\u2039" : "\u203A"}
          </button>
          <button
            type="button"
            className="topbar-pill"
            onClick={() => refreshNow()}
            title="Refresh"
            style={{ fontSize: "16px" }}
          >
            {"\u21BB"}
          </button>
          <button
            type="button"
            className="topbar-pill"
            onClick={() => navigate("/docs")}
            title="Help & Docs"
          >
            <IconHelp style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/indices" element={<Indices />} />
            <Route path="/ilm" element={<ILM />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
