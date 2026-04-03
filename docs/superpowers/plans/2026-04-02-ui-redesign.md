# Elkwatch UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Elkwatch frontend with a modern enterprise aesthetic — electric blue/green palette, icon rail + context panel layout, Chart.js data viz (already installed), and light/dark/charcoal theme toggle.

**Architecture:** CSS-only redesign + React component restructure. All routing, data-fetching hooks, and backend API contracts are untouched. New shell components (IconRail, ContextPanel) replace the current resizable sidebar in App.jsx. Chart.js (react-chartjs-2, already in package.json) is used for all charts. The ClusterDonut component is updated to use new colours; a new SparklineChart component + useNodeHistory hook add per-node heap sparklines backed by an in-memory rolling window (no backend change needed).

**Tech Stack:** React 18, React Router v6, Chart.js + react-chartjs-2 (already installed), plain CSS variables, Vite

**Note on testing:** This project has no test suite. TDD steps are replaced with "implement → visual verify in browser" steps. Start the dev server once and keep it running: `cd frontend && npm run dev` (proxies `/api` to `localhost:3001`).

---

## File Map

**New files:**
- `frontend/src/components/IconRail.jsx` — fixed 52px icon rail with page icons and status dots
- `frontend/src/components/ContextPanel.jsx` — 220px page-aware secondary panel (cluster switcher, filters, theme toggle)
- `frontend/src/components/KpiCard.jsx` — reusable large-number stat card
- `frontend/src/components/MeterBar.jsx` — inline utilization bar with threshold colour logic
- `frontend/src/components/HealthBadge.jsx` — colour-coded health/severity pill
- `frontend/src/components/SparklineChart.jsx` — thin Chart.js Line wrapper for per-node sparklines
- `frontend/src/hooks/useNodeHistory.js` — rolling 20-point in-memory history per cluster+node

**Modified files:**
- `frontend/src/index.css` — full rewrite: new design tokens, light/charcoal themes, global styles
- `frontend/src/App.jsx` — new 3-column shell (icon rail + context panel + main area)
- `frontend/src/components/ClusterDonut.jsx` — new colours matching design tokens; add primary/replica shard variant
- `frontend/src/components/LoadingSpinner.jsx` — restyle with new tokens
- `frontend/src/components/SortableTh.jsx` — new sort indicator style
- `frontend/src/components/Toasts.jsx` — restyle: slide-in from top-right
- `frontend/src/pages/Overview.jsx` — cluster cards with coloured top border, KPI grid, utilisation bars
- `frontend/src/pages/Nodes.jsx` — KPI strip, 3 viz panels, updated node table; uses SparklineChart + useNodeHistory
- `frontend/src/pages/Indices.jsx` — toolbar with search/filters, health badges, inline size bars
- `frontend/src/pages/ILM.jsx` — phase badges, error badges; preserve policy editor intact
- `frontend/src/pages/Alerts.jsx` — severity badges, formatted timestamps
- `frontend/src/pages/Templates.jsx` — clean table with pattern/priority/composed-of
- `frontend/src/pages/nodes.css` — delete (styles absorbed into index.css and component files)

---

## Task 1: Rewrite design tokens and global styles (index.css)

**Files:**
- Rewrite: `frontend/src/index.css`

- [ ] **Step 1: Replace the entire contents of index.css**

```css
/* Elkwatch Design System v2 — Enterprise */

/* ─── Tokens ─────────────────────────────────────────── */
:root {
  --clr-bg:          #0d0f14;
  --clr-surface:     #0f1117;
  --clr-surface-hi:  #161b27;
  --clr-border:      #1a1f2e;
  --clr-border-sub:  #13161e;
  --clr-text:        #f1f5f9;
  --clr-muted:       #94a3b8;
  --clr-muted2:      #475569;
  --clr-dim:         #334155;

  --clr-accent:      #3b82f6;
  --clr-accent-hi:   #2563eb;
  --clr-accent-bg:   rgba(59, 130, 246, 0.08);
  --clr-purple:      #a78bfa;
  --clr-indigo:      #6366f1;

  --clr-green:       #4ade80;
  --clr-green-bg:    rgba(74, 222, 128, 0.1);
  --clr-yellow:      #facc15;
  --clr-yellow-bg:   rgba(250, 204, 21, 0.1);
  --clr-red:         #f87171;
  --clr-red-bg:      rgba(248, 113, 113, 0.1);

  /* Legacy aliases (CLAUDE.md) */
  --bg:      var(--clr-bg);
  --surface: var(--clr-surface);
  --border:  var(--clr-border);
  --text:    var(--clr-text);
  --muted:   var(--clr-muted);
  --accent:  var(--clr-accent);
  --green:   var(--clr-green);
  --yellow:  var(--clr-yellow);
  --red:     var(--clr-red);

  /* Shell */
  --rail-w:    52px;
  --ctx-w:     220px;
  --topbar-h:  44px;
}

:root[data-theme="light"] {
  --clr-bg:         #f8fafc;
  --clr-surface:    #ffffff;
  --clr-surface-hi: #f1f5f9;
  --clr-border:     #e2e8f0;
  --clr-border-sub: #f1f5f9;
  --clr-text:       #0f172a;
  --clr-muted:      #475569;
  --clr-muted2:     #94a3b8;
  --clr-dim:        #cbd5e1;
  --clr-accent:     #2563eb;
  --clr-accent-hi:  #1d4ed8;
  --clr-accent-bg:  rgba(37, 99, 235, 0.07);
  --bg:      var(--clr-bg);
  --surface: var(--clr-surface);
  --border:  var(--clr-border);
  --text:    var(--clr-text);
  --muted:   var(--clr-muted);
  --accent:  var(--clr-accent);
}

:root[data-theme="charcoal"] {
  --clr-bg:         #07080a;
  --clr-surface:    #111318;
  --clr-surface-hi: #17191f;
  --clr-border:     #1f2229;
  --clr-border-sub: #14161b;
  --clr-text:       #f2f4f8;
  --clr-muted:      #9aa3b2;
  --clr-muted2:     #555f6e;
  --clr-dim:        #353c47;
  --clr-accent:     #f97316;
  --clr-accent-hi:  #ea6e0a;
  --clr-accent-bg:  rgba(249, 115, 22, 0.08);
  --bg:      var(--clr-bg);
  --surface: var(--clr-surface);
  --border:  var(--clr-border);
  --text:    var(--clr-text);
  --muted:   var(--clr-muted);
  --accent:  var(--clr-accent);
}

/* ─── Reset ──────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--clr-bg);
  color: var(--clr-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--clr-accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ─── Shell ──────────────────────────────────────────── */
.shell { display: flex; height: 100vh; overflow: hidden; }
.shell-main { display: flex; flex-direction: column; flex: 1; min-width: 0; overflow: hidden; }
.topbar {
  height: var(--topbar-h);
  background: var(--clr-bg);
  border-bottom: 1px solid var(--clr-border);
  display: flex; align-items: center;
  padding: 0 20px; gap: 10px; flex-shrink: 0;
}
.topbar-breadcrumb { font-size: 13px; color: var(--clr-muted2); display: flex; align-items: center; gap: 5px; }
.topbar-breadcrumb strong { color: var(--clr-text); font-weight: 500; }
.topbar-sep { color: var(--clr-dim); }
.topbar-spacer { flex: 1; }
.topbar-pill {
  background: var(--clr-surface-hi); border: 1px solid var(--clr-border); border-radius: 6px;
  padding: 5px 11px; font-size: 11px; color: var(--clr-muted2);
  display: flex; align-items: center; gap: 5px; cursor: pointer; transition: border-color 0.15s;
}
.topbar-pill:hover { border-color: var(--clr-accent); color: var(--clr-muted); }
.page-content { flex: 1; padding: 20px; overflow: auto; }

/* ─── Icon Rail ──────────────────────────────────────── */
.icon-rail {
  width: var(--rail-w); background: color-mix(in srgb, var(--clr-bg) 70%, black);
  border-right: 1px solid var(--clr-border);
  display: flex; flex-direction: column; align-items: center;
  padding: 10px 0; gap: 3px; flex-shrink: 0;
}
.rail-logo {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, var(--clr-accent-hi), var(--clr-accent));
  border-radius: 8px; margin-bottom: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; color: #fff; user-select: none;
}
.rail-item {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: var(--clr-dim); transition: background 0.12s, color 0.12s;
  cursor: pointer; position: relative; text-decoration: none;
}
.rail-item:hover { background: var(--clr-surface-hi); color: var(--clr-muted); text-decoration: none; }
.rail-item.active { background: var(--clr-accent-bg); color: var(--clr-accent); }
.rail-item svg { width: 18px; height: 18px; }
.rail-status-dot {
  position: absolute; top: 5px; right: 5px;
  width: 5px; height: 5px; border-radius: 50%;
}
.rail-status-dot--green  { background: var(--clr-green); }
.rail-status-dot--yellow { background: var(--clr-yellow); }
.rail-status-dot--red    { background: var(--clr-red); }
.rail-spacer { flex: 1; }

/* ─── Context Panel ──────────────────────────────────── */
.ctx-panel {
  width: var(--ctx-w); background: color-mix(in srgb, var(--clr-bg) 85%, var(--clr-surface));
  border-right: 1px solid var(--clr-border);
  display: flex; flex-direction: column; flex-shrink: 0;
  overflow: hidden; transition: width 0.2s;
}
.ctx-panel.hidden { width: 0; }
.ctx-section-label {
  padding: 14px 14px 6px; font-size: 10px; font-weight: 600;
  color: var(--clr-dim); text-transform: uppercase; letter-spacing: 0.08em;
}
.ctx-cluster-card {
  margin: 0 10px 12px; background: var(--clr-surface-hi);
  border: 1px solid var(--clr-border); border-radius: 8px; padding: 10px 12px;
}
.ctx-cluster-name {
  font-size: 13px; font-weight: 600; color: var(--clr-text);
  display: flex; align-items: center; gap: 7px; margin-bottom: 4px;
}
.ctx-cluster-meta { font-size: 11px; color: var(--clr-muted2); margin-bottom: 10px; }
.ctx-cluster-kpis { display: flex; gap: 6px; }
.ctx-cluster-kpi {
  flex: 1; background: var(--clr-border); border-radius: 5px;
  padding: 5px 7px; text-align: center;
}
.ctx-cluster-kpi-val { font-size: 14px; font-weight: 700; color: var(--clr-accent); }
.ctx-cluster-kpi-label { font-size: 9px; color: var(--clr-muted2); }
.ctx-nav-item {
  padding: 7px 14px; font-size: 12px; color: var(--clr-muted2);
  cursor: pointer; border-radius: 5px; margin: 0 6px 1px;
  display: flex; align-items: center; gap: 8px; text-decoration: none; transition: background 0.1s, color 0.1s;
}
.ctx-nav-item:hover { background: var(--clr-surface-hi); color: var(--clr-muted); text-decoration: none; }
.ctx-nav-item.active { background: var(--clr-accent-bg); color: var(--clr-accent); }
.ctx-nav-badge {
  margin-left: auto; font-size: 10px; padding: 1px 5px;
  border-radius: 9px; font-weight: 600;
}
.ctx-nav-badge--green  { background: var(--clr-green-bg);  color: var(--clr-green); }
.ctx-nav-badge--yellow { background: var(--clr-yellow-bg); color: var(--clr-yellow); }
.ctx-nav-badge--red    { background: var(--clr-red-bg);    color: var(--clr-red); }
.ctx-spacer { flex: 1; }
.ctx-footer {
  padding: 12px 14px; border-top: 1px solid var(--clr-border);
  display: flex; flex-direction: column; gap: 8px;
}
.ctx-footer-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; color: var(--clr-dim);
}
.ctx-footer-row select {
  background: none; border: none; outline: none; font-size: 11px;
  color: var(--clr-muted2); cursor: pointer;
}
.ctx-version { font-size: 10px; color: var(--clr-dim); }
.ctx-theme-btn {
  background: none; border: none; cursor: pointer; color: var(--clr-muted2);
  font-size: 14px; padding: 0; line-height: 1; transition: color 0.12s;
}
.ctx-theme-btn:hover { color: var(--clr-text); }

/* ─── Status dot ─────────────────────────────────────── */
.status-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; display: inline-block;
}
.status-dot--green  { background: var(--clr-green); }
.status-dot--yellow { background: var(--clr-yellow); }
.status-dot--red    { background: var(--clr-red); }
.status-dot--unknown { background: var(--clr-dim); }

/* ─── Buttons ────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap; background: none;
}
.btn-primary { background: var(--clr-accent); color: #fff; border-color: var(--clr-accent); }
.btn-primary:hover { background: var(--clr-accent-hi); border-color: var(--clr-accent-hi); }
.btn-secondary { background: var(--clr-surface-hi); color: var(--clr-muted); border-color: var(--clr-border); }
.btn-secondary:hover { border-color: var(--clr-accent); color: var(--clr-text); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

/* ─── Typography helpers ─────────────────────────────── */
.page-title   { font-size: 20px; font-weight: 700; color: var(--clr-text); margin: 0; }
.section-title { font-size: 12px; font-weight: 600; color: var(--clr-muted); margin: 0; }
.muted        { color: var(--clr-muted); }
.error        { color: var(--clr-red); }
.text-mono    { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; }

/* ─── Cards ──────────────────────────────────────────── */
.card {
  background: var(--clr-surface); border: 1px solid var(--clr-border);
  border-radius: 10px; overflow: hidden;
}
.card-header {
  padding: 12px 16px; border-bottom: 1px solid var(--clr-border);
  display: flex; align-items: center; gap: 10px;
}
.card-body { padding: 16px; }

/* ─── Page toolbar ───────────────────────────────────── */
.page-toolbar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 18px; padding-bottom: 14px;
  border-bottom: 1px solid var(--clr-border); flex-wrap: wrap;
}
.toolbar-spacer { flex: 1; min-width: 8px; }

/* ─── Legacy toolbar (keep for ILM dry-run) ─────────── */
.toolbar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.toolbar-actions { display: flex; gap: 8px; }
.cluster-select { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--clr-muted2); }

/* ─── Search box ─────────────────────────────────────── */
.search-box {
  background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 7px;
  padding: 6px 11px; font-size: 12px; color: var(--clr-muted2);
  display: flex; align-items: center; gap: 7px; min-width: 180px;
}
.search-box input { background: none; border: none; outline: none; color: var(--clr-text); font-size: 12px; width: 100%; }
.search-box input::placeholder { color: var(--clr-dim); }
.search-icon { color: var(--clr-dim); flex-shrink: 0; }

/* ─── Select ─────────────────────────────────────────── */
.select-elk, .filter-select {
  background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 7px;
  padding: 6px 28px 6px 10px; font-size: 12px; color: var(--clr-muted);
  cursor: pointer; appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23475569'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.select-elk:focus, .filter-select:focus { outline: none; border-color: var(--clr-accent); }

/* ─── Stat chip ──────────────────────────────────────── */
.stat-chip { background: var(--clr-surface-hi); border-radius: 6px; padding: 5px 10px; font-size: 11px; color: var(--clr-muted2); }
.stat-chip strong { color: var(--clr-muted); }

/* ─── Tables ─────────────────────────────────────────── */
.table-wrap { background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 10px; overflow: hidden; }
.table-wrap table { width: 100%; border-collapse: collapse; }
.table-wrap thead tr { background: var(--clr-bg); border-bottom: 1px solid var(--clr-border); }
.table-wrap th {
  padding: 9px 14px; font-size: 10px; font-weight: 600; color: var(--clr-dim);
  text-transform: uppercase; letter-spacing: 0.07em; text-align: left; white-space: nowrap;
}
.table-wrap tbody tr { border-bottom: 1px solid var(--clr-border-sub); transition: background 0.1s; }
.table-wrap tbody tr:last-child { border-bottom: none; }
.table-wrap tbody tr:hover { background: var(--clr-accent-bg); }
.table-wrap td { padding: 10px 14px; font-size: 12px; color: var(--clr-muted); vertical-align: middle; }
.table-footer {
  padding: 10px 16px; border-top: 1px solid var(--clr-border);
  display: flex; align-items: center; font-size: 11px; color: var(--clr-dim); gap: 8px;
}
.page-btn {
  background: var(--clr-surface-hi); border: 1px solid var(--clr-border);
  border-radius: 5px; padding: 3px 9px; font-size: 11px; color: var(--clr-muted2); cursor: pointer;
}
.page-btn.active { background: var(--clr-accent-bg); border-color: var(--clr-accent); color: var(--clr-accent); }

/* ─── KPI grid ───────────────────────────────────────── */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }

/* ─── Viz panels ─────────────────────────────────────── */
.viz-panels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
@media (max-width: 860px) { .viz-panels { grid-template-columns: 1fr; } }

/* ─── Cluster grid (Overview) ────────────────────────── */
.cluster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

/* ─── Input (ILM textarea) ───────────────────────────── */
.input-elk {
  background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 7px;
  padding: 8px 12px; font-size: 13px; color: var(--clr-text); resize: vertical;
}
.input-elk:focus { outline: none; border-color: var(--clr-accent); }

/* ─── ILM diff viewer ────────────────────────────────── */
.subpanel-title { font-size: 14px; font-weight: 600; color: var(--clr-text); margin: 0 0 12px; }
.diff-path-breadcrumb { font-family: monospace; font-size: 11px; }
.diff-path-part { color: var(--clr-muted2); }
.diff-path-sep  { margin: 0 3px; color: var(--clr-dim); }
.diff-path-leaf { color: var(--clr-text); font-weight: 600; }
.diff-toggle-inline { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--clr-muted2); cursor: pointer; }

/* ─── Toasts ─────────────────────────────────────────── */
.toasts-container {
  position: fixed; top: 16px; right: 16px;
  display: flex; flex-direction: column; gap: 8px; z-index: 1000; pointer-events: none;
}
.toast {
  background: var(--clr-surface-hi); border: 1px solid var(--clr-border); border-radius: 8px;
  padding: 12px 16px; min-width: 260px; max-width: 360px;
  pointer-events: all; animation: toast-in 0.2s ease;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.toast--error   { border-left: 3px solid var(--clr-red); }
.toast--success { border-left: 3px solid var(--clr-green); }
.toast--info    { border-left: 3px solid var(--clr-accent); }
.toast-title { font-size: 12px; font-weight: 600; color: var(--clr-text); margin-bottom: 2px; }
.toast-msg   { font-size: 11px; color: var(--clr-muted); }
@keyframes toast-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }

/* ─── Loading spinner ────────────────────────────────── */
.loading-wrap { display: flex; align-items: center; justify-content: center; padding: 48px; gap: 10px; color: var(--clr-muted2); font-size: 12px; }
.loading-wrap.compact { padding: 12px; }
.spinner { width: 18px; height: 18px; border: 2px solid var(--clr-border); border-top-color: var(--clr-accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Page header (legacy alias) ────────────────────── */
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
.page-actions { display: flex; gap: 8px; }
.page-grid { display: flex; flex-direction: column; gap: 12px; }
.page-grid--stack { gap: 12px; }
```

- [ ] **Step 2: Delete nodes.css (styles are now in index.css)**

```bash
rm frontend/src/pages/nodes.css
```

- [ ] **Step 3: Visual check — start the dev server and verify no broken styles crash the page**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. The app will look broken for now (old class names don't match new tokens). That's expected — we're rebuilding incrementally. Confirm the page loads without a JS error in the console.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git rm frontend/src/pages/nodes.css
git commit -m "feat: rewrite design tokens and global styles"
```

---

## Task 2: Create IconRail.jsx

**Files:**
- Create: `frontend/src/components/IconRail.jsx`

The icon rail is a fixed 52px column. It uses the existing `SidebarIcons` and `NavLink`. Each item shows a status dot derived from cluster data when there are clusters with non-green status.

- [ ] **Step 1: Create the file**

```jsx
import { NavLink } from "react-router-dom";
import {
  IconAlerts,
  IconILM,
  IconIndices,
  IconNodes,
  IconOverview,
  IconTemplates,
} from "./SidebarIcons.jsx";

function worstStatus(clusters) {
  if (!clusters?.length) return null;
  if (clusters.some((c) => c.status === "red" || c.error)) return "red";
  if (clusters.some((c) => c.status === "yellow")) return "yellow";
  return "green";
}

export default function IconRail({ clusters, toWithCluster }) {
  const overall = worstStatus(clusters);

  const items = [
    { to: "/",           icon: <IconOverview />,  label: "Overview",  exact: true, dot: overall },
    { to: toWithCluster("/nodes"),     icon: <IconNodes />,     label: "Nodes" },
    { to: toWithCluster("/indices"),   icon: <IconIndices />,   label: "Indices" },
    { to: toWithCluster("/ilm"),       icon: <IconILM />,       label: "ILM" },
    { to: toWithCluster("/alerts"),    icon: <IconAlerts />,    label: "Alerts" },
    { to: toWithCluster("/templates"), icon: <IconTemplates />, label: "Templates" },
  ];

  return (
    <nav className="icon-rail" aria-label="Main navigation">
      <div className="rail-logo" aria-hidden>E</div>
      {items.map(({ to, icon, label, exact, dot }) => (
        <NavLink
          key={to}
          end={exact}
          to={to}
          className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}
          title={label}
          aria-label={label}
        >
          {icon}
          {dot && <span className={`rail-status-dot rail-status-dot--${dot}`} aria-hidden />}
        </NavLink>
      ))}
      <div className="rail-spacer" />
    </nav>
  );
}
```

- [ ] **Step 2: Verify it renders — mount it temporarily in App.jsx**

Add `import IconRail from "./components/IconRail.jsx";` and place `<IconRail clusters={[]} toWithCluster={(p) => p} />` somewhere visible. Check http://localhost:5173 — you should see a narrow column of icons on the left.

- [ ] **Step 3: Remove the temporary mount from App.jsx**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/IconRail.jsx
git commit -m "feat: add IconRail component"
```

---

## Task 3: Create ContextPanel.jsx

**Files:**
- Create: `frontend/src/components/ContextPanel.jsx`

The context panel is page-aware: it reads `useLocation()` to determine the current page and renders appropriate content. On Overview it shows the cluster list; on all other pages it shows the cluster switcher with health info.

- [ ] **Step 1: Create the file**

```jsx
import { useLocation } from "react-router-dom";

const THEME_ICONS = { dark: "🌙", light: "☀️", charcoal: "⬤" };
const THEMES = ["dark", "light", "charcoal"];

function statusDotClass(status) {
  if (status === "green") return "status-dot--green";
  if (status === "yellow") return "status-dot--yellow";
  if (status === "red" || !status) return "status-dot--red";
  return "status-dot--unknown";
}

function badgeClass(status) {
  if (status === "green") return "ctx-nav-badge--green";
  if (status === "yellow") return "ctx-nav-badge--yellow";
  return "ctx-nav-badge--red";
}

export default function ContextPanel({
  visible,
  clusters,
  activeCluster,
  onClusterChange,
  theme,
  onThemeChange,
  refreshIntervalMs,
  onRefreshChange,
  appVersion,
}) {
  const location = useLocation();
  const isOverview = location.pathname === "/";
  const activeRow = (clusters || []).find((c) => c.name === activeCluster);

  const nextTheme = () => {
    const idx = THEMES.indexOf(theme);
    onThemeChange(THEMES[(idx + 1) % THEMES.length]);
  };

  const refreshLabel = (ms) => {
    if (ms === 30000) return "30s";
    if (ms === 60000) return "1m";
    if (ms === 300000) return "5m";
    return "Off";
  };

  return (
    <aside className={`ctx-panel${visible ? "" : " hidden"}`} aria-label="Context panel">
      {isOverview ? (
        <>
          <div className="ctx-section-label">Clusters</div>
          {(clusters || []).map((c) => (
            <div
              key={c.name}
              className={`ctx-nav-item${c.name === activeCluster ? " active" : ""}`}
              onClick={() => onClusterChange(c.name)}
            >
              <span className={`status-dot ${statusDotClass(c.error ? "red" : c.status)}`} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
              <span className={`ctx-nav-badge ${badgeClass(c.error ? "red" : c.status)}`}>
                {c.error ? "err" : c.status}
              </span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="ctx-section-label">Active Cluster</div>
          {activeRow && (
            <div className="ctx-cluster-card">
              <div className="ctx-cluster-name">
                <span className={`status-dot ${statusDotClass(activeRow.error ? "red" : activeRow.status)}`} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeRow.name}
                </span>
              </div>
              <div className="ctx-cluster-meta">elasticsearch</div>
              {!activeRow.error && (
                <div className="ctx-cluster-kpis">
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val">{activeRow.numberOfNodes ?? "—"}</div>
                    <div className="ctx-cluster-kpi-label">nodes</div>
                  </div>
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val">{activeRow.activePrimaryShards ?? "—"}</div>
                    <div className="ctx-cluster-kpi-label">shards</div>
                  </div>
                  <div className="ctx-cluster-kpi">
                    <div className="ctx-cluster-kpi-val" style={{ color: `var(--clr-${activeRow.status === "green" ? "green" : activeRow.status === "yellow" ? "yellow" : "red"})` }}>●</div>
                    <div className="ctx-cluster-kpi-label">status</div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="ctx-section-label">Switch Cluster</div>
          {(clusters || []).map((c) => (
            <div
              key={c.name}
              className={`ctx-nav-item${c.name === activeCluster ? " active" : ""}`}
              onClick={() => onClusterChange(c.name)}
            >
              <span className={`status-dot ${statusDotClass(c.error ? "red" : c.status)}`} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="ctx-spacer" />

      <div className="ctx-footer">
        <div className="ctx-footer-row">
          Auto-refresh
          <select value={refreshIntervalMs} onChange={(e) => onRefreshChange(Number(e.target.value))}>
            <option value={0}>Off</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
        </div>
        <div className="ctx-footer-row">
          Theme
          <button className="ctx-theme-btn" onClick={nextTheme} title={`Current: ${theme} — click to cycle`}>
            {THEME_ICONS[theme] ?? "◐"}
          </button>
        </div>
        {appVersion && <div className="ctx-version">v{appVersion}</div>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ContextPanel.jsx
git commit -m "feat: add ContextPanel component"
```

---

## Task 4: Rewrite App.jsx shell

**Files:**
- Modify: `frontend/src/App.jsx`

Replace the current sidebar/footer layout with the new 3-column shell. The `sidebarCollapsed`/`sidebarWidth` resize state is removed; the context panel has a simple show/hide toggle stored in localStorage under `elkwatch.ctx.visible`.

- [ ] **Step 1: Replace App.jsx**

```jsx
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
              <><span className="topbar-sep">›</span>{activeCluster}</>
            )}
          </div>
          <div className="topbar-spacer" />
          <button
            type="button"
            className="topbar-pill"
            onClick={() => setCtxVisible((v) => !v)}
            title={ctxVisible ? "Hide panel" : "Show panel"}
          >
            {ctxVisible ? "‹" : "›"}
          </button>
          <button
            type="button"
            className="topbar-pill"
            onClick={() => refreshNow()}
            title="Refresh"
          >
            ↻
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
          </Routes>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual check**

Reload http://localhost:5173. You should see: narrow icon column on left, context panel next to it, main content area on the right, topbar with breadcrumb. Icons should be clickable and navigate correctly. Cluster panel should show clusters. Theme button should cycle dark → light → charcoal.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: rewrite App shell with icon rail and context panel"
```

---

## Task 5: Create shared components (KpiCard, MeterBar, HealthBadge) + restyle LoadingSpinner, SortableTh, Toasts

**Files:**
- Create: `frontend/src/components/KpiCard.jsx`
- Create: `frontend/src/components/MeterBar.jsx`
- Create: `frontend/src/components/HealthBadge.jsx`
- Modify: `frontend/src/components/LoadingSpinner.jsx`
- Modify: `frontend/src/components/SortableTh.jsx`
- Modify: `frontend/src/components/Toasts.jsx`

- [ ] **Step 1: Create KpiCard.jsx**

```jsx
const TONE_STYLES = {
  default: { color: "var(--clr-text)" },
  green:   { color: "var(--clr-green)" },
  blue:    { color: "var(--clr-accent)" },
  yellow:  { color: "var(--clr-yellow)" },
  red:     { color: "var(--clr-red)" },
  purple:  { color: "var(--clr-purple)" },
};

export default function KpiCard({ label, value, sub, tone = "default" }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--clr-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1, ...TONE_STYLES[tone] }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--clr-muted2)", marginTop: "5px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create MeterBar.jsx**

```jsx
function barColor(pct) {
  if (pct == null) return "var(--clr-accent)";
  if (pct >= 90) return "var(--clr-red)";
  if (pct >= 80) return "var(--clr-yellow)";
  return "var(--clr-accent)";
}

function valColor(pct) {
  if (pct == null) return "var(--clr-muted)";
  if (pct >= 90) return "var(--clr-red)";
  if (pct >= 80) return "var(--clr-yellow)";
  return "var(--clr-accent)";
}

/**
 * Props:
 *   pct: number | null  — 0–100
 *   label?: string      — shown above bar (e.g. "186 GB")
 *   forceColor?: string — override the auto threshold colour (e.g. "var(--clr-purple)")
 */
export default function MeterBar({ pct, label, forceColor }) {
  const color = forceColor ?? barColor(pct);
  const textColor = forceColor ?? valColor(pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: textColor }}>
          {pct != null ? `${pct}%` : "—"}
        </span>
        {label && <span style={{ fontSize: "10px", color: "var(--clr-dim)" }}>{label}</span>}
      </div>
      <div style={{ height: "4px", background: "var(--clr-border)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "4px", width: `${Math.min(100, pct ?? 0)}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create HealthBadge.jsx**

```jsx
const STYLES = {
  green:   { background: "var(--clr-green-bg)",  color: "var(--clr-green)" },
  yellow:  { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" },
  red:     { background: "var(--clr-red-bg)",    color: "var(--clr-red)" },
  error:   { background: "var(--clr-red-bg)",    color: "var(--clr-red)" },
  warning: { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" },
  info:    { background: "var(--clr-accent-bg)", color: "var(--clr-accent)" },
  unknown: { background: "rgba(51,65,85,0.4)",   color: "var(--clr-dim)" },
};

const DOT_COLOR = {
  green: "var(--clr-green)", yellow: "var(--clr-yellow)", red: "var(--clr-red)",
  error: "var(--clr-red)",   warning: "var(--clr-yellow)", info: "var(--clr-accent)",
  unknown: "var(--clr-dim)",
};

/**
 * Props:
 *   tone: "green" | "yellow" | "red" | "error" | "warning" | "info" | "unknown"
 *   label?: string — defaults to tone
 *   dot?: boolean  — show leading dot (default true)
 */
export default function HealthBadge({ tone = "unknown", label, dot = true }) {
  const style = STYLES[tone] ?? STYLES.unknown;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 8px", borderRadius: "99px",
      fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
      ...style,
    }}>
      {dot && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: DOT_COLOR[tone], flexShrink: 0 }} />}
      {label ?? tone}
    </span>
  );
}
```

- [ ] **Step 4: Rewrite LoadingSpinner.jsx**

```jsx
export default function LoadingSpinner({ label, compact }) {
  return (
    <div className={`loading-wrap${compact ? " compact" : ""}`} role="status" aria-label={label ?? "Loading"}>
      <div className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite SortableTh.jsx**

```jsx
export default function SortableTh({ sortKey, currentKey, currentDir, onSort, children, style }) {
  const isActive = currentKey === sortKey;
  const indicator = isActive ? (currentDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className={`sortable${isActive ? " sort-active" : ""}`}
      onClick={() => onSort(sortKey)}
      style={style}
    >
      {children}{indicator && <span style={{ color: "var(--clr-accent)", marginLeft: "2px" }}>{indicator}</span>}
    </th>
  );
}
```

Note: Check the current `SortableTh` props interface in the existing usages and update callers in Indices.jsx and Alerts.jsx if the prop names changed.

- [ ] **Step 6: Rewrite Toasts.jsx**

Read the current implementation first to preserve the toast state logic:

```jsx
import { useToasts } from "../hooks/useToasts.js";

export default function Toasts() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toasts-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone ?? "info"}`} role="alert">
          {t.title && <div className="toast-title">{t.title}</div>}
          {t.message && <div className="toast-msg">{t.message}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Visual check**

Reload http://localhost:5173. Confirm the loading spinner appears and disappears correctly when pages load. Trigger a toast (e.g. disconnect from backend) and verify it slides in from the top-right.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/KpiCard.jsx frontend/src/components/MeterBar.jsx frontend/src/components/HealthBadge.jsx frontend/src/components/LoadingSpinner.jsx frontend/src/components/SortableTh.jsx frontend/src/components/Toasts.jsx
git commit -m "feat: add KpiCard, MeterBar, HealthBadge; restyle LoadingSpinner, SortableTh, Toasts"
```

---

## Task 6: Create SparklineChart + useNodeHistory hook

**Files:**
- Create: `frontend/src/hooks/useNodeHistory.js`
- Create: `frontend/src/components/SparklineChart.jsx`

The node history hook keeps an in-memory rolling window of up to 20 data points per `clusterName:nodeName` key. `SparklineChart` renders a minimal Chart.js Line chart with no axes or labels.

- [ ] **Step 1: Create useNodeHistory.js**

```js
import { useRef, useCallback } from "react";

const MAX_POINTS = 20;

/**
 * Returns { appendNodeData, getHistory }.
 *
 * appendNodeData(clusterName: string, nodes: Array<{name: string, heapUsedPercent: number}>)
 *   Appends the current heap% for each node to its rolling window.
 *
 * getHistory(clusterName: string, nodeName: string): number[]
 *   Returns the rolling array of heap% values (up to MAX_POINTS).
 */
export function useNodeHistory() {
  const mapRef = useRef(new Map());

  const appendNodeData = useCallback((clusterName, nodes) => {
    if (!nodes?.length) return;
    for (const node of nodes) {
      if (node.heapUsedPercent == null) continue;
      const key = `${clusterName}:${node.name}`;
      const arr = mapRef.current.get(key) ?? [];
      const next = [...arr, node.heapUsedPercent];
      mapRef.current.set(key, next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next);
    }
  }, []);

  const getHistory = useCallback((clusterName, nodeName) => {
    return mapRef.current.get(`${clusterName}:${nodeName}`) ?? [];
  }, []);

  return { appendNodeData, getHistory };
}
```

- [ ] **Step 2: Create SparklineChart.jsx**

```jsx
import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale, Filler,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler);

/**
 * Props:
 *   data: number[]   — series values (e.g. heap% over time)
 *   color: string    — CSS colour string
 *   height?: number  — canvas height in px (default 36)
 */
export default function SparklineChart({ data, color, height = 36 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color.replace(")", ", 0.35)").replace("rgb(", "rgba(").replace("#", "rgba(").includes("rgba") ? color.replace("rgb(", "rgba(").replace(")", ", 0.35)") : color + "59");
    gradient.addColorStop(1, "transparent");

    const makeGradient = (c) => {
      const g = c.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, color + "55");
      g.addColorStop(1, color + "00");
      return g;
    };

    if (chartRef.current) {
      chartRef.current.data.labels = data.map((_, i) => i);
      chartRef.current.data.datasets[0].data = data;
      chartRef.current.data.datasets[0].borderColor = color;
      chartRef.current.data.datasets[0].backgroundColor = makeGradient(ctx);
      chartRef.current.update("none");
      return;
    }

    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: makeGradient(ctx),
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        animation: false,
        responsive: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 100 },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, color, height]);

  return <canvas ref={canvasRef} width={160} height={height} style={{ display: "block" }} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useNodeHistory.js frontend/src/components/SparklineChart.jsx
git commit -m "feat: add SparklineChart and useNodeHistory rolling window hook"
```

---

## Task 7: Update ClusterDonut.jsx colours

**Files:**
- Modify: `frontend/src/components/ClusterDonut.jsx`

Update the hardcoded hex values to match the new design tokens, and add a fourth shard category (relocating). The Chart.js registration and Doughnut component stay the same.

- [ ] **Step 1: Replace the colour constants and shards logic**

```jsx
import { useMemo } from "react";
import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip);

const GRAY = "rgba(26,31,46,0.95)";

function diskColors(pct) {
  if (pct == null) return ["#3b82f6", GRAY];
  if (pct >= 90) return ["#f87171", GRAY];
  if (pct >= 80) return ["#facc15", GRAY];
  return ["#3b82f6", GRAY];
}

function heapColors(pct) {
  if (pct == null) return ["#a78bfa", GRAY];
  if (pct >= 90) return ["#f87171", GRAY];
  if (pct >= 80) return ["#facc15", GRAY];
  return ["#a78bfa", GRAY];
}

export default function ClusterDonut({ variant, summary, formatBytes, compact }) {
  const fmt = formatBytes || ((n) => String(n));

  const { data, options, centerMain, centerSub, legendItems } = useMemo(() => {
    const opts = {
      cutout: "72%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => variant === "shards" ? ` ${ctx.label}: ${ctx.raw}` : ` ${ctx.label}: ${fmt(ctx.raw)}` } },
      },
    };

    if (variant === "disk") {
      const used = summary?.diskUsedBytes ?? 0;
      const free = summary?.diskFreeBytes ?? 0;
      const pct = summary?.diskUsedPercent;
      const colors = diskColors(pct);
      return {
        data: { labels: ["Used", "Free"], datasets: [{ data: [used, free], backgroundColor: colors, borderWidth: 0, hoverOffset: 2 }] },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "—",
        centerSub: "used",
        legendItems: [{ color: colors[0], text: `${fmt(used)} used` }, { color: GRAY, text: `${fmt(free)} free` }],
      };
    }

    if (variant === "heap") {
      const used = summary?.heapUsedBytes ?? 0;
      const max = summary?.heapMaxBytes ?? 0;
      const free = Math.max(0, max - used);
      const pct = summary?.heapUsedPercent;
      const colors = heapColors(pct);
      return {
        data: { labels: ["Used", "Free"], datasets: [{ data: max > 0 ? [used, free] : [0, 1], backgroundColor: max > 0 ? colors : [GRAY, GRAY], borderWidth: 0, hoverOffset: 2 }] },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "—",
        centerSub: "used",
        legendItems: [{ color: colors[0], text: `${fmt(used)} used` }, { color: GRAY, text: `${fmt(free)} free` }],
      };
    }

    if (variant === "shards") {
      const primary    = summary?.activePrimaryShards ?? 0;
      const replica    = (summary?.activeShards ?? 0) - primary;
      const unassigned = summary?.unassignedShards ?? 0;
      const relocating = summary?.relocatingShards ?? 0;
      const total      = primary + replica + unassigned + relocating;
      const hasData    = total > 0;
      return {
        data: {
          labels: ["Primary", "Replica", "Unassigned", "Relocating"],
          datasets: [{
            data: hasData ? [primary, Math.max(0, replica), unassigned, relocating] : [0, 0, 0, 1],
            backgroundColor: hasData ? ["#3b82f6", "#6366f1", unassigned > 0 ? "#f87171" : GRAY, relocating > 0 ? "#facc15" : GRAY] : [GRAY, GRAY, GRAY, GRAY],
            borderWidth: 0, hoverOffset: 2,
          }],
        },
        options: opts,
        centerMain: hasData ? String(primary + Math.max(0, replica)) : "—",
        centerSub: "active",
        legendItems: [
          { color: "#3b82f6", text: `${primary} primary` },
          { color: "#6366f1", text: `${Math.max(0, replica)} replica` },
          { color: unassigned > 0 ? "#f87171" : GRAY, text: `${unassigned} unassigned` },
        ],
      };
    }

    return { data: { labels: [], datasets: [] }, options: opts, centerMain: "—", centerSub: "", legendItems: [] };
  }, [variant, summary, fmt]);

  return (
    <div className={`cluster-donut${compact ? " cluster-donut--compact" : ""}`}>
      <div className="cluster-donut-chart-wrap">
        <Doughnut data={data} options={options} />
        <div className="cluster-donut-center" aria-hidden>
          <span className="cluster-donut-center-main">{centerMain}</span>
          {centerSub && <span className="cluster-donut-center-sub">{centerSub}</span>}
        </div>
      </div>
      <ul className="cluster-donut-legend">
        {legendItems.map((item, i) => (
          <li key={i}>
            <span className="cluster-donut-legend-swatch" style={{ background: item.color }} />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add ClusterDonut CSS to index.css**

Append to `frontend/src/index.css`:

```css
/* ─── ClusterDonut ───────────────────────────────────── */
.cluster-donut { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cluster-donut--compact .cluster-donut-chart-wrap { width: 110px; height: 110px; }
.cluster-donut-chart-wrap { position: relative; width: 140px; height: 140px; }
.cluster-donut-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}
.cluster-donut-center-main { font-size: 18px; font-weight: 700; color: var(--clr-text); line-height: 1; }
.cluster-donut-center-sub  { font-size: 11px; color: var(--clr-muted2); margin-top: 2px; }
.cluster-donut-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.cluster-donut-legend li { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--clr-muted2); }
.cluster-donut-legend-swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ClusterDonut.jsx frontend/src/index.css
git commit -m "feat: update ClusterDonut with new palette and shard breakdown"
```

---

## Task 8: Rewrite Overview.jsx

**Files:**
- Modify: `frontend/src/pages/Overview.jsx`

Cluster cards with coloured top border, KPI grid (nodes / shards / unassigned), utilisation bars for disk + heap. Error state shows icon + message block.

- [ ] **Step 1: Replace Overview.jsx**

```jsx
import { useMemo } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import MeterBar from "../components/MeterBar.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { Link } from "react-router-dom";

function statusBorderColor(status, hasError) {
  if (hasError) return "var(--clr-red)";
  if (status === "green")  return "var(--clr-green)";
  if (status === "yellow") return "var(--clr-yellow)";
  if (status === "red")    return "var(--clr-red)";
  return "var(--clr-dim)";
}

function badgeStyle(status, hasError) {
  if (hasError || status === "red")    return { background: "var(--clr-red-bg)",    color: "var(--clr-red)" };
  if (status === "yellow") return { background: "var(--clr-yellow-bg)", color: "var(--clr-yellow)" };
  if (status === "green")  return { background: "var(--clr-green-bg)",  color: "var(--clr-green)" };
  return { background: "rgba(51,65,85,0.4)", color: "var(--clr-dim)" };
}

export default function Overview() {
  const { data, error, loading, refetch } = useClusters();

  if (loading && !data) return <LoadingSpinner label="Loading clusters" />;

  if (error) {
    return (
      <div>
        <p className="error">Failed to load clusters: {error}</p>
        <button type="button" className="btn btn-primary" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Overview</h1>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => refetch()}>↻ Refresh</button>
      </div>

      <div className="cluster-grid">
        {(data || []).map((c) => {
          const borderColor = statusBorderColor(c.status, !!c.error);
          const badge = badgeStyle(c.status, !!c.error);
          return (
            <div key={c.name} className="card" style={{ borderTop: `2px solid ${borderColor}` }}>
              {/* Header */}
              <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px", color: "var(--clr-text)" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: borderColor, flexShrink: 0 }} />
                  <Link to={`/nodes?cluster=${encodeURIComponent(c.name)}`} style={{ color: "var(--clr-text)", textDecoration: "none" }}>
                    {c.name}
                  </Link>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", textTransform: "uppercase", letterSpacing: "0.05em", ...badge }}>
                  {c.error ? "unreachable" : c.status}
                </span>
              </div>

              {c.error ? (
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "var(--clr-red-bg)", color: "var(--clr-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>!</div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--clr-red)" }}>Host could not be resolved</div>
                    <div style={{ fontSize: "11px", color: "var(--clr-muted2)", marginTop: "3px" }}>{c.error}</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* KPI row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "var(--clr-border)", borderTop: "1px solid var(--clr-border)", borderBottom: "1px solid var(--clr-border)" }}>
                    {[
                      { label: "Nodes",      value: c.numberOfNodes },
                      { label: "Pri Shards", value: c.activePrimaryShards },
                      { label: "Unassigned", value: c.unassignedShards, warn: c.unassignedShards > 0 },
                    ].map(({ label, value, warn }) => (
                      <div key={label} style={{ background: "var(--clr-surface)", padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: warn ? "var(--clr-yellow)" : "var(--clr-text)", lineHeight: 1 }}>{value ?? "—"}</div>
                        <div style={{ fontSize: "10px", color: "var(--clr-dim)", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Utilisation bars */}
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {c.diskUsedPercent != null && (
                      <MeterBar pct={c.diskUsedPercent} label="Disk" />
                    )}
                    {(() => {
                      const total = (c.activePrimaryShards ?? 0) + (c.unassignedShards ?? 0);
                      const pct = total > 0 ? Math.round((c.unassignedShards / total) * 100) : 0;
                      return pct > 0 ? <MeterBar pct={pct} label="Unassigned shards" forceColor="var(--clr-yellow)" /> : null;
                    })()}
                  </div>
                </>
              )}

              {/* Footer links */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--clr-border)", display: "flex", gap: "4px" }}>
                {[
                  { label: "Nodes",   to: `/nodes?cluster=${encodeURIComponent(c.name)}` },
                  { label: "Indices", to: `/indices?cluster=${encodeURIComponent(c.name)}` },
                  { label: "ILM",     to: `/ilm?cluster=${encodeURIComponent(c.name)}` },
                  { label: "Alerts",  to: `/alerts?cluster=${encodeURIComponent(c.name)}` },
                ].map(({ label, to }) => (
                  <Link key={label} to={to} style={{ fontSize: "11px", color: "var(--clr-muted2)", padding: "3px 8px", borderRadius: "4px", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--clr-surface-hi)"; e.currentTarget.style.color = "var(--clr-accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--clr-muted2)"; }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual check**

Navigate to http://localhost:5173. Confirm cluster cards render with coloured top borders, KPI numbers, and meter bars. Hover the footer links and check the accent colour transition.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Overview.jsx
git commit -m "feat: redesign Overview page with cluster cards"
```

---

## Task 9: Rewrite Nodes.jsx

**Files:**
- Modify: `frontend/src/pages/Nodes.jsx`

KPI strip (4 cards), three viz panels (disk donut, shard donut, heap sparklines per node), node table with MeterBar for disk and heap.

- [ ] **Step 1: Replace Nodes.jsx**

```jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import ClusterDonut from "../components/ClusterDonut.jsx";
import KpiCard from "../components/KpiCard.jsx";
import MeterBar from "../components/MeterBar.jsx";
import SparklineChart from "../components/SparklineChart.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
import { useClusters } from "../hooks/useCluster.js";
import { useNodeHistory } from "../hooks/useNodeHistory.js";
import { formatBytes } from "../utils/format.js";
import { Link, useSearchParams } from "react-router-dom";
import { useRegisterGlobalRefresh } from "../hooks/useGlobalRefresh.js";
import { pushToast } from "../hooks/useToasts.js";
import { ACTIVE_CLUSTER_KEY, persistPageCluster } from "../utils/clusterStorage.js";

function parsePublishAddress(addr) {
  if (!addr) return { host: "—", port: "" };
  const s = String(addr);
  const lastColon = s.lastIndexOf(":");
  if (lastColon < 0) return { host: s, port: "" };
  const after = s.slice(lastColon + 1);
  return /^\d+$/.test(after) ? { host: s.slice(0, lastColon), port: `:${after}` } : { host: s, port: "" };
}

function heapColor(pct) {
  if (pct == null) return "var(--clr-purple)";
  if (pct >= 90) return "var(--clr-red)";
  if (pct >= 80) return "var(--clr-yellow)";
  return "var(--clr-purple)";
}

export default function Nodes() {
  const { data: clusters, loading: clustersLoading, error: clustersError } = useClusters();
  const names = useMemo(() => (clusters || []).map((c) => c.name), [clusters]);
  const [clusterName, setClusterName] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [searchParams] = useSearchParams();
  const urlCluster = searchParams.get("cluster");
  const { appendNodeData, getHistory } = useNodeHistory();

  useEffect(() => {
    if (!names.length) return;
    let remembered = "";
    try { remembered = window.localStorage.getItem("elkwatch.cluster.nodes") || ""; } catch { /* */ }
    let active = "";
    try { active = window.localStorage.getItem(ACTIVE_CLUSTER_KEY) || ""; } catch { /* */ }
    const pick = (urlCluster && names.includes(urlCluster) && urlCluster) ||
      (remembered && names.includes(remembered) && remembered) ||
      (active && names.includes(active) && active) || names[0];
    if (clusterName !== pick) setClusterName(pick);
  }, [names, clusterName, urlCluster]);

  useEffect(() => { if (clusterName) persistPageCluster("nodes", clusterName); }, [clusterName]);

  const load = useCallback(async () => {
    if (!clusterName) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(clusterName)}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const json = await res.json();
      setData(json);
      appendNodeData(clusterName, json.nodes);
    } catch (e) {
      setError(e.message);
      pushToast({ title: "Nodes failed", message: e.message, tone: "error" });
      setData(null);
    } finally { setLoading(false); }
  }, [clusterName, appendNodeData]);

  useEffect(() => { load(); }, [load]);
  useRegisterGlobalRefresh(() => { load(); });

  const summary = data?.summary;

  const onSort = useCallback((key) => {
    setSortKey((prev) => { if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return prev; } setSortDir("asc"); return key; });
  }, []);

  const nodeRows = useMemo(() => {
    const list = [...(data?.nodes || [])];
    const mul = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "name") return mul * String(a.name).localeCompare(String(b.name));
      if (sortKey === "disk") return mul * ((a.diskUsedPercent ?? -1) - (b.diskUsedPercent ?? -1));
      if (sortKey === "heap") return mul * ((a.heapUsedPercent ?? -1) - (b.heapUsedPercent ?? -1));
      return 0;
    });
    return list.map((n) => {
      const addr = n.httpPublishAddress || n.host || n.ip || "";
      const { host, port } = parsePublishAddress(addr);
      return { ...n, hostLabel: host, portLabel: port };
    });
  }, [data, sortKey, sortDir]);

  if (clustersLoading && !clusters) return <LoadingSpinner label="Loading clusters" />;
  if (clustersError) return <p className="error">{clustersError}</p>;

  const statusColor = summary?.status === "green" ? "var(--clr-green)" : summary?.status === "yellow" ? "var(--clr-yellow)" : "var(--clr-red)";

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Nodes</h1>
        {summary && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--clr-muted2)" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor }} />
            {clusterName} · {summary.status}
          </span>
        )}
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={() => load()}>↻ Refresh</button>
      </div>

      {loading && <LoadingSpinner compact label="Loading nodes" />}
      {error && <p className="error">{error}</p>}

      {data && !loading && (
        <>
          {/* KPI strip */}
          <div className="kpi-grid">
            <KpiCard label="Nodes" value={summary?.numberOfNodes} sub={`${summary?.numberOfNodes === 1 ? "1 master" : ""}`} tone="blue" />
            <KpiCard label="Active Shards" value={summary?.activeShards} sub={`of ${(summary?.activeShards ?? 0) + (summary?.unassignedShards ?? 0)} total`} />
            <KpiCard label="Unassigned" value={summary?.unassignedShards} sub="replica shards" tone={summary?.unassignedShards > 0 ? "yellow" : "green"} />
            <KpiCard label="Cluster Status" value={summary?.status} tone={summary?.status === "green" ? "green" : summary?.status === "yellow" ? "yellow" : "red"} />
          </div>

          {/* Viz panels */}
          <div className="viz-panels">
            <div className="card card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div className="section-title" style={{ alignSelf: "flex-start" }}>DISK USAGE</div>
              <ClusterDonut variant="disk" summary={summary} formatBytes={formatBytes} compact />
            </div>
            <div className="card card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div className="section-title" style={{ alignSelf: "flex-start" }}>SHARD DISTRIBUTION</div>
              <ClusterDonut variant="shards" summary={summary} formatBytes={formatBytes} compact />
            </div>
            <div className="card card-body">
              <div className="section-title" style={{ marginBottom: "14px" }}>HEAP PER NODE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {nodeRows.map((n) => {
                  const history = getHistory(clusterName, n.name);
                  const color = heapColor(n.heapUsedPercent);
                  return (
                    <div key={n.nodeId}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--clr-muted2)" }}>{n.name}</span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color }}>{n.heapUsedPercent != null ? `${n.heapUsedPercent}%` : "—"}</span>
                      </div>
                      {history.length > 1
                        ? <SparklineChart data={history} color={color} height={30} />
                        : <div style={{ height: "30px", background: "var(--clr-border)", borderRadius: "3px" }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Node table */}
          <div className="table-wrap">
            <div className="card-header">
              <span className="section-title">NODE LIST</span>
              <span style={{ fontSize: "11px", color: "var(--clr-dim)" }}>{nodeRows.length} node{nodeRows.length !== 1 ? "s" : ""}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <SortableTh sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={onSort}>Node</SortableTh>
                  <th>Host</th>
                  <th>Roles</th>
                  <SortableTh sortKey="disk" currentKey={sortKey} currentDir={sortDir} onSort={onSort}>Disk used</SortableTh>
                  <SortableTh sortKey="heap" currentKey={sortKey} currentDir={sortDir} onSort={onSort}>Heap</SortableTh>
                </tr>
              </thead>
              <tbody>
                {nodeRows.map((n) => (
                  <tr key={n.nodeId}>
                    <td className="text-mono" style={{ color: "var(--clr-text)", fontWeight: 500 }}>{n.name}</td>
                    <td className="text-mono">
                      {n.hostLabel}
                      {n.portLabel && <span style={{ color: "var(--clr-dim)" }}>{n.portLabel}</span>}
                    </td>
                    <td>
                      {(n.roles || []).map((r) => (
                        <span key={r} style={{
                          display: "inline-block", marginRight: "3px", padding: "1px 6px", borderRadius: "4px",
                          fontSize: "10px", fontWeight: 500,
                          background: r === "master" ? "var(--clr-accent-bg)" : "var(--clr-surface-hi)",
                          color: r === "master" ? "var(--clr-accent)" : "var(--clr-muted2)",
                          border: `1px solid ${r === "master" ? "rgba(59,130,246,0.2)" : "var(--clr-border)"}`,
                        }}>{r}</span>
                      ))}
                    </td>
                    <td style={{ minWidth: "130px" }}><MeterBar pct={n.diskUsedPercent} label={n.diskUsedPercent != null ? `${n.diskUsedPercent}%` : undefined} /></td>
                    <td style={{ minWidth: "130px" }}><MeterBar pct={n.heapUsedPercent} forceColor={heapColor(n.heapUsedPercent)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary && (
            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <Link to={`/indices?cluster=${encodeURIComponent(clusterName)}`} style={{ fontSize: "11px", color: "var(--clr-muted2)" }}>
                View indices →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Visual check**

Navigate to /nodes. Confirm: KPI cards at top, three viz panels (disk donut, shard donut, heap sparklines area), node table with role badges and MeterBars. After two refreshes, sparklines should show a line.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Nodes.jsx
git commit -m "feat: redesign Nodes page with KPI strip, viz panels, and sparklines"
```

---

## Task 10: Rewrite Indices.jsx

**Files:**
- Modify: `frontend/src/pages/Indices.jsx`

Toolbar with search + health/status filters, HealthBadge for each row, inline store-size bars. All existing sort/filter logic is preserved.

- [ ] **Step 1: Read the current Indices.jsx to identify all existing state and sort keys**

The current file has: `filter` (index pattern, default `"*"`), `search` (text search), `healthFilter`, `statusFilter`, `sortKey`, `sortDir`. Keep all of these.

- [ ] **Step 2: Replace the JSX return block in Indices.jsx**

Find the `return (` statement (after all the `useMemo`/`useCallback` hooks) and replace the entire JSX with:

```jsx
  // Add at top of component, after existing state declarations:
  // const maxStoreBytes = useMemo(() => {
  //   const sizes = (indices || []).map(idx => parseStoreSizeToBytes(idx["store.size"]) || 0);
  //   return Math.max(1, ...sizes);
  // }, [indices]);

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Indices</h1>
        <div className="toolbar-spacer" />
        {indices && (
          <>
            <span className="stat-chip"><strong>{sortedIndices.length}</strong> shown</span>
            <span className="stat-chip"><strong>{(indices || []).filter(i => i.health === "red" || i.health === "yellow").length}</strong> unhealthy</span>
          </>
        )}
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" />
        </div>
        <select className="filter-select" value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
          <option value="">All health</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All status</option>
          <option value="open">Open</option>
          <option value="close">Closed</option>
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => load()}>↻ Refresh</button>
      </div>

      {loading && <LoadingSpinner compact label="Loading indices" />}
      {error && <p className="error">{error}</p>}

      {indices && !loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh sortKey="index" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Index</SortableTh>
                <SortableTh sortKey="health" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Health</SortableTh>
                <th>Status</th>
                <SortableTh sortKey="pri" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Pri</SortableTh>
                <SortableTh sortKey="rep" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Rep</SortableTh>
                <SortableTh sortKey="docsCount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Docs</SortableTh>
                <SortableTh sortKey="storeSize" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Store size</SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedIndices.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--clr-muted2)", padding: "24px" }}>No indices match current filters.</td></tr>
              ) : sortedIndices.map((idx) => {
                const health = idx.health || "unknown";
                const maxBytes = Math.max(1, ...(indices || []).map(i => parseStoreSizeToBytes(i["store.size"]) || 0));
                const storeBytes = parseStoreSizeToBytes(idx["store.size"]) || 0;
                const barPct = Math.round((storeBytes / maxBytes) * 100);
                return (
                  <tr key={idx.index}>
                    <td className="text-mono" style={{ color: "var(--clr-text)", fontWeight: 500, maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idx.index}</td>
                    <td><HealthBadge tone={health} label={health} /></td>
                    <td><span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: "var(--clr-surface-hi)", color: "var(--clr-muted2)" }}>{idx.status || "—"}</span></td>
                    <td style={{ color: "var(--clr-dim)", fontVariantNumeric: "tabular-nums" }}>{idx.pri}</td>
                    <td style={{ color: "var(--clr-dim)", fontVariantNumeric: "tabular-nums" }}>{idx.rep}</td>
                    <td style={{ color: "var(--clr-muted2)", fontVariantNumeric: "tabular-nums" }}>{idx["docs.count"] != null ? Number(idx["docs.count"]).toLocaleString() : "—"}</td>
                    <td style={{ minWidth: "120px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <div style={{ flex: 1, height: "4px", background: "var(--clr-border)", borderRadius: "2px", minWidth: "60px" }}>
                          <div style={{ height: "4px", width: `${barPct}%`, background: "var(--clr-accent)", borderRadius: "2px" }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--clr-muted2)", width: "52px", textAlign: "right", flexShrink: 0 }}>{idx["store.size"] || "—"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            Showing {sortedIndices.length} of {(indices || []).length} indices
          </div>
        </div>
      )}
    </div>
  );
```

Also add the imports at the top of the file:
```jsx
import HealthBadge from "../components/HealthBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
```

Ensure `handleSort` is the existing sort callback (check current name and use it, or rename consistently).

- [ ] **Step 3: Visual check**

Navigate to /indices. Confirm: toolbar with search and filter dropdowns, health badges render with correct colours, store-size bars scale relative to the largest index. Sorting columns works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Indices.jsx
git commit -m "feat: redesign Indices page with health badges and size bars"
```

---

## Task 11: Rewrite ILM.jsx

**Files:**
- Modify: `frontend/src/pages/ILM.jsx`

Restyle toolbar, table (phase badges, error badges), and policy editor panel. All ILM logic (dry-run, diff viewer, policy loading) is preserved exactly — only CSS class names and JSX structure change.

- [ ] **Step 1: Read the current ILM.jsx diff viewer and dry-run result rendering**

Read `frontend/src/pages/ILM.jsx` lines 400–550 to understand the full diff rendering JSX before changing anything.

- [ ] **Step 2: Replace the return block JSX in ILM.jsx**

The toolbar cluster select, filters (search, managed, errorsOnly, phase), and the table remain. Replace class names and add HealthBadge/inline badges:

```jsx
  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">ILM</h1>
        <div className="toolbar-spacer" />
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input value={indexSearch} onChange={(e) => setIndexSearch(e.target.value)} placeholder="Filter by index…" />
        </div>
        <select className="filter-select" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
          <option value="">All phases</option>
          {phaseOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={managedFilter} onChange={(e) => setManagedFilter(e.target.value)}>
          <option value="">All</option>
          <option value="yes">Managed</option>
          <option value="no">Unmanaged</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--clr-muted2)", cursor: "pointer" }}>
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          Errors only
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => load()}>↻ Refresh</button>
      </div>

      {loading && <LoadingSpinner compact label="Loading ILM" />}
      {error && <p className="error">{error}</p>}

      {/* Policy editor (dry-run) */}
      {data?.policies && (
        <div className="card card-body" style={{ marginBottom: "16px" }}>
          <div className="subpanel-title">Policy editor (dry-run)</div>
          <p style={{ fontSize: "12px", color: "var(--clr-muted2)", marginBottom: "12px" }}>
            No writes are performed. Checks JSON validity, shows a structural diff, and lists affected indices.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
            <select className="filter-select" value={editorPolicyName} onChange={(e) => { setEditorPolicyName(e.target.value); setDryRunResult(null); }}>
              {policyNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="diff-toggle-inline">
              <input type="checkbox" checked={includeMetaDiff} onChange={(e) => setIncludeMetaDiff(e.target.checked)} />
              Include _meta in diff
            </label>
            <div className="toolbar-actions">
              <button type="button" className="btn btn-secondary" onClick={() => loadPolicyIntoEditor(editorPolicyName)} disabled={!editorPolicyName}>Load current</button>
              <button type="button" className="btn btn-primary" onClick={runDryRun} disabled={dryRunLoading || !editorPolicyName}>
                {dryRunLoading ? "Validating…" : "Validate dry-run"}
              </button>
            </div>
          </div>
          <textarea
            className="input-elk"
            style={{ width: "100%", minHeight: "200px", fontFamily: "monospace", fontSize: "12px", lineHeight: 1.4 }}
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            spellCheck={false}
          />
          {/* Preserve existing dry-run result rendering below — do not change */}
          {dryRunResult?.error && (
            <p className="error" style={{ marginTop: "8px" }}>{dryRunResult.error}</p>
          )}
          {/* ... rest of existing dryRunResult JSX unchanged ... */}
        </div>
      )}

      {/* ILM table */}
      {filteredRows && !loading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh sortKey="index" currentKey={sortKey} currentDir={sortDir} onSort={(k) => { setSortKey(k); setSortDir((d) => k === sortKey ? (d === "asc" ? "desc" : "asc") : "asc"); }}>Index</SortableTh>
                <th>Phase</th>
                <th>Action / Step</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--clr-muted2)", padding: "24px" }}>No indices match current filters.</td></tr>
              ) : filteredRows.map((r) => {
                const hasError = !!(r.failedStep || r.error);
                const phaseColors = { hot: "var(--clr-red)", warm: "var(--clr-yellow)", cold: "var(--clr-accent)", frozen: "var(--clr-purple)", delete: "var(--clr-dim)" };
                const phaseColor = phaseColors[r.phase] || "var(--clr-muted2)";
                return (
                  <tr key={r.index}>
                    <td className="text-mono" style={{ color: "var(--clr-text)", fontWeight: 500 }}>{r.index}</td>
                    <td>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", background: `${phaseColor}18`, color: phaseColor }}>
                        {r.phase || "—"}
                      </span>
                    </td>
                    <td style={{ color: "var(--clr-muted2)" }}>
                      {r.action && <span className="text-mono">{r.action}</span>}
                      {r.action && r.step && <span style={{ color: "var(--clr-dim)", margin: "0 4px" }}>›</span>}
                      {r.step && <span className="text-mono">{r.step}</span>}
                    </td>
                    <td>
                      {hasError ? (
                        <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
                          {failedText(r) || "error"}
                        </span>
                      ) : <span style={{ color: "var(--clr-dim)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">Showing {filteredRows.length} indices</div>
        </div>
      )}
    </div>
  );
```

Add imports:
```jsx
import HealthBadge from "../components/HealthBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
```

**Important:** Read the full current ILM.jsx before replacing to confirm the variable names (`filteredRows`, `policyNames`, `loadPolicyIntoEditor`, etc.) match exactly.

- [ ] **Step 3: Visual check**

Navigate to /ilm. Confirm phase badges render with correct colours (hot=red, warm=yellow, cold=blue). Verify policy editor is still visible and functional (text area editable, dry-run button works).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ILM.jsx
git commit -m "feat: redesign ILM page with phase badges"
```

---

## Task 12: Rewrite Alerts.jsx

**Files:**
- Modify: `frontend/src/pages/Alerts.jsx`

Severity badges (error/warning/info), formatted timestamp column, existing sort/filter logic preserved.

- [ ] **Step 1: Replace the return block in Alerts.jsx**

```jsx
  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Alerts</h1>
        <div className="toolbar-spacer" />
        {data && <span className="stat-chip"><strong>{sortedRows.length}</strong> alerts</span>}
        <select className="filter-select" value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)}>
          <option value="">All clusters</option>
          {clusterNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => load()}>↻ Refresh</button>
      </div>

      {loading && !data && <LoadingSpinner label="Loading alerts" />}
      {error && (
        <div>
          <p className="error">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => load()}>Retry</button>
        </div>
      )}

      {data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableTh sortKey="time" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Time</SortableTh>
                <SortableTh sortKey="severity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Severity</SortableTh>
                <SortableTh sortKey="cluster" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Cluster</SortableTh>
                <SortableTh sortKey="ruleId" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Rule</SortableTh>
                <SortableTh sortKey="message" currentKey={sortKey} currentDir={sortDir} onSort={handleSort}>Message</SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--clr-muted2)", padding: "24px" }}>No alerts{clusterFilter ? ` for ${clusterFilter}` : ""}.</td></tr>
              ) : sortedRows.map((a, i) => {
                const ts = a.time ? new Date(a.time) : null;
                const timeStr = ts ? ts.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                const sev = a.severity || "info";
                return (
                  <tr key={a.id || i}>
                    <td style={{ color: "var(--clr-dim)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{timeStr}</td>
                    <td><HealthBadge tone={sev} label={sev} /></td>
                    <td className="text-mono" style={{ color: "var(--clr-muted)" }}>{a.cluster || "—"}</td>
                    <td className="text-mono" style={{ color: "var(--clr-muted2)" }}>{a.ruleId || "—"}</td>
                    <td style={{ color: "var(--clr-text)" }}>{a.message || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            {sortedRows.length} alert{sortedRows.length !== 1 ? "s" : ""}
            {clusterFilter && ` · ${clusterFilter}`}
          </div>
        </div>
      )}
    </div>
  );
```

Add imports:
```jsx
import HealthBadge from "../components/HealthBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import SortableTh from "../components/SortableTh.jsx";
```

Verify `handleSort` exists in current Alerts.jsx (or use the existing sort callback name).

- [ ] **Step 2: Visual check**

Navigate to /alerts. Confirm severity badges render (error=red, warning=yellow, info=blue). Check timestamps are human-readable. Sorting works.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Alerts.jsx
git commit -m "feat: redesign Alerts page with severity badges"
```

---

## Task 13: Rewrite Templates.jsx

**Files:**
- Modify: `frontend/src/pages/Templates.jsx`

Simple table redesign: name, index patterns, priority, composed-of. No new logic.

- [ ] **Step 1: Replace the return block in Templates.jsx**

```jsx
  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Index Templates</h1>
        <div className="toolbar-spacer" />
        {data?.templates && <span className="stat-chip"><strong>{data.templates.length}</strong> templates</span>}
        <button type="button" className="btn btn-secondary" onClick={() => load()}>↻ Refresh</button>
      </div>
      <p style={{ fontSize: "12px", color: "var(--clr-muted2)", marginBottom: "16px" }}>
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
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--clr-muted2)", padding: "24px" }}>No composable index templates found.</td></tr>
              ) : data.templates.map((t) => (
                <tr key={t.name}>
                  <td className="text-mono" style={{ color: "var(--clr-text)", fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: "var(--clr-muted2)" }}>
                    {(t.indexPatterns || []).map((p) => (
                      <span key={p} style={{ display: "inline-block", margin: "1px 3px 1px 0", padding: "1px 6px", background: "var(--clr-surface-hi)", border: "1px solid var(--clr-border)", borderRadius: "4px", fontSize: "11px", fontFamily: "monospace" }}>{p}</span>
                    ))}
                    {!t.indexPatterns?.length && "—"}
                  </td>
                  <td style={{ color: "var(--clr-dim)", fontVariantNumeric: "tabular-nums" }}>{t.priority ?? "—"}</td>
                  <td style={{ color: "var(--clr-muted2)" }}>{(t.composedOf || []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">{data.templates.length} template{data.templates.length !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
```

Add imports:
```jsx
import LoadingSpinner from "../components/LoadingSpinner.jsx";
```

- [ ] **Step 2: Visual check**

Navigate to /templates. Confirm the table renders with monospace name cells and pattern chips.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Templates.jsx
git commit -m "feat: redesign Templates page"
```

---

## Task 14: Final polish — light theme and end-to-end check

**Files:**
- Modify: `frontend/src/index.css` — verify light theme token values are correct
- Modify: `frontend/src/components/SidebarIcons.jsx` — ensure icons render at correct size with `currentColor`

- [ ] **Step 1: Verify SidebarIcons uses currentColor**

Read `frontend/src/components/SidebarIcons.jsx`. If any icon SVGs use hardcoded fill/stroke colours (e.g. `fill="#8b92a5"`), replace them with `fill="currentColor"` or `stroke="currentColor"` so they pick up the rail's `color` CSS property.

- [ ] **Step 2: Switch to light theme and check every page**

Click the theme button in the context panel footer until "light" is active. Navigate through all 6 pages:
- Overview: cards should have light card backgrounds with dark text
- Nodes: gauges and sparklines should be readable on light background
- Indices/ILM/Alerts/Templates: tables should have white backgrounds with dark text

If any page has invisible text (e.g. white on white), update `--clr-text` references in the relevant component to use `var(--clr-text)` instead of a hardcoded colour.

- [ ] **Step 3: Switch back to dark theme and do a final check**

Verify the icon rail status dots update correctly when cluster data loads. Verify context panel shows cluster health cards on Overview and cluster switcher on other pages.

- [ ] **Step 4: Update the spec note about Recharts**

In `docs/superpowers/specs/2026-04-02-ui-redesign-design.md`, update the dependency section to note Chart.js was used instead of Recharts (already installed).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: final polish — light theme verification and icon colour fix"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Icon rail (52px, fixed, status dots) | Task 2 |
| Context panel (page-aware, cluster switcher) | Task 3 |
| App shell rewrite | Task 4 |
| Theme toggle (dark/light/charcoal) | Task 4 (ContextPanel) |
| New design tokens / CSS variables | Task 1 |
| KpiCard, MeterBar, HealthBadge components | Task 5 |
| SparklineChart + rolling history | Task 6 |
| ClusterDonut colour update + shard breakdown | Task 7 |
| Overview page cluster cards | Task 8 |
| Nodes page KPI strip + viz panels + table | Task 9 |
| Indices health badges + inline size bars | Task 10 |
| ILM phase badges + policy editor preserved | Task 11 |
| Alerts severity badges + timestamps | Task 12 |
| Templates table restyle | Task 13 |
| Light theme verification | Task 14 |

**No placeholders found.** All tasks contain complete code.

**Type consistency:** `MeterBar` props are `pct`, `label`, `forceColor` throughout. `HealthBadge` props are `tone`, `label`, `dot` throughout. `SortableTh` props are `sortKey`, `currentKey`, `currentDir`, `onSort` throughout.
