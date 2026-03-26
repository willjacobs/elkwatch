import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Overview from "./pages/Overview.jsx";
import Indices from "./pages/Indices.jsx";
import ILM from "./pages/ILM.jsx";
import Alerts from "./pages/Alerts.jsx";
import Nodes from "./pages/Nodes.jsx";
import Templates from "./pages/Templates.jsx";
import { useGlobalRefreshController } from "./hooks/useGlobalRefresh.js";
import Toasts from "./components/Toasts.jsx";

export default function App() {
  const [theme, setTheme] = useState("dark");
  const { refreshNow, refreshAuto } = useGlobalRefreshController();
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("elkwatch.theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
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

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-accent">Elk</span>watch
        </div>
        <nav className="app-sidebar-nav">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/indices"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            Indices
          </NavLink>
          <NavLink
            to="/ilm"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            ILM
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            Alerts
          </NavLink>
          <NavLink
            to="/nodes"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            Nodes
          </NavLink>
          <NavLink
            to="/templates"
            className={({ isActive }) =>
              `app-sidebar-item${isActive ? " app-sidebar-item--active" : ""}`
            }
          >
            Templates
          </NavLink>
        </nav>
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
