import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Overview from "./pages/Overview.jsx";
import Indices from "./pages/Indices.jsx";
import ILM from "./pages/ILM.jsx";
import Alerts from "./pages/Alerts.jsx";
import Nodes from "./pages/Nodes.jsx";
import Templates from "./pages/Templates.jsx";
import { useGlobalRefreshController } from "./hooks/useGlobalRefresh.js";
import { useClusters } from "./hooks/useCluster.js";
import Toasts from "./components/Toasts.jsx";
import {
  IconAlerts,
  IconILM,
  IconIndices,
  IconNodes,
  IconOverview,
  IconTemplates,
} from "./components/SidebarIcons.jsx";
import { syncAllClusterKeys } from "./utils/clusterStorage.js";

function clusterStatusDotClass(status) {
  if (status === "green") return "app-sidebar-cluster-dot--green";
  if (status === "yellow") return "app-sidebar-cluster-dot--yellow";
  if (status === "red") return "app-sidebar-cluster-dot--red";
  return "app-sidebar-cluster-dot--unknown";
}

export default function App() {
  const [theme, setTheme] = useState("dark");
  const { refreshNow, refreshAuto } = useGlobalRefreshController();
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(0);
  const { data: clusters } = useClusters();
  const location = useLocation();
  const navigate = useNavigate();

  const clusterNames = useMemo(
    () => (clusters || []).map((c) => c.name),
    [clusters]
  );

  const sidebarCluster = useMemo(() => {
    if (!clusterNames.length) return "";
    const q = new URLSearchParams(location.search).get("cluster");
    if (q && clusterNames.includes(q)) return q;
    try {
      const a = window.localStorage.getItem("elkwatch.cluster.active");
      if (a && clusterNames.includes(a)) return a;
    } catch {
      // ignore
    }
    return clusterNames[0];
  }, [clusterNames, location.search]);

  const clusterRow = useMemo(
    () => (clusters || []).find((c) => c.name === sidebarCluster),
    [clusters, sidebarCluster]
  );

  const onSidebarClusterChange = (e) => {
    const name = e.target.value;
    syncAllClusterKeys(name);
    const sp = new URLSearchParams(location.search);
    sp.set("cluster", name);
    navigate(
      { pathname: location.pathname, search: `?${sp.toString()}` },
      { replace: true }
    );
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("elkwatch.theme");
      if (saved === "light" || saved === "dark" || saved === "charcoal") {
        setTheme(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("elkwatch.theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      const saved = parseInt(
        window.localStorage.getItem("elkwatch.refreshIntervalMs") || "0",
        10
      );
      if ([0, 30000, 60000, 300000].includes(saved)) {
        setRefreshIntervalMs(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "elkwatch.refreshIntervalMs",
        String(refreshIntervalMs)
      );
    } catch {
      // ignore
    }
  }, [refreshIntervalMs]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") {
        refreshAuto();
      }
    };
    const id = window.setInterval(tick, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refreshIntervalMs, refreshAuto]);

  const intervalLabel = useMemo(() => {
    if (refreshIntervalMs === 30000) return "30s";
    if (refreshIntervalMs === 60000) return "1m";
    if (refreshIntervalMs === 300000) return "5m";
    return "Off";
  }, [refreshIntervalMs]);

  const toWithCluster = (path) => {
    if (!sidebarCluster) return path;
    return `${path}?cluster=${encodeURIComponent(sidebarCluster)}`;
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-accent">Elk</span>watch
          </span>
        </div>
        <div className="sidebar-section-label">Monitor</div>
        <nav className="app-sidebar-nav">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconOverview />
            <span>Overview</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/indices")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconIndices />
            <span>Indices</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/ilm")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconILM />
            <span>ILM</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/alerts")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconAlerts />
            <span>Alerts</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/nodes")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconNodes />
            <span>Nodes</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/templates")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            <IconTemplates />
            <span>Templates</span>
          </NavLink>
        </nav>
        {clusterNames.length > 0 && (
          <div className="app-sidebar-footer">
            <label
              className="app-sidebar-footer-label"
              htmlFor="sidebar-active-cluster"
            >
              Active cluster
            </label>
            <div className="app-sidebar-cluster-row">
              <span
                className={`app-sidebar-cluster-dot ${clusterStatusDotClass(
                  clusterRow?.status
                )}`}
                title={
                  clusterRow?.status
                    ? `Cluster status: ${clusterRow.status}`
                    : undefined
                }
              />
              <select
                id="sidebar-active-cluster"
                className="select-elk app-sidebar-cluster-select"
                value={sidebarCluster}
                onChange={onSidebarClusterChange}
              >
                {clusterNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </aside>
      <main className="app-main">
        <Toasts />
        <div className="app-topbar">
          <div className="app-topbar-left">
            <button
              type="button"
              className="btn btn-secondary app-refresh-btn"
              onClick={() => refreshNow()}
              title="Refresh current page"
            >
              Refresh
            </button>
          </div>
          <div className="app-topbar-right">
            <label className="app-topbar-label" htmlFor="refresh-interval">
              Auto-refresh
            </label>
            <select
              id="refresh-interval"
              className="select-elk app-theme-select"
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(parseInt(e.target.value, 10))}
              title={`Auto-refresh: ${intervalLabel}`}
            >
              <option value={0}>Off</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
              <option value={300000}>5m</option>
            </select>
            <label className="app-topbar-label" htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              className="select-elk app-theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="charcoal">Charcoal</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/indices" element={<Indices />} />
          <Route path="/ilm" element={<ILM />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/templates" element={<Templates />} />
        </Routes>
      </main>
    </div>
  );
}
