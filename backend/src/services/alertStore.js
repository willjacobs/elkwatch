const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

/** Default rows returned by GET /api/alerts */
const DEFAULT_LIST_LIMIT = 500;
/** Soft cap; prune oldest rows when exceeded */
const MAX_STORED_ROWS = 10_000;
/** Target row count after prune */
const PRUNE_TO_ROWS = 8_000;

let db;

function getDbPath() {
  return process.env.ALERT_DB_PATH || path.join(process.cwd(), "data", "alerts.db");
}

function initAlertStore() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY NOT NULL,
      time TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      cluster TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts (time);
  `);
}

function maybePrune() {
  const { c } = db.prepare(`SELECT COUNT(*) AS c FROM alerts`).get();
  if (c <= MAX_STORED_ROWS) return;
  const toDelete = c - PRUNE_TO_ROWS;
  db.prepare(
    `DELETE FROM alerts WHERE id IN (SELECT id FROM alerts ORDER BY time ASC LIMIT ?)`
  ).run(toDelete);
}

function insertAlert(entry) {
  db.prepare(
    `INSERT INTO alerts (id, time, rule_id, cluster, message, severity)
     VALUES (@id, @time, @ruleId, @cluster, @message, @severity)`
  ).run({
    id: entry.id,
    time: entry.time,
    ruleId: entry.ruleId,
    cluster: entry.cluster,
    message: entry.message,
    severity: entry.severity,
  });
  maybePrune();
}

function listAlerts(limit = DEFAULT_LIST_LIMIT) {
  const cap = Math.min(Math.max(1, Number(limit) || DEFAULT_LIST_LIMIT), 2000);
  return db
    .prepare(
      `SELECT id, time, rule_id AS ruleId, cluster, message, severity
       FROM alerts ORDER BY time DESC LIMIT ?`
    )
    .all(cap);
}

module.exports = {
  initAlertStore,
  insertAlert,
  listAlerts,
  DEFAULT_LIST_LIMIT,
};
