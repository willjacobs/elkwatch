import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Docs.css";

const SECTIONS = [
  { id: "overview",   title: "Overview" },
  { id: "nodes",      title: "Nodes" },
  { id: "indices",    title: "Indices" },
  { id: "ilm",        title: "ILM" },
  { id: "alerts",     title: "Alerts" },
  { id: "templates",  title: "Templates" },
  { id: "navigation", title: "Navigation & Layout" },
  { id: "config",     title: "Configuration" },
  { id: "shortcuts",  title: "Quick Reference" },
];

function DocSection({ id, title, children }) {
  return (
    <section id={id} className="docs-section">
      <h2 className="docs-section-title">{title}</h2>
      {children}
    </section>
  );
}

export default function Docs() {
  const [activeId, setActiveId] = useState("overview");
  const contentRef = useRef(null);
  const location = useLocation();

  // Scroll to hash on mount
  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
        setActiveId(hash);
      }
    }
  }, [location.hash]);

  // IntersectionObserver for active TOC highlighting
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { root, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="docs-layout">
      <nav className="docs-toc" aria-label="Table of contents">
        <div className="docs-toc-title">Contents</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`docs-toc-item${activeId === s.id ? " active" : ""}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.title}
          </button>
        ))}
      </nav>

      <div className="docs-content" ref={contentRef}>
        <h1 className="page-title">Documentation</h1>
        <p className="docs-intro">
          Elkwatch is a self-hosted Elasticsearch health dashboard. It provides a read-only
          view of your cluster health, node resources, index lifecycle, alerts, and templates.
        </p>

        {/* ── Overview ────────────────────────────── */}
        <DocSection id="overview" title="Overview">
          <p>
            The <strong>Overview</strong> page shows all configured Elasticsearch clusters as cards.
            Each card displays the cluster's health status, node count, primary shard count,
            and unassigned shard count at a glance.
          </p>
          <div className="docs-sub">Health status</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-green)" }} /> <strong>Green</strong> — all primary and replica shards are allocated</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-yellow)" }} /> <strong>Yellow</strong> — all primaries allocated, but some replicas are not</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-red)" }} /> <strong>Red</strong> — one or more primary shards are unallocated</div>
          <p>
            The colored top border on each card reflects the cluster status. Utilization bars show
            disk usage percentage and unassigned shard ratio when applicable.
          </p>
          <div className="docs-sub">Unreachable clusters</div>
          <p>
            If Elkwatch cannot connect to a cluster, it shows an <strong>unreachable</strong> badge
            with the error message (e.g., DNS resolution failure). Check your <code>config.yml</code> to
            verify the host and credentials.
          </p>
          <div className="docs-tip">
            <strong>Tip:</strong> Click a cluster name to jump directly to its Nodes page.
            Use the footer links on each card to navigate to Indices, ILM, or Alerts for that cluster.
          </div>
        </DocSection>

        {/* ── Nodes ───────────────────────────────── */}
        <DocSection id="nodes" title="Nodes">
          <p>
            The <strong>Nodes</strong> page provides a detailed view of a single cluster's nodes.
            It is divided into three sections: KPI cards, visualization panels, and the node table.
          </p>
          <div className="docs-sub">KPI cards</div>
          <p>
            Four summary cards show: total node count, active shard count, unassigned shard count,
            and overall cluster status. Unassigned shards are highlighted in yellow or red when non-zero.
          </p>
          <div className="docs-sub">Visualization panels</div>
          <ul>
            <li><strong>Disk Usage</strong> — donut chart showing used vs. free disk across the cluster</li>
            <li><strong>Shard Distribution</strong> — donut chart breaking down primary, replica, unassigned, and relocating shards</li>
            <li><strong>Heap per Node</strong> — sparkline charts showing each node's JVM heap usage over time (rolling 20-point window, updated on each refresh)</li>
          </ul>
          <div className="docs-sub">Node table</div>
          <p>
            Lists every node with its name, host address, roles (master, data, ingest, etc.),
            disk usage, and heap usage. Meter bars change color at <strong>80%</strong> (yellow)
            and <strong>90%</strong> (red) thresholds. Click column headers to sort.
          </p>
          <div className="docs-tip">
            <strong>Tip:</strong> The heap sparklines build up over time. Each refresh adds a data point.
            After several refreshes you'll see heap trends per node.
          </div>
        </DocSection>

        {/* ── Indices ─────────────────────────────── */}
        <DocSection id="indices" title="Indices">
          <p>
            The <strong>Indices</strong> page shows a sortable, filterable table of all indices
            in the selected cluster.
          </p>
          <div className="docs-sub">Columns</div>
          <ul>
            <li><strong>Index</strong> — the index name (monospace for readability)</li>
            <li><strong>Health</strong> — green, yellow, or red badge</li>
            <li><strong>Status</strong> — open or closed</li>
            <li><strong>Pri / Rep</strong> — primary and replica shard counts</li>
            <li><strong>Docs</strong> — document count</li>
            <li><strong>Store size</strong> — disk usage with an inline bar chart scaled relative to the largest index</li>
          </ul>
          <div className="docs-sub">Filtering</div>
          <p>
            Use the <strong>search box</strong> to filter by index name. The <strong>Health</strong> dropdown
            filters by health status (green/yellow/red). The <strong>Status</strong> dropdown filters
            by open/closed state. All filters combine (AND logic).
          </p>
        </DocSection>

        {/* ── ILM ─────────────────────────────────── */}
        <DocSection id="ilm" title="ILM (Index Lifecycle Management)">
          <p>
            The <strong>ILM</strong> page shows lifecycle status for all managed indices and provides
            a read-only policy editor with dry-run validation.
          </p>
          <div className="docs-sub">Phase badges</div>
          <p>
            Each index shows its current ILM phase as a colored badge:
          </p>
          <ul>
            <li><strong style={{ color: "var(--clr-red)" }}>hot</strong> — actively written to, optimized for indexing speed</li>
            <li><strong style={{ color: "var(--clr-yellow)" }}>warm</strong> — no longer written to, still queried</li>
            <li><strong style={{ color: "var(--clr-accent)" }}>cold</strong> — infrequently accessed, optimized for storage</li>
            <li><strong style={{ color: "var(--clr-purple)" }}>frozen</strong> — rarely accessed, minimal resources</li>
            <li><strong style={{ color: "var(--clr-dim)" }}>delete</strong> — scheduled for removal</li>
          </ul>
          <div className="docs-sub">Policy dry-run</div>
          <p>
            The policy editor lets you paste a modified ILM policy JSON and run a
            <strong> dry-run validation</strong>. Elkwatch will check JSON validity, show a structural
            diff comparing your changes to the live policy, and list which indices currently use that
            policy. No changes are ever written to Elasticsearch.
          </p>
          <div className="docs-tip">
            <strong>Tip:</strong> Click "Load current" to populate the editor with the live policy JSON,
            then make your changes and click "Validate dry-run" to preview.
          </div>
        </DocSection>

        {/* ── Alerts ──────────────────────────────── */}
        <DocSection id="alerts" title="Alerts">
          <p>
            The <strong>Alerts</strong> page shows a history of alert events generated by Elkwatch's
            backend scheduler.
          </p>
          <div className="docs-sub">Severity levels</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-red)" }} /> <strong>Error</strong> — critical condition (e.g., disk usage above threshold)</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-yellow)" }} /> <strong>Warning</strong> — approaching a threshold</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-accent)" }} /> <strong>Info</strong> — informational event</div>
          <div className="docs-sub">How alerts work</div>
          <p>
            Alert rules are defined in <code>config.yml</code>. The backend runs checks every
            5 minutes (configurable via cron expression in <code>alertScheduler.js</code>). Supported
            rule types include disk usage thresholds and ILM error detection.
          </p>
          <p>
            When a rule fires, the alert is stored in a local SQLite database and optionally sent
            to a <strong>Slack webhook</strong> if configured in <code>config.yml</code>.
          </p>
        </DocSection>

        {/* ── Templates ───────────────────────────── */}
        <DocSection id="templates" title="Templates">
          <p>
            The <strong>Templates</strong> page lists all composable index templates
            (Elasticsearch 7.8+) in the selected cluster. This is a read-only view.
          </p>
          <ul>
            <li><strong>Name</strong> — the template identifier</li>
            <li><strong>Index patterns</strong> — which index names this template matches (shown as chips)</li>
            <li><strong>Priority</strong> — when multiple templates match, higher priority wins</li>
            <li><strong>Composed of</strong> — component templates this template inherits from</li>
          </ul>
        </DocSection>

        {/* ── Navigation ──────────────────────────── */}
        <DocSection id="navigation" title="Navigation & Layout">
          <p>
            The Elkwatch interface has three zones:
          </p>
          <div className="docs-sub">Icon rail</div>
          <p>
            The narrow column on the far left contains page icons. The active page is highlighted
            in blue. A small status dot on the Overview icon reflects the worst cluster health
            across all clusters.
          </p>
          <div className="docs-sub">Context panel</div>
          <p>
            The panel to the right of the icon rail shows cluster information. On the
            <strong> Overview</strong> page, it lists all clusters with health badges. On other pages,
            it shows the active cluster's summary and a cluster switcher. The panel also contains:
          </p>
          <ul>
            <li><strong>Auto-refresh</strong> — set to Off, 30s, 1m, or 5m</li>
            <li><strong>Theme toggle</strong> — cycles between Dark, Light, and Charcoal</li>
            <li><strong>Version</strong> — the current Elkwatch version</li>
          </ul>
          <p>
            Toggle the context panel with the <code>&lsaquo;</code> / <code>&rsaquo;</code> button in the topbar.
          </p>
          <div className="docs-sub">Cluster switching</div>
          <p>
            Switching clusters updates the URL query parameter (<code>?cluster=name</code>) and
            is remembered in localStorage. All pages respect the active cluster selection.
          </p>
        </DocSection>

        {/* ── Configuration ────────────────────────── */}
        <DocSection id="config" title="Configuration">
          <p>
            Elkwatch is configured via a <code>config.yml</code> file mounted into the backend
            container as a read-only volume. Changes require a backend restart
            (<code>docker-compose restart backend</code>), not a rebuild.
          </p>
          <div className="docs-sub">Adding a cluster</div>
          <p>
            Add an entry to the <code>clusters</code> array in <code>config.yml</code> with
            the cluster name and Elasticsearch host URL. See <code>config.yml.example</code> for
            the full schema.
          </p>
          <div className="docs-sub">Alert rules</div>
          <p>
            Alert rules are defined under the <code>alerts.rules</code> key in <code>config.yml</code>.
            Each rule specifies a type (e.g., <code>diskUsage</code>, <code>ilmErrors</code>),
            a threshold, and optionally a Slack webhook URL.
          </p>
          <div className="docs-sub">Design principles</div>
          <p>
            Elkwatch is <strong>read-only by design</strong>. It will never modify indices, policies,
            or cluster settings. The ILM policy dry-run is a local validation only.
          </p>
          <div className="docs-tip">
            <strong>Tip:</strong> Use the <code>config.yml.example</code> file in the repository root as a
            starting point. Copy it to <code>config.yml</code> and fill in your cluster details.
          </div>
        </DocSection>

        {/* ── Quick Reference ──────────────────────── */}
        <DocSection id="shortcuts" title="Quick Reference">
          <div className="docs-sub">Status colors</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-green)" }} /> Green — healthy / OK</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-yellow)" }} /> Yellow — degraded / warning</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-red)" }} /> Red — error / critical</div>
          <div className="docs-status-row"><span className="docs-status-dot" style={{ background: "var(--clr-accent)" }} /> Blue — accent / info</div>

          <div className="docs-sub">Controls</div>
          <table className="docs-ref-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>How</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Refresh page data</td><td>Click the <code>↻</code> button in the topbar or page toolbar</td></tr>
              <tr><td>Auto-refresh</td><td>Set interval in the context panel footer (Off / 30s / 1m / 5m)</td></tr>
              <tr><td>Switch cluster</td><td>Click a cluster in the context panel, or use the dropdown on individual pages</td></tr>
              <tr><td>Toggle context panel</td><td>Click the <code>&lsaquo;</code> / <code>&rsaquo;</code> pill in the topbar</td></tr>
              <tr><td>Change theme</td><td>Click the theme icon in the context panel footer (cycles Dark / Light / Charcoal)</td></tr>
              <tr><td>Sort table columns</td><td>Click any column header with a sort indicator</td></tr>
              <tr><td>Filter indices</td><td>Use the search box and dropdown filters in the toolbar</td></tr>
            </tbody>
          </table>

          <div className="docs-sub">Meter bar thresholds</div>
          <table className="docs-ref-table">
            <thead>
              <tr>
                <th>Range</th>
                <th>Color</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>0 -- 79%</td><td>Blue</td><td>Normal</td></tr>
              <tr><td>80 -- 89%</td><td>Yellow</td><td>Warning</td></tr>
              <tr><td>90 -- 100%</td><td>Red</td><td>Critical</td></tr>
            </tbody>
          </table>
        </DocSection>
      </div>
    </div>
  );
}
