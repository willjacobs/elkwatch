# Alert Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page for managing alert rules and Slack webhook through the UI, with SQLite-backed storage and immediate scheduler reload on changes.

**Architecture:** New `configStore.js` service provides CRUD for an `alert_rules` table and a `settings` key-value table in the existing SQLite database. A new `/api/settings` Express router exposes REST endpoints. The alert scheduler is modified to read rules from the DB and export a `restartAlertScheduler()` function called on every config write. The frontend gets a Settings page with rule cards, inline edit forms, and a Slack webhook field. On first startup with an empty rules table, rules are seeded from config.yml.

**Tech Stack:** Express.js, better-sqlite3 (already installed), React 18, CSS custom properties

**Note on testing:** This project has no test suite. Steps use "implement then verify via API/browser" instead of TDD.

---

## File Map

**New files:**
- `backend/src/services/configStore.js` — CRUD for alert_rules + settings SQLite tables
- `backend/src/routes/settings.js` — REST API for rules and Slack config
- `frontend/src/pages/Settings.jsx` — Settings page component
- `frontend/src/pages/Settings.css` — Settings page styles

**Modified files:**
- `backend/src/services/alertScheduler.js` — read rules from DB, export restartAlertScheduler()
- `backend/src/index.js` — mount settings route, init config tables
- `frontend/src/components/SidebarIcons.jsx` — add IconSettings
- `frontend/src/components/IconRail.jsx` — add Settings nav item at bottom
- `frontend/src/App.jsx` — add route + breadcrumb label

---

## Task 1: Create configStore.js

**Files:**
- Create: `backend/src/services/configStore.js`

- [ ] **Step 1: Create the config store module**

This module shares the same SQLite database file as `alertStore.js`. It imports `better-sqlite3` and opens the same DB path.

```js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db;

function getDbPath() {
  return process.env.ALERT_DB_PATH || path.join(process.cwd(), "data", "alerts.db");
}

function initConfigTables() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function listRules() {
  return db.prepare("SELECT * FROM alert_rules ORDER BY created_at ASC").all().map(parseRule);
}

function getRule(id) {
  const row = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id);
  return row ? parseRule(row) : null;
}

function createRule({ name, type, enabled = true, config = {} }) {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO alert_rules (id, name, type, enabled, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, type, enabled ? 1 : 0, JSON.stringify(config), now, now);
  return getRule(id);
}

function updateRule(id, fields) {
  const existing = getRule(id);
  if (!existing) return null;
  const name = fields.name ?? existing.name;
  const type = fields.type ?? existing.type;
  const enabled = fields.enabled !== undefined ? (fields.enabled ? 1 : 0) : (existing.enabled ? 1 : 0);
  const config = fields.config ?? existing.config;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE alert_rules SET name = ?, type = ?, enabled = ?, config_json = ?, updated_at = ? WHERE id = ?`
  ).run(name, type, enabled, JSON.stringify(config), now, id);
  return getRule(id);
}

function deleteRule(id) {
  const result = db.prepare("DELETE FROM alert_rules WHERE id = ?").run(id);
  return result.changes > 0;
}

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

function ruleCount() {
  const row = db.prepare("SELECT COUNT(*) AS c FROM alert_rules").get();
  return row.c;
}

function parseRule(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config_json || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  initConfigTables,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  getSetting,
  setSetting,
  ruleCount,
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/configStore.js
git commit -m "feat: add configStore for alert rules and settings"
```

---

## Task 2: Create settings API route

**Files:**
- Create: `backend/src/routes/settings.js`

- [ ] **Step 1: Create the settings router**

```js
const express = require("express");
const {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  getSetting,
  setSetting,
} = require("../services/configStore");
const { restartAlertScheduler } = require("../services/alertScheduler");

const router = express.Router();

const VALID_TYPES = ["disk_usage", "ilm_error", "ingest_stall"];

function validateRule(body) {
  const errors = [];
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    errors.push("name is required");
  }
  if (!VALID_TYPES.includes(body.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  const config = body.config || {};
  if (body.type === "disk_usage") {
    const t = config.threshold_percent;
    if (t === undefined || typeof t !== "number" || t < 1 || t > 100) {
      errors.push("disk_usage requires config.threshold_percent (1-100)");
    }
  }
  if (body.type === "ingest_stall") {
    if (!config.index_pattern || typeof config.index_pattern !== "string") {
      errors.push("ingest_stall requires config.index_pattern (non-empty string)");
    }
    const m = config.threshold_minutes;
    if (m === undefined || typeof m !== "number" || m <= 0) {
      errors.push("ingest_stall requires config.threshold_minutes (positive number)");
    }
  }
  return errors;
}

// --- Rules CRUD ---

router.get("/rules", (req, res) => {
  res.json({ rules: listRules() });
});

router.post("/rules", (req, res) => {
  const errors = validateRule(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const rule = createRule({
    name: req.body.name.trim(),
    type: req.body.type,
    enabled: req.body.enabled !== false,
    config: req.body.config || {},
  });
  restartAlertScheduler(req.config);
  res.status(201).json(rule);
});

router.put("/rules/:id", (req, res) => {
  const existing = getRule(req.params.id);
  if (!existing) return res.status(404).json({ error: "Rule not found" });

  const merged = { ...existing, ...req.body, config: req.body.config ?? existing.config };
  const errors = validateRule(merged);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const updated = updateRule(req.params.id, {
    name: req.body.name !== undefined ? req.body.name.trim() : undefined,
    type: req.body.type,
    enabled: req.body.enabled,
    config: req.body.config,
  });
  restartAlertScheduler(req.config);
  res.json(updated);
});

router.delete("/rules/:id", (req, res) => {
  const existed = deleteRule(req.params.id);
  if (!existed) return res.status(404).json({ error: "Rule not found" });
  restartAlertScheduler(req.config);
  res.json({ ok: true });
});

// --- Slack webhook ---

router.get("/slack", (req, res) => {
  const url = getSetting("slack_webhook_url") || "";
  const masked = url.length > 8 ? "***" + url.slice(-8) : url ? "***" : "";
  res.json({ url: masked, configured: Boolean(url) });
});

router.put("/slack", (req, res) => {
  const url = (req.body.url || "").trim();
  setSetting("slack_webhook_url", url);
  restartAlertScheduler(req.config);
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/settings.js
git commit -m "feat: add /api/settings REST API for rules and Slack config"
```

---

## Task 3: Modify alertScheduler to read from DB + export restartAlertScheduler

**Files:**
- Modify: `backend/src/services/alertScheduler.js`

- [ ] **Step 1: Read the current file, then apply these changes:**

1. Add import at the top:
```js
const { listRules, getSetting, ruleCount, createRule, setSetting } = require("./configStore");
```

2. Replace `runChecks(config)` (currently lines 140-149) with:
```js
async function runChecks(config) {
  const clusters = config.clusters || [];
  const rules = listRules();
  const slackUrl = getSetting("slack_webhook_url") || config.alerts?.slack_webhook_url || "";

  for (const cluster of clusters) {
    for (const rule of rules) {
      // Build a rule object compatible with existing check functions
      const ruleObj = {
        name: rule.name,
        type: rule.type,
        enabled: rule.enabled,
        ...rule.config,
      };
      await runRule(cluster, ruleObj, { ...config, alerts: { ...config.alerts, slack_webhook_url: slackUrl } });
    }
  }
}
```

3. Replace `getAlertSchedulerStatus(config)` (currently lines 174-189) with:
```js
function getAlertSchedulerStatus(config) {
  const slackUrl = getSetting("slack_webhook_url") || config?.alerts?.slack_webhook_url || "";
  const rules = listRules();
  const activeRuleCount = rules.filter((r) => r.enabled).length;
  return {
    cronEveryMinutes: 5,
    schedulerRunning: Boolean(cronTask),
    startedAt: schedulerState.startedAt,
    lastRunStartedAt: schedulerState.lastRunStartedAt,
    lastRunFinishedAt: schedulerState.lastRunFinishedAt,
    lastError: schedulerState.lastError,
    clusterCount: (config?.clusters || []).length,
    activeRuleCount,
    slackConfigured: Boolean(slackUrl && !slackUrl.includes("REPLACE_ME")),
  };
}
```

4. Add `seedFromConfig` function and modify `startAlertScheduler`:
```js
function seedFromConfig(config) {
  if (ruleCount() > 0) return; // already seeded
  const rules = config.alerts?.rules || [];
  for (const rule of rules) {
    createRule({
      name: rule.name || rule.type,
      type: rule.type,
      enabled: rule.enabled !== false,
      config: buildConfig(rule),
    });
  }
  const slackUrl = config.alerts?.slack_webhook_url;
  if (slackUrl) {
    setSetting("slack_webhook_url", slackUrl);
  }
  if (rules.length) {
    console.log(`Seeded ${rules.length} alert rule(s) from config.yml`);
  }
}

function buildConfig(rule) {
  if (rule.type === "disk_usage") return { threshold_percent: rule.threshold_percent ?? 80 };
  if (rule.type === "ingest_stall") return { index_pattern: rule.index_pattern || "*", threshold_minutes: rule.threshold_minutes ?? 60 };
  return {};
}
```

5. Replace `startAlertScheduler(config)` (currently lines 191-198):
```js
function startAlertScheduler(config) {
  if (cronTask) {
    cronTask.stop();
  }
  seedFromConfig(config);
  schedulerState.startedAt = new Date().toISOString();
  cronTask = cron.schedule("*/5 * * * *", () => runChecksWithTelemetry(config));
  console.log("Alert scheduler started (every 5 minutes)");
}

function restartAlertScheduler(config) {
  startAlertScheduler(config);
}
```

6. Update `module.exports`:
```js
module.exports = {
  startAlertScheduler,
  restartAlertScheduler,
  runChecks,
  getAlertSchedulerStatus,
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/alertScheduler.js
git commit -m "feat: scheduler reads rules from DB, supports hot-reload and config.yml seed"
```

---

## Task 4: Mount settings route in index.js

**Files:**
- Modify: `backend/src/index.js`

- [ ] **Step 1: Add import and mount**

Add after the existing `require("./services/alertStore")` line:
```js
const { initConfigTables } = require("./services/configStore");
```

Add after the existing `initAlertStore()` call:
```js
try {
  initConfigTables();
} catch (e) {
  console.error("Failed to init config tables:", e.message);
  process.exit(1);
}
```

Add import for the settings router:
```js
const settingsRouter = require("./routes/settings");
```

Add route mount after the existing `app.use("/api/templates", ...)` line:
```js
app.use("/api/settings", settingsRouter);
```

- [ ] **Step 2: Verify — restart the backend and test the API**

```bash
# From the repo root with docker-compose running:
curl -s http://localhost:3001/api/settings/rules | jq .
# Expected: {"rules": [...]} (seeded from config.yml if rules existed)

curl -s http://localhost:3001/api/settings/slack | jq .
# Expected: {"url": "***...", "configured": true/false}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.js
git commit -m "feat: mount settings API route and init config tables"
```

---

## Task 5: Add IconSettings to SidebarIcons + update IconRail

**Files:**
- Modify: `frontend/src/components/SidebarIcons.jsx`
- Modify: `frontend/src/components/IconRail.jsx`

- [ ] **Step 1: Add IconSettings to SidebarIcons.jsx**

Append after the existing `IconHelp` export:

```jsx
export function IconSettings(props) {
  return (
    <svg
      className="app-sidebar-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
```

- [ ] **Step 2: Update IconRail.jsx to add Settings at the bottom**

Add `IconSettings` to the import:
```jsx
import {
  IconAlerts,
  IconILM,
  IconIndices,
  IconNodes,
  IconOverview,
  IconTemplates,
  IconSettings,
} from "./SidebarIcons.jsx";
```

Add the Settings NavLink after the `<div className="rail-spacer" />` (before the closing `</nav>`):

```jsx
      <div className="rail-spacer" />
      <NavLink
        to="/settings"
        className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}
        title="Settings"
        aria-label="Settings"
      >
        <IconSettings />
      </NavLink>
    </nav>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SidebarIcons.jsx frontend/src/components/IconRail.jsx
git commit -m "feat: add IconSettings and Settings nav item to icon rail"
```

---

## Task 6: Create Settings.css

**Files:**
- Create: `frontend/src/pages/Settings.css`

- [ ] **Step 1: Create the styles file**

```css
/* ─── Settings page ───────────────────────────────────── */

.settings-section { margin-bottom: 28px; }
.settings-section-title {
  font-size: 10px; font-weight: 600; color: var(--clr-dim);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 12px;
}

/* Slack card */
.settings-slack-card {
  background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 8px;
  padding: 16px;
}
.settings-field-label { font-size: 11px; font-weight: 600; color: var(--clr-muted2); margin-bottom: 4px; }
.settings-input-row { display: flex; gap: 8px; align-items: center; }
.settings-input {
  flex: 1; background: var(--clr-bg); border: 1px solid var(--clr-border); border-radius: 6px;
  padding: 8px 10px; font-size: 12px; color: var(--clr-text);
  font-family: 'SF Mono', 'Fira Code', monospace;
}
.settings-input:focus { outline: none; border-color: var(--clr-accent); }
.settings-input::placeholder { color: var(--clr-dim); }

/* Rule cards */
.settings-rule {
  background: var(--clr-surface); border: 1px solid var(--clr-border); border-radius: 8px;
  padding: 16px; margin-bottom: 10px;
  display: flex; gap: 16px; align-items: flex-start;
  transition: opacity 0.15s;
}
.settings-rule.disabled { opacity: 0.5; }
.settings-rule-main { flex: 1; min-width: 0; }
.settings-rule-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.settings-rule-name { font-size: 14px; font-weight: 600; color: var(--clr-text); }
.settings-rule-type {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.settings-type-disk_usage   { background: rgba(59,130,246,0.1);  color: var(--clr-accent); }
.settings-type-ilm_error    { background: rgba(167,139,250,0.1); color: var(--clr-purple); }
.settings-type-ingest_stall { background: rgba(74,222,128,0.1);  color: var(--clr-green); }

.settings-rule-config { display: flex; gap: 16px; flex-wrap: wrap; }
.settings-rule-field-label { font-size: 10px; color: var(--clr-dim); text-transform: uppercase; letter-spacing: 0.05em; }
.settings-rule-field-value { font-size: 13px; color: var(--clr-muted); }
.settings-rule-field-value strong { color: var(--clr-text); }

.settings-rule-actions {
  display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0;
}
.settings-rule-btns { display: flex; gap: 4px; }

/* Toggle switch */
.settings-toggle {
  width: 36px; height: 20px; border-radius: 10px; position: relative;
  cursor: pointer; border: none; padding: 0; transition: background 0.15s;
}
.settings-toggle.on { background: var(--clr-accent); }
.settings-toggle.off { background: var(--clr-border); }
.settings-toggle-dot {
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  position: absolute; top: 2px; transition: left 0.15s;
}
.settings-toggle.on .settings-toggle-dot { left: 18px; }
.settings-toggle.off .settings-toggle-dot { left: 2px; }

/* Small icon buttons (edit, delete) */
.settings-icon-btn {
  width: 28px; height: 28px; border-radius: 6px; background: var(--clr-surface-hi);
  border: 1px solid var(--clr-border); display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--clr-muted2); cursor: pointer; transition: border-color 0.12s, color 0.12s;
}
.settings-icon-btn:hover { border-color: var(--clr-accent); color: var(--clr-text); }
.settings-icon-btn.danger:hover { border-color: var(--clr-red); color: var(--clr-red); }

/* Add rule button */
.settings-add-rule {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; border: 1px dashed var(--clr-border); border-radius: 8px;
  color: var(--clr-muted2); font-size: 12px; cursor: pointer;
  background: none; width: 100%; transition: border-color 0.12s, color 0.12s;
  margin-top: 10px;
}
.settings-add-rule:hover { border-color: var(--clr-accent); color: var(--clr-accent); }

/* Inline edit form */
.settings-form {
  background: var(--clr-surface); border: 1px solid var(--clr-accent);
  border-radius: 8px; padding: 16px; margin-bottom: 10px;
}
.settings-form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.settings-form-group { display: flex; flex-direction: column; gap: 4px; }
.settings-form-group.wide { flex: 1; min-width: 200px; }
.settings-form-group label { font-size: 11px; font-weight: 600; color: var(--clr-muted2); }
.settings-form-group input,
.settings-form-group select {
  background: var(--clr-bg); border: 1px solid var(--clr-border); border-radius: 6px;
  padding: 7px 10px; font-size: 12px; color: var(--clr-text);
}
.settings-form-group input:focus,
.settings-form-group select:focus { outline: none; border-color: var(--clr-accent); }
.settings-form-actions { display: flex; gap: 8px; }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Settings.css
git commit -m "feat: add Settings page styles"
```

---

## Task 7: Create Settings.jsx

**Files:**
- Create: `frontend/src/pages/Settings.jsx`

This is the largest task. The component manages:
- Fetching rules from the API
- CRUD operations (create, update, delete, toggle)
- Inline edit/add forms
- Slack webhook management

- [ ] **Step 1: Create the Settings page component**

```jsx
import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { pushToast } from "../hooks/useToasts.js";
import "./Settings.css";

const RULE_TYPES = [
  { value: "disk_usage", label: "Disk Usage" },
  { value: "ilm_error", label: "ILM Error" },
  { value: "ingest_stall", label: "Ingest Stall" },
];

const DEFAULT_CONFIGS = {
  disk_usage: { threshold_percent: 80 },
  ilm_error: {},
  ingest_stall: { index_pattern: "*", threshold_minutes: 60 },
};

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slackUrl, setSlackUrl] = useState("");
  const [slackDirty, setSlackDirty] = useState(false);
  const [slackSaving, setSlackSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/rules");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRules(json.rules);
    } catch (e) {
      pushToast({ title: "Failed to load rules", message: e.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlack = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/slack");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSlackUrl(json.url || "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRules(); fetchSlack(); }, [fetchRules, fetchSlack]);

  const saveSlack = async () => {
    setSlackSaving(true);
    try {
      const res = await fetch("/api/settings/slack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: slackUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({ title: "Slack webhook saved", tone: "success" });
      setSlackDirty(false);
      fetchSlack();
    } catch (e) {
      pushToast({ title: "Failed to save", message: e.message, tone: "error" });
    } finally {
      setSlackSaving(false);
    }
  };

  const toggleRule = async (id, enabled) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      const res = await fetch(`/api/settings/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      pushToast({ title: "Toggle failed", message: e.message, tone: "error" });
      fetchRules();
    }
  };

  const deleteRuleById = async (id) => {
    if (!window.confirm("Delete this alert rule?")) return;
    try {
      const res = await fetch(`/api/settings/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({ title: "Rule deleted", tone: "success" });
      fetchRules();
    } catch (e) {
      pushToast({ title: "Delete failed", message: e.message, tone: "error" });
    }
  };

  const saveRule = async (formData, isNew) => {
    const method = isNew ? "POST" : "PUT";
    const url = isNew ? "/api/settings/rules" : `/api/settings/rules/${formData.id}`;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          enabled: formData.enabled,
          config: formData.config,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      pushToast({ title: isNew ? "Rule created" : "Rule updated", tone: "success" });
      setEditingId(null);
      setAddingNew(false);
      fetchRules();
    } catch (e) {
      pushToast({ title: "Save failed", message: e.message, tone: "error" });
    }
  };

  if (loading) return <LoadingSpinner label="Loading settings" />;

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Slack */}
      <div className="settings-section">
        <div className="settings-section-title">Slack Integration</div>
        <div className="settings-slack-card">
          <div className="settings-field-label">Webhook URL</div>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="text"
              value={slackUrl}
              onChange={(e) => { setSlackUrl(e.target.value); setSlackDirty(true); }}
              placeholder="https://hooks.slack.com/services/..."
            />
            <button
              className="btn btn-primary"
              onClick={saveSlack}
              disabled={!slackDirty || slackSaving}
              style={{ padding: "8px 14px", fontSize: "11px" }}
            >
              {slackSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="settings-section">
        <div className="settings-section-title">Alert Rules</div>

        {rules.map((rule) =>
          editingId === rule.id ? (
            <RuleForm
              key={rule.id}
              initial={rule}
              onSave={(data) => saveRule(data, false)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={(enabled) => toggleRule(rule.id, enabled)}
              onEdit={() => { setEditingId(rule.id); setAddingNew(false); }}
              onDelete={() => deleteRuleById(rule.id)}
            />
          )
        )}

        {addingNew ? (
          <RuleForm
            initial={{ name: "", type: "disk_usage", enabled: true, config: DEFAULT_CONFIGS.disk_usage }}
            onSave={(data) => saveRule(data, true)}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          <button className="settings-add-rule" onClick={() => { setAddingNew(true); setEditingId(null); }}>
            + Add alert rule
          </button>
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  return (
    <div className={`settings-rule${rule.enabled ? "" : " disabled"}`}>
      <div className="settings-rule-main">
        <div className="settings-rule-header">
          <span className="settings-rule-name">{rule.name}</span>
          <span className={`settings-rule-type settings-type-${rule.type}`}>{rule.type}</span>
        </div>
        <div className="settings-rule-config">
          {rule.type === "disk_usage" && (
            <div>
              <div className="settings-rule-field-label">Threshold</div>
              <div className="settings-rule-field-value"><strong>{rule.config.threshold_percent ?? 80}%</strong></div>
            </div>
          )}
          {rule.type === "ilm_error" && (
            <div>
              <div className="settings-rule-field-label">Config</div>
              <div className="settings-rule-field-value">No additional parameters</div>
            </div>
          )}
          {rule.type === "ingest_stall" && (
            <>
              <div>
                <div className="settings-rule-field-label">Index pattern</div>
                <div className="settings-rule-field-value"><strong>{rule.config.index_pattern || "*"}</strong></div>
              </div>
              <div>
                <div className="settings-rule-field-label">Stall threshold</div>
                <div className="settings-rule-field-value"><strong>{rule.config.threshold_minutes ?? 60} min</strong></div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="settings-rule-actions">
        <button
          className={`settings-toggle ${rule.enabled ? "on" : "off"}`}
          onClick={() => onToggle(!rule.enabled)}
          title={rule.enabled ? "Disable" : "Enable"}
        >
          <div className="settings-toggle-dot" />
        </button>
        <div className="settings-rule-btns">
          <button className="settings-icon-btn" onClick={onEdit} title="Edit">✎</button>
          <button className="settings-icon-btn danger" onClick={onDelete} title="Delete">✕</button>
        </div>
      </div>
    </div>
  );
}

function RuleForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [enabled] = useState(initial.enabled);
  const [config, setConfig] = useState(initial.config);

  const handleTypeChange = (newType) => {
    setType(newType);
    setConfig(DEFAULT_CONFIGS[newType] || {});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { pushToast({ title: "Name is required", tone: "error" }); return; }
    onSave({ id: initial.id, name, type, enabled, config });
  };

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <div className="settings-form-row">
        <div className="settings-form-group wide">
          <label>Rule name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., High disk usage" />
        </div>
        <div className="settings-form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {type === "disk_usage" && (
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label>Threshold (%)</label>
            <input
              type="number" min="1" max="100"
              value={config.threshold_percent ?? 80}
              onChange={(e) => setConfig({ ...config, threshold_percent: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {type === "ingest_stall" && (
        <div className="settings-form-row">
          <div className="settings-form-group wide">
            <label>Index pattern</label>
            <input
              value={config.index_pattern || ""}
              onChange={(e) => setConfig({ ...config, index_pattern: e.target.value })}
              placeholder="*"
            />
          </div>
          <div className="settings-form-group">
            <label>Stall threshold (minutes)</label>
            <input
              type="number" min="1"
              value={config.threshold_minutes ?? 60}
              onChange={(e) => setConfig({ ...config, threshold_minutes: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="settings-form-actions">
        <button type="submit" className="btn btn-primary">{initial.id ? "Save changes" : "Create rule"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "feat: add Settings page with rule management and Slack config"
```

---

## Task 8: Wire up Settings route in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add import**

Add after the existing Docs import:
```jsx
import Settings from "./pages/Settings.jsx";
```

- [ ] **Step 2: Add pageLabel case**

In the `pageLabel` useMemo, add before `return ""`:
```jsx
    if (p === "/settings") return "Settings";
```

- [ ] **Step 3: Add Route**

Inside the `<Routes>` block, add after the docs route:
```jsx
            <Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add Settings route and breadcrumb label"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| alert_rules + settings SQLite tables | Task 1 |
| CRUD API endpoints | Task 2 |
| Validation (type-specific) | Task 2 |
| Scheduler reads from DB | Task 3 |
| Scheduler hot-reload (restartAlertScheduler) | Task 3 |
| Config.yml seed migration | Task 3 |
| Mount route + init tables in index.js | Task 4 |
| Gear icon in icon rail | Task 5 |
| Settings page styles | Task 6 |
| Settings page (Slack + rules CRUD + forms) | Task 7 |
| Route + breadcrumb in App.jsx | Task 8 |
| Slack URL masked on GET | Task 2 |
| Toggle enabled/disabled (immediate) | Task 7 |
| Delete with confirmation | Task 7 |
| Inline edit form | Task 7 |

**No placeholders found.** All tasks contain complete code.

**Type consistency:** `listRules()` returns `{id, name, type, enabled, config, createdAt, updatedAt}` — used consistently in API response, Settings.jsx state, RuleCard, and RuleForm.
