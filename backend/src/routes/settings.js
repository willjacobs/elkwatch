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

const VALID_TYPES = ["disk_usage", "ilm_error", "ingest_stall", "cluster_health_change", "heap_pressure", "unassigned_shards", "shard_count"];

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
  return errors;
}

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
