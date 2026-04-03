const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();
const ILM_CACHE_TTL_MS = 20_000;
const ilmSnapshotCache = new Map();

function safeJsonParse(text) {
  if (typeof text !== "string") return { ok: false, error: "Expected JSON string" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
}

function normalizePoliciesResponse(policiesRes) {
  if (!policiesRes) return {};
  const body = policiesRes.body ?? policiesRes;
  if (!body) return {};
  // ES typically returns a map: { "<policyName>": { policy: {...}, ... } }
  if (typeof body === "object" && !Array.isArray(body)) return body;
  return {};
}

function collectLeafChanges(before, after, path, out, limit) {
  if (out.length >= limit) return;

  const bObj = before && typeof before === "object";
  const aObj = after && typeof after === "object";

  if (!bObj && !aObj) {
    out.push({ path: path || "$", before, after });
    return;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    const bArr = Array.isArray(before) ? before : [];
    const aArr = Array.isArray(after) ? after : [];
    const max = Math.max(bArr.length, aArr.length);
    for (let i = 0; i < max && out.length < limit; i++) {
      collectLeafChanges(
        bArr[i],
        aArr[i],
        `${path}[${i}]`,
        out,
        limit
      );
    }
    return;
  }

  const bKeys = bObj ? Object.keys(before) : [];
  const aKeys = aObj ? Object.keys(after) : [];
  const keys = Array.from(new Set([...bKeys, ...aKeys])).sort((a, b) =>
    a.localeCompare(b)
  );

  if (!keys.length) {
    out.push({ path: path || "$", before, after });
    return;
  }

  for (const k of keys) {
    if (out.length >= limit) break;
    const nextPath = path ? `${path}.${k}` : k;
    collectLeafChanges(
      bObj ? before[k] : undefined,
      aObj ? after[k] : undefined,
      nextPath,
      out,
      limit
    );
  }
}

function deepDiff(before, after, path = "", out = [], limit = 200, options = {}) {
  if (out.length >= limit) return out;

  const includeMetaDiff = options.includeMetaDiff === true;

  const sameType =
    (before === null && after === null) ||
    (before !== null && after !== null && typeof before === typeof after);

  if (!sameType) {
    out.push({ path: path || "$", before, after });
    return out;
  }

  if (before === after) return out;

  if (typeof before !== "object" || before === null) {
    out.push({ path: path || "$", before, after });
    return out;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    const bArr = Array.isArray(before) ? before : [];
    const aArr = Array.isArray(after) ? after : [];
    const max = Math.max(bArr.length, aArr.length);
    for (let i = 0; i < max && out.length < limit; i++) {
      deepDiff(bArr[i], aArr[i], `${path}[${i}]`, out, limit, options);
    }
    return out;
  }

  const bKeys = new Set(Object.keys(before));
  const aKeys = new Set(Object.keys(after));
  const keys = Array.from(new Set([...bKeys, ...aKeys])).sort((a, b) =>
    a.localeCompare(b)
  );

  for (const k of keys) {
    if (out.length >= limit) break;
    if (!includeMetaDiff && (path ? `${path}.${k}` : k) === "_meta") continue;
    const nextPath = path ? `${path}.${k}` : k;
    if (!aKeys.has(k)) {
      collectLeafChanges(before[k], undefined, nextPath, out, limit);
      continue;
    }
    if (!bKeys.has(k)) {
      collectLeafChanges(undefined, after[k], nextPath, out, limit);
      continue;
    }
    deepDiff(before[k], after[k], nextPath, out, limit, options);
  }
  return out;
}

function getCacheEntry(clusterName) {
  if (!ilmSnapshotCache.has(clusterName)) {
    ilmSnapshotCache.set(clusterName, {
      at: 0,
      value: null,
      inFlight: null,
    });
  }
  return ilmSnapshotCache.get(clusterName);
}

async function loadIlmSnapshot(clusterName, client) {
  const entry = getCacheEntry(clusterName);
  const now = Date.now();
  if (entry.value && now - entry.at < ILM_CACHE_TTL_MS) {
    return entry.value;
  }
  if (entry.inFlight) {
    return entry.inFlight;
  }

  entry.inFlight = (async () => {
    const [policiesRes, explainedRes] = await Promise.all([
      client.ilm.getLifecycle(),
      client.ilm.explainLifecycle({
        index: "*",
        only_managed: true,
        filter_path:
          "indices.*.policy,indices.*.managed,indices.*.phase,indices.*.action,indices.*.step,indices.*.step_info.failed_step,indices.*.error",
      }),
    ]);

    const policiesMap = normalizePoliciesResponse(policiesRes);
    const explained = explainedRes?.body ?? explainedRes;
    const indices = explained?.indices || {};

    const value = { policiesMap, indices };
    entry.value = value;
    entry.at = Date.now();
    entry.inFlight = null;
    return value;
  })();

  try {
    return await entry.inFlight;
  } catch (e) {
    entry.inFlight = null;
    throw e;
  }
}

router.post("/:clusterName/dry-run", async (req, res) => {
  const { clusterName } = req.params;
  const cluster = req.config.clusters.find((c) => c.name === clusterName);

  if (!cluster) {
    return res.status(404).json({ error: `Unknown cluster: ${clusterName}` });
  }

  const { policyName, proposedPolicyText, proposedPolicy, includeMetaDiff } = req.body || {};
  if (!policyName || typeof policyName !== "string") {
    return res.status(400).json({ error: "policyName is required" });
  }

  let proposed = proposedPolicy;
  if (proposed == null && proposedPolicyText != null) {
    const parsed = safeJsonParse(proposedPolicyText);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    proposed = parsed.value;
  }

  if (proposed == null || typeof proposed !== "object") {
    return res.status(400).json({ error: "proposedPolicy is required" });
  }

  const normalizedProposed = proposed.policy ? proposed.policy : proposed;
  const validationErrors = [];
  if (!normalizedProposed.phases || typeof normalizedProposed.phases !== "object") {
    validationErrors.push('Missing required object: "phases"');
  }

  try {
    const client = getClient(cluster);
    const { policiesMap, indices } = await loadIlmSnapshot(clusterName, client);
    const currentWrapper = policiesMap[policyName];
    const currentPolicy = currentWrapper?.policy ?? null;

    if (!currentWrapper) {
      return res.status(404).json({ error: `Unknown ILM policy: ${policyName}` });
    }

    const affectedIndices = Object.entries(indices)
      .filter(([, detail]) => detail?.policy === policyName)
      .map(([index, detail]) => ({
        index,
        managed: detail.managed,
        phase: detail.phase,
        action: detail.action,
        step: detail.step,
        failedStep: detail.step_info?.failed_step ?? null,
        error: detail.error ?? null,
      }))
      .sort((a, b) => a.index.localeCompare(b.index));

    const diff = deepDiff(currentPolicy, normalizedProposed, "", [], 200, {
      includeMetaDiff,
    });

    res.json({
      cluster: clusterName,
      policyName,
      current: currentWrapper,
      proposed: { policy: normalizedProposed },
      validationErrors,
      diff,
      affectedIndices,
      notes: [
        "Dry-run mode: no writes are performed to Elasticsearch.",
        "Diff is a structural comparison; it does not simulate ILM execution.",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:clusterName", async (req, res) => {
  const { clusterName } = req.params;
  const cluster = req.config.clusters.find((c) => c.name === clusterName);

  if (!cluster) {
    return res.status(404).json({ error: `Unknown cluster: ${clusterName}` });
  }

  try {
    const client = getClient(cluster);
    const { policiesMap, indices } = await loadIlmSnapshot(clusterName, client);
    const indexList = Object.entries(indices).map(([index, detail]) => ({
      index,
      managed: detail.managed,
      phase: detail.phase,
      action: detail.action,
      step: detail.step,
      failedStep: detail.step_info?.failed_step ?? null,
      error: detail.error ?? null,
      policy: detail.policy ?? null,
    }));

    res.json({
      cluster: clusterName,
      policies: policiesMap,
      indices: indexList,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
