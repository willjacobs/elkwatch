const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();

router.get("/:clusterName", async (req, res) => {
  const { clusterName } = req.params;
  const filter = req.query.filter || "*";
  const cluster = req.config.clusters.find((c) => c.name === clusterName);

  if (!cluster) {
    return res.status(404).json({ error: `Unknown cluster: ${clusterName}` });
  }

  try {
    const client = getClient(cluster);
    const rows = await client.cat.indices({
      format: "json",
      index: filter,
      h: "index,health,status,docs.count,store.size,creation.date.string",
      s: "index",
    });

    const list = Array.isArray(rows) ? rows : [];
    res.json({
      cluster: clusterName,
      filter,
      indices: list.map((row) => ({
        index: row.index,
        health: row.health,
        status: row.status,
        docsCount: row["docs.count"],
        storeSize: row["store.size"],
        creationDate: row["creation.date.string"],
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
