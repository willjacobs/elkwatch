const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();

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
