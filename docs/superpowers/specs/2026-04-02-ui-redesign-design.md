# Elkwatch UI Redesign — Design Spec

**Date:** 2026-04-02  
**Status:** Approved

---

## Overview

Full visual redesign of the Elkwatch frontend. All existing functionality is preserved — the redesign replaces every CSS style and upgrades data visualization components. No backend changes. No routing or data-fetching changes.

**Design direction:** Modern Enterprise (Datadog-inspired)  
**Palette:** Electric blue accent (#3b82f6), neon green health (#4ade80), deep charcoal background (#0d0f14)  
**New dependency:** Recharts (for gauges, donuts, sparklines on the Nodes page)  
**Theme support:** Dark (default), Light, Charcoal — toggled via `documentElement.dataset.theme`, preserved in localStorage

---

## Layout & Navigation

### Shell structure

Three-column shell replacing the current resizable sidebar:

1. **Icon rail** (52px, fixed) — always visible, never collapses
   - App logo/mark at top
   - One icon per page with a live status dot (green/yellow/red) derived from data
   - Active page highlighted with a blue tinted background
   - Settings icon at bottom
   - No labels — tooltips on hover

2. **Context panel** (220px, hideable) — page-aware secondary panel
   - **Overview page:** cluster switcher list with inline health dots, summary card for active cluster (node count, shard count, status)
   - **All other pages:** page-specific filters and controls (replaces per-page toolbar cluster selects)
   - Footer: theme toggle (icon button cycling dark → light → charcoal), auto-refresh selector, version number
   - Can be hidden to maximize content width; hidden state persisted in localStorage

3. **Main area** (flex: 1) — page content
   - Thin topbar (44px): breadcrumb left, quick-action pills right (refresh, status pill)
   - Content area below topbar with consistent 20px padding

### Theme toggle

Replace the current `<select>` with a compact icon-button toggle in the context panel footer. Cycles: Dark → Light → Charcoal. Icon updates to reflect current theme (moon / sun / circle). State stored in `localStorage` under `elkwatch.theme` (existing key, no change).

---

## Design Tokens (CSS Variables)

Replace the current `index.css` palette with the new electric blue + deep charcoal system. All existing CSS variable names are preserved so component references don't break — only the values change.

**Dark theme values (default):**
```
--bg:       #0d0f14       (page background)
--surface:  #0f1117       (card/panel background)
--border:   #1a1f2e       (dividers, card borders)
--text:     #f1f5f9       (primary text)
--muted:    #475569       (secondary/label text)
--accent:   #3b82f6       (electric blue — links, active states, highlights)
--green:    #4ade80       (cluster health: green)
--yellow:   #facc15       (cluster health: yellow / warnings)
--red:      #f87171       (cluster health: red / errors)
```

Additional tokens needed:
```
--surface-raised:  #161b27    (hover states, elevated cards)
--border-subtle:   #13161e    (table row dividers)
--text-muted2:     #334155    (very muted — labels, counts)
--accent-purple:   #a78bfa    (heap metrics)
--accent-indigo:   #6366f1    (replica shards)
```

**Light theme:** inverted — white/light gray backgrounds, dark text, same accent blue. Full token values to be defined during implementation based on the dark values.

---

## Overview Page

**Layout:** Page heading + summary pills in topbar. Cluster cards in a responsive grid (3 columns on wide, 2 on medium, 1 on narrow).

**Cluster card anatomy:**
- Colored top border (2px): green / yellow / red based on cluster status
- Header row: cluster name with status dot, status badge (pill, color-coded)
- KPI grid (3 columns): Nodes, Shards, Unassigned — tight, scannable
- Utilization bars: Disk used % and Heap % with inline bar tracks; bars turn yellow ≥80%, red ≥90%
- Footer link row: Nodes · Indices · ILM · Alerts — direct navigation into that cluster

**Error state:** Replace KPI grid and bars with an error block showing icon + message. Footer shows "How to remove from config" link.

---

## Nodes Page

The most visually rich page. Three sections:

### 1. KPI strip
Four cards in a row: Nodes, Active Shards, Unassigned (green when 0, yellow/red otherwise), Cluster Status.

### 2. Visualization panels (3 columns)
- **Disk gauge** — Recharts `RadialBarChart` or SVG radial gauge. Shows used% as arc, center label shows percentage and used/total bytes. Legend below: Used / Free.
- **Shard donut** — Recharts `PieChart`. Segments: Primary (blue), Replica (indigo), Unassigned (red), Relocating (yellow). Center label: total shard count.
- **Heap sparklines** — One `LineChart` per node using Recharts `ResponsiveContainer`. Shows heap% over the last N data points (using in-memory rolling window of the last 20 poll results). Gradient fill under the line. Color: purple normally, yellow ≥80%, red ≥90%.

> **Note on sparkline data:** The backend currently returns only the current snapshot. The frontend will maintain a rolling in-memory array (up to 20 entries) per cluster+node key, appended on each refresh. No backend changes needed.

### 3. Node table
Columns: Node (monospace), Host (monospace, port muted), Roles (badge per role, master badge highlighted blue), Disk used (value + inline bar), Heap (value + inline bar).

Bar colors: blue <80%, yellow 80–89%, red ≥90% — matching existing threshold logic.

---

## Data Tables (Indices / ILM / Alerts / Templates)

All four pages share the same shell:

### Toolbar
Single row containing: page heading, stat chips (total count, unhealthy count), search box, filter dropdowns. All existing filter state (health, status, search) preserved.

### Table
- Header row: `#0a0c11` background, uppercase 10px labels, sortable columns with `↑`/`↓` indicator
- Row hover: subtle blue tint (`rgba(59,130,246,0.04)`)
- Row dividers: `--border-subtle` (#13161e) — lighter than card borders

**Per-page column additions:**
- **Indices:** Health badge (green/yellow/red pill with dot), Status pill (open/closed), inline store-size bar (width relative to largest index in current view)
- **ILM:** Phase badge (hot/warm/cold/frozen/delete), error count badge (red when >0)
- **Alerts:** Severity badge (error/warning/info), timestamp column, cluster column
- **Templates:** Type badge (composable/legacy), component count

### Pagination
Table footer with "Showing X–Y of Z" count and prev/next page buttons. Existing client-side filtering/sorting is preserved — pagination is purely visual (show first 50, page through).

---

## Component Changes

| Component | Change |
|-----------|--------|
| `ClusterDonut.jsx` | Replace with Recharts `PieChart` — same props interface |
| `LoadingSpinner.jsx` | Restyle with new palette; keep existing API |
| `SortableTh.jsx` | Update sort indicator styling |
| `Toasts.jsx` | Restyle: slide in from top-right, new color tokens |
| New: `IconRail.jsx` | Icon rail with status dots |
| New: `ContextPanel.jsx` | Page-aware secondary panel |
| New: `KpiCard.jsx` | Reusable stat card |
| New: `MeterBar.jsx` | Inline utilization bar with threshold colors |
| New: `HealthBadge.jsx` | Color-coded health/status pill |
| New: `SparklineChart.jsx` | Thin Recharts wrapper for per-node heap sparklines |

---

## Out of Scope

- No new data fetched from the backend
- No new pages or routes
- No changes to alert rules, ILM logic, or any backend service
- No animation library (CSS transitions only, except Recharts built-ins)
- Charcoal theme light-mode equivalent: keep existing charcoal theme values, update only the dark and light themes with the new palette

---

## Files Changed

**Primary:**
- `frontend/src/index.css` — full rewrite of design tokens and global styles
- `frontend/src/App.jsx` — new shell layout (icon rail + context panel)
- `frontend/src/pages/*.jsx` — all six pages restyled
- `frontend/src/components/*.jsx` — all existing components restyled; new components added
- `frontend/src/pages/nodes.css` — absorbed into component styles or index.css

**Dependencies:**
- Add `recharts` to `frontend/package.json`
