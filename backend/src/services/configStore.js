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
