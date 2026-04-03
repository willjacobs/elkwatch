const cron = require("node-cron");
const { getClient } = require("./esClient");
const { insertAlert } = require("./alertStore");
const { listRules, getSetting, ruleCount, createRule, setSetting } = require("./configStore");

/** Per-index ingest tracking: key -> { docCount, lastIncreaseAt } */
const ingestState = new Map();

function recordAlert(ruleName, clusterName, message, severity = "warning") {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    time: new Date().toISOString(),
    ruleId: ruleName,
    cluster: clusterName,
    message,
    severity,
  };
  insertAlert(entry);
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
  const rules = listRules();
  const slackUrl = getSetting("slack_webhook_url") || config.alerts?.slack_webhook_url || "";

  for (const cluster of clusters) {
    for (const rule of rules) {
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

let cronTask;

/** Populated for GET /health so you can confirm cron is firing. */
const schedulerState = {
  startedAt: null,
  lastRunStartedAt: null,
  lastRunFinishedAt: null,
  lastError: null,
};

async function runChecksWithTelemetry(config) {
  schedulerState.lastRunStartedAt = new Date().toISOString();
  schedulerState.lastError = null;
  try {
    await runChecks(config);
  } catch (e) {
    schedulerState.lastError = e.message || String(e);
    console.error("Alert checks failed:", schedulerState.lastError);
  } finally {
    schedulerState.lastRunFinishedAt = new Date().toISOString();
  }
}

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

function seedFromConfig(config) {
  if (ruleCount() > 0) return;
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

module.exports = {
  startAlertScheduler,
  restartAlertScheduler,
  runChecks,
  getAlertSchedulerStatus,
};
