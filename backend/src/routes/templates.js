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
    const r = await client.indices.getIndexTemplate({ name: "*" });

    const indexTemplates = (r.index_templates || []).map(
      ({ name, index_template: it }) => ({
        name,
        indexPatterns: it.index_patterns || [],
        priority: it.priority ?? 0,
        version: it.version ?? null,
        composedOf: (it.composed_of || []).map((c) =>
          typeof c === "string" ? c : c?.name ?? String(c)
        ),
        dataStream: it.data_stream ?? null,
      })
    );

    indexTemplates.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ cluster: clusterName, templates: indexTemplates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
