const cron = require("node-cron");
const { getClient } = require("./esClient");

const MAX_ALERTS = 100;
const alerts = [];

/** Per-index ingest tracking: key -> { docCount, lastIncreaseAt } */
const ingestState = new Map();

function pushAlert(entry) {
  alerts.unshift(entry);
  if (alerts.length > MAX_ALERTS) {
    alerts.length = MAX_ALERTS;
  }
}

function recordAlert(ruleName, clusterName, message, severity = "warning") {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    time: new Date().toISOString(),
    ruleId: ruleName,
    cluster: clusterName,
    message,
    severity,
  };
  pushAlert(entry);
  return entry;
}

async function postSlack(webhookUrl, text) {
  if (!webhookUrl || webhookUrl.includes("REPLACE_ME")) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("Slack webhook failed:", e.message);
  }
}

async function checkDiskUsage(cluster, rule, config) {
  const client = getClient(cluster);
  const stats = await client.cluster.stats();
  const fsStats = stats.nodes?.fs;
  if (!fsStats?.total_in_bytes || fsStats.total_in_bytes === 0) return;

  const used = fsStats.total_in_bytes - (fsStats.free_in_bytes || 0);
  const pct = Math.round((used / fsStats.total_in_bytes) * 100);
  const threshold = rule.threshold_percent ?? 80;

  if (pct >= threshold) {
    const msg = `Cluster "${cluster.name}" disk usage ${pct}% (threshold ${threshold}%)`;
    const entry = recordAlert(rule.name || "disk_usage", cluster.name, msg, "warning");
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
  }
}

async function checkIlmErrors(cluster, rule, config) {
  const client = getClient(cluster);
  const explained = await client.ilm.explainLifecycle({ index: "*" });
  const indices = explained.indices || {};
  const failed = Object.entries(indices).filter(
    ([, v]) => v.step_info?.failed_step || v.error
  );

  if (failed.length > 0) {
    const msg = `Cluster "${cluster.name}": ${failed.length} index(es) with ILM failure or failed_step`;
    recordAlert(rule.name || "ilm_error", cluster.name, msg, "error");
    await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
  }
}

async function checkIngestStall(cluster, rule, config) {
  const client = getClient(cluster);
  const pattern = rule.index_pattern || "*";
  const thresholdMinutes = rule.threshold_minutes ?? 60;
  const thresholdMs = thresholdMinutes * 60 * 1000;

  const cat = await client.cat.indices({
    format: "json",
    index: pattern,
    h: "index,docs.count",
  });

  const rows = Array.isArray(cat) ? cat : [];
  const now = Date.now();

  for (const row of rows) {
    const indexName = row.index;
    if (!indexName) continue;
    const docCount = parseInt(row["docs.count"], 10) || 0;
    const key = `${cluster.name}:${indexName}`;
    let state = ingestState.get(key);

    if (!state) {
      ingestState.set(key, { docCount, lastIncreaseAt: now });
      continue;
    }

    if (docCount > state.docCount) {
      state.docCount = docCount;
      state.lastIncreaseAt = now;
      ingestState.set(key, state);
      continue;
    }

    if (docCount < state.docCount) {
      state.docCount = docCount;
      state.lastIncreaseAt = now;
      ingestState.set(key, state);
      continue;
    }

    if (now - state.lastIncreaseAt >= thresholdMs) {
      const msg = `Index "${indexName}" on "${cluster.name}" no new docs for ${thresholdMinutes}+ min (docs count ${docCount})`;
      recordAlert(rule.name || "ingest_stall", cluster.name, msg, "warning");
      await postSlack(config.alerts?.slack_webhook_url, `[Elkwatch] ${msg}`);
      state.lastIncreaseAt = now;
      ingestState.set(key, state);
    }
  }
}

async function runRule(cluster, rule, config) {
  if (rule.enabled === false) return;

  const type = rule.type;
  try {
    switch (type) {
      case "disk_usage":
        await checkDiskUsage(cluster, rule, config);
        break;
      case "ilm_error":
        await checkIlmErrors(cluster, rule, config);
        break;
      case "ingest_stall":
        await checkIngestStall(cluster, rule, config);
        break;
      default:
        console.warn(`Unknown alert rule type: ${type}`);
    }
  } catch (e) {
    console.error(`Alert check failed [${cluster.name}] ${rule.type}:`, e.message);
  }
}

async function runChecks(config) {
  const clusters = config.clusters || [];
  const rules = config.alerts?.rules || [];

  for (const cluster of clusters) {
    for (const rule of rules) {
      await runRule(cluster, rule, config);
    }
  }
}

let cronTask;

function startAlertScheduler(config) {
  if (cronTask) {
    cronTask.stop();
  }
  cronTask = cron.schedule("*/5 * * * *", () => runChecks(config));
  console.log("Alert scheduler started (every 5 minutes)");
}

function getAlerts() {
  return [...alerts];
}

module.exports = {
  startAlertScheduler,
  getAlerts,
  runChecks,
};
