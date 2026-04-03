# New Alert Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new alert rule types: cluster_health_change, heap_pressure, unassigned_shards, and shard_count.

**Architecture:** Each new type gets a check function in `alertScheduler.js` following the exact pattern of existing checks (checkDiskUsage, checkIlmErrors, checkIngestStall). Two types need in-memory state tracking (cluster_health_change tracks previous status, unassigned_shards tracks when unassigned first appeared). The settings API validation and frontend Settings page are updated to support the new types and their config fields.

**Tech Stack:** Express.js, better-sqlite3, @elastic/elasticsearch v8, React 18

---

## File Map

**Modified files:**
- `backend/src/services/alertScheduler.js` — add 4 check functions + 4 switch cases + extend buildConfig
- `backend/src/routes/settings.js` — extend VALID_TYPES + add validation for new types
- `frontend/src/pages/Settings.jsx` — extend RULE_TYPES, DEFAULT_CONFIGS, RuleCard display, RuleForm fields
- `frontend/src/pages/Settings.css` — add badge colors for new types

---

## Task 1: Add check functions to alertScheduler.js

**Files:**
- Modify: `backend/src/services/alertScheduler.js`

- [ ] **Step 1: Add state tracking Map for cluster health and unassigned shards**

After the existing `const ingestState = new Map();` (line 7), add:

```js
/** Per-cluster health tracking: clusterName -> previous status string */
const healthState = new Map();

/** Per-cluster unassigned shard tracking: clusterName -> { count, firstSeenAt } */
const unassignedState = new Map();
```

- [ ] **Step 2: Add checkClusterHealthChange function**

Add after the `checkIngestStall` function (after line 116):

```js
async function checkClusterHealthChange(cluster, rule, config) {
  const client = getClient(cluster);
  const health = await client.cluster.health();
  const current = health.status;
  const previous = healthState.get(cluster.name);

  healthState.set(cluster.name, current);

  if (!previous) return; // first check, just record baseline

  const severity_order = { green: 0, yellow: 1, red: 2 };
  const prevLevel = severity_order[previous] ?? 0;
  const currLevel = severity_order[current] ?? 0;

  if (currLevel > prevLevel) {
    const msg = `Cluster "${cluster.name}" health degraded: ${previous} → ${current}`;
    const sev = current === "red" ? "error" : "warning";
    recordAlert(rule.name || "cluster_health_change", cluster.name, msg, sev);
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
  }
}
```

- [ ] **Step 3: Add checkHeapPressure function**

Add after checkClusterHealthChange:

```js
async function checkHeapPressure(cluster, rule, config) {
  const client = getClient(cluster);
  const nodesStats = await client.nodes.stats({ metric: "jvm" });
  const nodes = nodesStats.nodes || {};
  const threshold = rule.threshold_percent ?? 85;

  for (const [nodeId, node] of Object.entries(nodes)) {
    const heapPct = node.jvm?.mem?.heap_used_percent;
    if (heapPct == null) continue;

    if (heapPct >= threshold) {
      const nodeName = node.name || nodeId;
      const msg = `Node "${nodeName}" on "${cluster.name}" heap at ${heapPct}% (threshold ${threshold}%)`;
      recordAlert(rule.name || "heap_pressure", cluster.name, msg, heapPct >= 95 ? "error" : "warning");
      await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
    }
  }
}
```

- [ ] **Step 4: Add checkUnassignedShards function**

Add after checkHeapPressure:

```js
async function checkUnassignedShards(cluster, rule, config) {
  const client = getClient(cluster);
  const health = await client.cluster.health();
  const count = health.unassigned_shards ?? 0;
  const thresholdMinutes = rule.threshold_minutes ?? 10;
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const now = Date.now();
  const key = cluster.name;

  if (count === 0) {
    unassignedState.delete(key);
    return;
  }

  let state = unassignedState.get(key);
  if (!state) {
    unassignedState.set(key, { count, firstSeenAt: now });
    return;
  }

  state.count = count;
  unassignedState.set(key, state);

  if (now - state.firstSeenAt >= thresholdMs) {
    const msg = `Cluster "${cluster.name}" has ${count} unassigned shard(s) for ${thresholdMinutes}+ min`;
    recordAlert(rule.name || "unassigned_shards", cluster.name, msg, "warning");
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
    state.firstSeenAt = now; // reset to avoid re-alerting every 5 min
    unassignedState.set(key, state);
  }
}
```

- [ ] **Step 5: Add checkShardCount function**

Add after checkUnassignedShards:

```js
async function checkShardCount(cluster, rule, config) {
  const client = getClient(cluster);
  const health = await client.cluster.health();
  const total = (health.active_primary_shards ?? 0) + (health.active_shards ?? 0) - (health.active_primary_shards ?? 0) + (health.unassigned_shards ?? 0) + (health.relocating_shards ?? 0) + (health.initializing_shards ?? 0);
  const threshold = rule.threshold_count ?? 1000;

  if (total >= threshold) {
    const msg = `Cluster "${cluster.name}" has ${total} total shards (threshold ${threshold})`;
    const sev = total >= threshold * 1.5 ? "error" : "warning";
    recordAlert(rule.name || "shard_count", cluster.name, msg, sev);
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
  }
}
```

**Wait** — the total shard calculation above is wrong. Let me simplify. The `cluster.health()` response has `active_shards` (includes all active primaries + replicas) plus `unassigned_shards`, `relocating_shards`, `initializing_shards`. The real total is:

```js
async function checkShardCount(cluster, rule, config) {
  const client = getClient(cluster);
  const health = await client.cluster.health();
  const total = (health.active_shards ?? 0) + (health.unassigned_shards ?? 0) + (health.relocating_shards ?? 0) + (health.initializing_shards ?? 0);
  const threshold = rule.threshold_count ?? 1000;

  if (total >= threshold) {
    const msg = `Cluster "${cluster.name}" has ${total} total shards (threshold ${threshold})`;
    const sev = total >= threshold * 1.5 ? "error" : "warning";
    recordAlert(rule.name || "shard_count", cluster.name, msg, sev);
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
  }
}
```

- [ ] **Step 6: Add the 4 new cases to the runRule switch statement**

In the `runRule` function, add these cases before the `default:` case:

```js
      case "cluster_health_change":
        await checkClusterHealthChange(cluster, rule, config);
        break;
      case "heap_pressure":
        await checkHeapPressure(cluster, rule, config);
        break;
      case "unassigned_shards":
        await checkUnassignedShards(cluster, rule, config);
        break;
      case "shard_count":
        await checkShardCount(cluster, rule, config);
        break;
```

- [ ] **Step 7: Extend buildConfig to handle new types**

In the `buildConfig` function, add before `return {};`:

```js
  if (rule.type === "cluster_health_change") return {};
  if (rule.type === "heap_pressure") return { threshold_percent: rule.threshold_percent ?? 85 };
  if (rule.type === "unassigned_shards") return { threshold_minutes: rule.threshold_minutes ?? 10 };
  if (rule.type === "shard_count") return { threshold_count: rule.threshold_count ?? 1000 };
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/alertScheduler.js
git commit -m "feat: add cluster_health_change, heap_pressure, unassigned_shards, shard_count alert types"
```

---

## Task 2: Extend settings API validation

**Files:**
- Modify: `backend/src/routes/settings.js`

- [ ] **Step 1: Update VALID_TYPES**

Replace the existing line:
```js
const VALID_TYPES = ["disk_usage", "ilm_error", "ingest_stall"];
```
With:
```js
const VALID_TYPES = ["disk_usage", "ilm_error", "ingest_stall", "cluster_health_change", "heap_pressure", "unassigned_shards", "shard_count"];
```

- [ ] **Step 2: Add validation rules for new types**

In the `validateRule` function, add these blocks after the existing `ingest_stall` validation (before `return errors;`):

```js
  if (body.type === "heap_pressure") {
    const t = config.threshold_percent;
    if (t === undefined || typeof t !== "number" || t < 1 || t > 100) {
      errors.push("heap_pressure requires config.threshold_percent (1-100)");
    }
  }
  if (body.type === "unassigned_shards") {
    const m = config.threshold_minutes;
    if (m === undefined || typeof m !== "number" || m <= 0) {
      errors.push("unassigned_shards requires config.threshold_minutes (positive number)");
    }
  }
  if (body.type === "shard_count") {
    const c = config.threshold_count;
    if (c === undefined || typeof c !== "number" || c <= 0) {
      errors.push("shard_count requires config.threshold_count (positive number)");
    }
  }
```

Note: `cluster_health_change` has no config fields, so no validation needed (same as `ilm_error`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/settings.js
git commit -m "feat: extend settings API validation for new alert types"
```

---

## Task 3: Update frontend Settings page

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.css`

- [ ] **Step 1: Add CSS badge colors for new types**

Append to `frontend/src/pages/Settings.css`:

```css
.settings-type-cluster_health_change { background: rgba(248,113,113,0.1); color: var(--clr-red); }
.settings-type-heap_pressure         { background: rgba(250,204,21,0.1);  color: var(--clr-yellow); }
.settings-type-unassigned_shards     { background: rgba(251,146,60,0.1);  color: #fb923c; }
.settings-type-shard_count           { background: rgba(56,189,248,0.1);  color: #38bdf8; }
```

- [ ] **Step 2: Update RULE_TYPES and DEFAULT_CONFIGS in Settings.jsx**

Replace the existing `RULE_TYPES` array:
```js
const RULE_TYPES = [
  { value: "disk_usage", label: "Disk Usage" },
  { value: "ilm_error", label: "ILM Error" },
  { value: "ingest_stall", label: "Ingest Stall" },
  { value: "cluster_health_change", label: "Cluster Health Change" },
  { value: "heap_pressure", label: "Heap Pressure" },
  { value: "unassigned_shards", label: "Unassigned Shards" },
  { value: "shard_count", label: "Shard Count" },
];
```

Replace the existing `DEFAULT_CONFIGS` object:
```js
const DEFAULT_CONFIGS = {
  disk_usage: { threshold_percent: 80 },
  ilm_error: {},
  ingest_stall: { index_pattern: "*", threshold_minutes: 60 },
  cluster_health_change: {},
  heap_pressure: { threshold_percent: 85 },
  unassigned_shards: { threshold_minutes: 10 },
  shard_count: { threshold_count: 1000 },
};
```

- [ ] **Step 3: Add RuleCard display blocks for new types**

In the `RuleCard` function, inside the `<div className="settings-rule-config">` block, after the existing `ingest_stall` block (after line 226), add:

```jsx
          {rule.type === "cluster_health_change" && (
            <div>
              <div className="settings-rule-field-label">Config</div>
              <div className="settings-rule-field-value">Alerts on status degradation</div>
            </div>
          )}
          {rule.type === "heap_pressure" && (
            <div>
              <div className="settings-rule-field-label">Threshold</div>
              <div className="settings-rule-field-value"><strong>{rule.config.threshold_percent ?? 85}%</strong></div>
            </div>
          )}
          {rule.type === "unassigned_shards" && (
            <div>
              <div className="settings-rule-field-label">Duration threshold</div>
              <div className="settings-rule-field-value"><strong>{rule.config.threshold_minutes ?? 10} min</strong></div>
            </div>
          )}
          {rule.type === "shard_count" && (
            <div>
              <div className="settings-rule-field-label">Max shards</div>
              <div className="settings-rule-field-value"><strong>{rule.config.threshold_count ?? 1000}</strong></div>
            </div>
          )}
```

- [ ] **Step 4: Add RuleForm fields for new types**

In the `RuleForm` function, after the existing `ingest_stall` form block, add:

```jsx
      {type === "heap_pressure" && (
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label>Threshold (%)</label>
            <input
              type="number" min="1" max="100"
              value={config.threshold_percent ?? 85}
              onChange={(e) => setConfig({ ...config, threshold_percent: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {type === "unassigned_shards" && (
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label>Duration threshold (minutes)</label>
            <input
              type="number" min="1"
              value={config.threshold_minutes ?? 10}
              onChange={(e) => setConfig({ ...config, threshold_minutes: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {type === "shard_count" && (
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label>Max shard count</label>
            <input
              type="number" min="1"
              value={config.threshold_count ?? 1000}
              onChange={(e) => setConfig({ ...config, threshold_count: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
```

Note: `cluster_health_change` has no config fields, so no form block needed (same as `ilm_error`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/Settings.css
git commit -m "feat: add new alert types to Settings page UI"
```

---

## Self-Review

**Coverage:**

| Alert type | Check function | Switch case | buildConfig | API validation | RULE_TYPES | DEFAULT_CONFIGS | RuleCard display | RuleForm fields | CSS badge |
|---|---|---|---|---|---|---|---|---|---|
| cluster_health_change | Task 1.2 | Task 1.6 | Task 1.7 | (no config) | Task 3.2 | Task 3.2 | Task 3.3 | (no fields) | Task 3.1 |
| heap_pressure | Task 1.3 | Task 1.6 | Task 1.7 | Task 2.2 | Task 3.2 | Task 3.2 | Task 3.3 | Task 3.4 | Task 3.1 |
| unassigned_shards | Task 1.4 | Task 1.6 | Task 1.7 | Task 2.2 | Task 3.2 | Task 3.2 | Task 3.3 | Task 3.4 | Task 3.1 |
| shard_count | Task 1.5 | Task 1.6 | Task 1.7 | Task 2.2 | Task 3.2 | Task 3.2 | Task 3.3 | Task 3.4 | Task 3.1 |

**No placeholders found.** All tasks contain complete code.

**Type consistency:** `threshold_percent` used for heap_pressure (same pattern as disk_usage). `threshold_minutes` used for unassigned_shards (same pattern as ingest_stall). `threshold_count` is new and used consistently across check function, validation, default config, card display, and form input.
