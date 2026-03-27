const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();

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

function deepDiff(before, after, path = "", out = [], limit = 200) {
  if (out.length >= limit) return out;

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
      deepDiff(bArr[i], aArr[i], `${path}[${i}]`, out, limit);
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
    const nextPath = path ? `${path}.${k}` : k;
    if (!aKeys.has(k)) {
      out.push({ path: nextPath, before: before[k], after: undefined });
      continue;
    }
    if (!bKeys.has(k)) {
      out.push({ path: nextPath, before: undefined, after: after[k] });
      continue;
    }
    deepDiff(before[k], after[k], nextPath, out, limit);
  }
  return out;
}

router.post("/:clusterName/dry-run", async (req, res) => {
  const { clusterName } = req.params;
  const cluster = req.config.clusters.find((c) => c.name === clusterName);

  if (!cluster) {
    return res.status(404).json({ error: `Unknown cluster: ${clusterName}` });
  }

  const { policyName, proposedPolicyText, proposedPolicy } = req.body || {};
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
    const [policiesRes, explainedRes] = await Promise.all([
      client.ilm.getLifecycle(),
      client.ilm.explainLifecycle({ index: "*" }),
    ]);

    const policiesMap = normalizePoliciesResponse(policiesRes);
    const currentWrapper = policiesMap[policyName];
    const currentPolicy = currentWrapper?.policy ?? null;

    if (!currentWrapper) {
      return res.status(404).json({ error: `Unknown ILM policy: ${policyName}` });
    }

    const explained = explainedRes?.body ?? explainedRes;
    const indices = explained?.indices || {};
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

    const diff = deepDiff(currentPolicy, normalizedProposed);

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
    const [policies, explained] = await Promise.all([
      client.ilm.getLifecycle(),
      client.ilm.explainLifecycle({ index: "*" }),
    ]);

    const indices = explained.body?.indices || explained.indices || {};
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
      policies: policies || {},
      indices: indexList,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
