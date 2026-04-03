# Alert Settings UI — Design Spec

**Date:** 2026-04-03
**Status:** Approved

---

## Overview

Add a Settings page to Elkwatch for managing alert rules and Slack webhook configuration through the UI, replacing the need to manually edit config.yml. Alert rules are stored in SQLite (same database as alert history). Changes take effect immediately via scheduler hot-reload.

**Scope:** Alert rules (CRUD + enable/disable) and Slack webhook URL. Cluster configuration stays in config.yml.

**Navigation:** Dedicated Settings page accessible via a gear icon at the bottom of the icon rail.

---

## Backend

### Database schema

Two new tables in the existing SQLite database (`alertStore.js`):

```sql
CREATE TABLE alert_rules (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,          -- 'disk_usage' | 'ilm_error' | 'ingest_stall'
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

The `config_json` column stores type-specific parameters as JSON:
- `disk_usage`: `{"threshold_percent": 80}`
- `ilm_error`: `{}`
- `ingest_stall`: `{"index_pattern": "*", "threshold_minutes": 60}`

### New file: `backend/src/services/configStore.js`

Provides CRUD operations for the `alert_rules` and `settings` tables. Uses the same `better-sqlite3` database instance as `alertStore.js`. Functions:

- `initConfigTables()` — creates tables if they don't exist
- `listRules()` — returns all rules ordered by created_at
- `getRule(id)` — returns a single rule by ID
- `createRule({ name, type, enabled, config })` — inserts a new rule, returns it
- `updateRule(id, { name, type, enabled, config })` — updates a rule, returns it
- `deleteRule(id)` — deletes a rule
- `toggleRule(id, enabled)` — sets enabled flag
- `getSetting(key)` — returns a setting value
- `setSetting(key, value)` — upserts a setting

### New file: `backend/src/routes/settings.js`

Express router mounted at `/api/settings`. Endpoints:

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/api/settings/rules` | — | List all alert rules |
| POST | `/api/settings/rules` | `{name, type, enabled?, config?}` | Create a rule |
| PUT | `/api/settings/rules/:id` | `{name?, type?, enabled?, config?}` | Update a rule |
| DELETE | `/api/settings/rules/:id` | — | Delete a rule |
| GET | `/api/settings/slack` | — | Get Slack URL (masked: last 8 chars visible) |
| PUT | `/api/settings/slack` | `{url}` | Update Slack webhook URL |

Validation:
- `type` must be one of `disk_usage`, `ilm_error`, `ingest_stall`
- `name` must be non-empty
- `disk_usage` config must have `threshold_percent` (number, 1–100)
- `ingest_stall` config must have `index_pattern` (non-empty string) and `threshold_minutes` (positive number)
- Returns 400 with `{error: "message"}` on validation failure

Every write endpoint calls `restartAlertScheduler()` after the database write.

### Modified: `backend/src/services/alertScheduler.js`

Changes:
- Export `restartAlertScheduler()` — stops the current cron job and starts a new one
- `runChecks()` reads rules from `configStore.listRules()` instead of `config.alerts.rules`
- `runChecks()` reads Slack webhook from `configStore.getSetting("slack_webhook_url")` instead of `config.alerts.slack_webhook_url`
- The `startAlertScheduler(config)` function seeds from config.yml on first call if the `alert_rules` table is empty

### Modified: `backend/src/index.js`

Changes:
- Import and mount settings router: `app.use("/api/settings", settingsRoute)`
- Call `initConfigTables()` during startup (after `initAlertDb()`)
- Pass config to `startAlertScheduler(config)` for initial seed

### Migration from config.yml

On the first call to `startAlertScheduler(config)`:
1. Check if `alert_rules` table has any rows
2. If empty AND `config.alerts.rules` exists with entries:
   - Insert each rule into `alert_rules` with a generated UUID, preserving name, type, enabled, and type-specific config
   - Insert `slack_webhook_url` into `settings` if present in config
3. After migration, the scheduler always reads from the database

---

## Frontend

### New file: `frontend/src/pages/Settings.jsx`

The Settings page component. Structure:

1. **Page toolbar** — "Settings" title
2. **Slack Integration section** — card with webhook URL input and Save button. URL is masked on load (fetched from `GET /api/settings/slack`). Editing replaces the masked value.
3. **Alert Rules section** — list of rule cards + "Add alert rule" button

**Rule card** (view mode):
- Rule name (bold), type badge (colored pill: disk_usage=blue, ilm_error=purple, ingest_stall=green)
- Type-specific config fields displayed as label/value pairs
- Enable/disable toggle (immediate save via `PUT /api/settings/rules/:id`)
- Edit button → switches card to edit mode
- Delete button → confirmation prompt, then `DELETE /api/settings/rules/:id`
- Disabled rules are visually dimmed (opacity)

**Rule card** (edit mode) / Add rule form:
- Name text input
- Type select dropdown (disk_usage, ilm_error, ingest_stall)
- Type-specific config fields (shown/hidden based on selected type):
  - `disk_usage`: threshold percent (number input, default 80)
  - `ilm_error`: no additional fields
  - `ingest_stall`: index pattern (text input, default `*`), threshold minutes (number input, default 60)
- Save / Cancel buttons
- All fields validated client-side before submit

**State management:**
- Fetch rules on mount via `GET /api/settings/rules`
- Optimistic UI for toggle (update state immediately, revert on error)
- Refetch full rule list after create/update/delete (simple, avoids stale state)
- Toast notifications on success/error using existing `pushToast()`

### New file: `frontend/src/pages/Settings.css`

Scoped styles for the Settings page. Follows existing patterns (`.settings-` prefix). Key classes for rule cards, toggle switches, type badges, inline edit forms, and the add-rule dashed button.

### Modified: `frontend/src/components/SidebarIcons.jsx`

Add `IconSettings` export — gear SVG icon, same pattern as all other icons (18x18, stroke="currentColor", viewBox 0 0 24 24).

### Modified: `frontend/src/components/IconRail.jsx`

Add a Settings nav item at the bottom of the icon rail (after the `rail-spacer`), using `IconSettings`. Links to `/settings`.

### Modified: `frontend/src/App.jsx`

- Import `Settings` page and add `<Route path="/settings" element={<Settings />} />`
- Add `if (p === "/settings") return "Settings";` to `pageLabel`

---

## Files Changed

**New files:**
- `backend/src/services/configStore.js` — CRUD for alert_rules + settings tables
- `backend/src/routes/settings.js` — REST API endpoints
- `frontend/src/pages/Settings.jsx` — Settings page component
- `frontend/src/pages/Settings.css` — Settings page styles

**Modified files:**
- `backend/src/services/alertScheduler.js` — read from DB, export restartAlertScheduler()
- `backend/src/index.js` — mount settings route, init config tables
- `frontend/src/components/SidebarIcons.jsx` — add IconSettings
- `frontend/src/components/IconRail.jsx` — add Settings nav item
- `frontend/src/App.jsx` — add route and breadcrumb label

---

## Out of Scope

- Cluster management (add/remove/edit Elasticsearch clusters) — stays in config.yml
- Changing the alert check interval (stays at 5 minutes via cron)
- Alert rule testing / "run now" button (could be a follow-up)
- Authentication / authorization for the settings API
