const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();

function fsTotals(nodeFs) {
  if (!nodeFs?.total) return { total: null, free: null, available: null };
  const t = nodeFs.total;
  return {
    total: t.total_in_bytes ?? null,
    free: t.free_in_bytes ?? null,
    available: t.available_in_bytes ?? null,
  };
}

function aggregateDiskAndHeap(nodes) {
  let sumTotal = 0;
  let sumFree = 0;
  let sumHeapUsed = 0;
  let sumHeapMax = 0;
  for (const n of nodes) {
    if (n.diskTotalBytes != null && n.diskTotalBytes > 0) {
      sumTotal += n.diskTotalBytes;
      sumFree += n.diskFreeBytes ?? 0;
    }
    if (n.jvmHeapMaxBytes != null && n.jvmHeapMaxBytes > 0) {
      sumHeapMax += n.jvmHeapMaxBytes;
      sumHeapUsed += n.jvmHeapUsedBytes ?? 0;
    }
  }
  let diskUsedPercent;
  if (sumTotal > 0) {
    const used = sumTotal - sumFree;
    diskUsedPercent = Math.round((used / sumTotal) * 100);
  }
  let heapUsedPercent;
  if (sumHeapMax > 0) {
    heapUsedPercent = Math.round((sumHeapUsed / sumHeapMax) * 100);
  }
  return {
    diskUsedPercent,
    diskUsedBytes: sumTotal > 0 ? sumTotal - sumFree : null,
    diskTotalBytes: sumTotal > 0 ? sumTotal : null,
    diskFreeBytes: sumFree > 0 ? sumFree : null,
    heapUsedPercent,
    heapUsedBytes: sumHeapMax > 0 ? sumHeapUsed : null,
    heapMaxBytes: sumHeapMax > 0 ? sumHeapMax : null,
  };
}

router.get("/:clusterName", async (req, res) => {
  const { clusterName } = req.params;
  const cluster = req.config.clusters.find((c) => c.name === clusterName);

  if (!cluster) {
    return res.status(404).json({ error: `Unknown cluster: ${clusterName}` });
  }

  try {
    const client = getClient(cluster);
    const [health, stats] = await Promise.all([
      client.cluster.health(),
      client.nodes.stats({
        metric: ["fs", "jvm", "os", "http"],
      }),
    ]);

    const nodesObj = stats.nodes || {};
    const nodes = Object.entries(nodesObj).map(([nodeId, n]) => {
      const { total, free, available } = fsTotals(n.fs);
      let diskUsedPercent;
      if (total != null && total > 0 && free != null) {
        const used = total - free;
        diskUsedPercent = Math.round((used / total) * 100);
      }

      let heapUsedPercent;
      const hMax = n.jvm?.mem?.heap_max_in_bytes;
      const hUsed = n.jvm?.mem?.heap_used_in_bytes;
      if (hMax != null && hMax > 0 && hUsed != null) {
        heapUsedPercent = Math.round((hUsed / hMax) * 100);
      }

      const ip =
        typeof n.ip === "string"
          ? n.ip
          : Array.isArray(n.ip)
            ? n.ip[0]
            : null;

      return {
        nodeId,
        name: n.name,
        host: n.host,
        ip,
        roles: n.roles || [],
        httpPublishAddress: n.http?.publish_address ?? null,
        diskTotalBytes: total,
        diskFreeBytes: free,
        diskAvailableBytes: available,
        diskUsedPercent,
        heapUsedPercent,
        os: n.os
          ? {
              prettyName: n.os.pretty_name,
              allocatedProcessors: n.os.allocated_processors,
            }
          : null,
        jvmHeapUsedBytes: n.jvm?.mem?.heap_used_in_bytes ?? null,
        jvmHeapMaxBytes: n.jvm?.mem?.heap_max_in_bytes ?? null,
      };
    });

    nodes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const agg = aggregateDiskAndHeap(nodes);

    res.json({
      cluster: clusterName,
      summary: {
        status: health.status,
        numberOfNodes: health.number_of_nodes,
        activeShards: health.active_shards,
        unassignedShards: health.unassigned_shards,
        relocatingShards: health.relocating_shards,
        ...agg,
      },
      nodes,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
