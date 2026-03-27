import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.1.0";

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
  const dragRef = useRef({ active: false, startX: 0, startW: 0 });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);

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
    try {
      const c = window.localStorage.getItem("elkwatch.sidebar.collapsed");
      if (c === "1") setSidebarCollapsed(true);
      const w = parseInt(window.localStorage.getItem("elkwatch.sidebar.width") || "", 10);
      if (Number.isFinite(w) && w >= 180 && w <= 360) setSidebarWidth(w);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("elkwatch.sidebar.collapsed", sidebarCollapsed ? "1" : "0");
      window.localStorage.setItem("elkwatch.sidebar.width", String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed, sidebarWidth]);

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

  const effectiveSidebarWidth = sidebarCollapsed ? 72 : sidebarWidth;

  const onStartResize = (e) => {
    if (sidebarCollapsed) return;
    dragRef.current = { active: true, startX: e.clientX, startW: sidebarWidth };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const next = Math.max(180, Math.min(360, dragRef.current.startW + dx));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div
      className="app-layout"
      style={{ "--sidebar-current-width": `${effectiveSidebarWidth}px` }}
    >
      <aside
        className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}
        style={{ width: effectiveSidebarWidth, maxWidth: effectiveSidebarWidth }}
      >
        <div className="sidebar-brand">
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-accent">Elk</span>watch
          </span>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="app-sidebar-nav">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "Overview" : undefined}
          >
            <IconOverview />
            <span>Overview</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/indices")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "Indices" : undefined}
          >
            <IconIndices />
            <span>Indices</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/ilm")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "ILM" : undefined}
          >
            <IconILM />
            <span>ILM</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/alerts")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "Alerts" : undefined}
          >
            <IconAlerts />
            <span>Alerts</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/nodes")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "Nodes" : undefined}
          >
            <IconNodes />
            <span>Nodes</span>
          </NavLink>
          <NavLink
            to={toWithCluster("/templates")}
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
            title={sidebarCollapsed ? "Templates" : undefined}
          >
            <IconTemplates />
            <span>Templates</span>
          </NavLink>
        </nav>
        <div
          className={`sidebar-resizer${sidebarCollapsed ? " sidebar-resizer--disabled" : ""}`}
          onMouseDown={onStartResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      </aside>
      {!sidebarCollapsed && clusterNames.length > 0 && (
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
          <div className="app-sidebar-footer-controls">
            <div className="cluster-select app-sidebar-control">
              <label htmlFor="refresh-interval-footer">Auto-refresh</label>
              <select
                id="refresh-interval-footer"
                className="select-elk app-sidebar-cluster-select"
                value={refreshIntervalMs}
                onChange={(e) => setRefreshIntervalMs(parseInt(e.target.value, 10))}
                title={`Auto-refresh: ${intervalLabel}`}
              >
                <option value={0}>Off</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
            </div>
            <div className="cluster-select app-sidebar-control">
              <label htmlFor="theme-select-footer">Theme</label>
              <select
                id="theme-select-footer"
                className="select-elk app-sidebar-cluster-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="dark">Dark</option>
                <option value="charcoal">Charcoal</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
          <div className="app-sidebar-version" title="Application version">
            v{APP_VERSION}
          </div>
        </div>
      )}
      <main className="app-main">
        <Toasts />
        <div className="app-topbar">
          <button
            type="button"
            className="btn btn-secondary app-refresh-icon-btn"
            onClick={() => refreshNow()}
            title="Refresh current page"
            aria-label="Refresh current page"
          >
            ↻
          </button>
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
