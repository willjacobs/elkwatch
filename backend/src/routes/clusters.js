const express = require("express");
const { getClient } = require("../services/esClient");

const router = express.Router();

const CACHE_TTL_MS = 15_000;
let cache = { at: 0, value: null, inFlight: null };

function clusterErrorPresentation(cluster, err) {
  const code = err.code || err.cause?.code;
  const msg = err.message || String(err);
  const isDnsFailure =
    code === "ENOTFOUND" ||
    /ENOTFOUND/i.test(msg) ||
    /getaddrinfo ENOTFOUND/i.test(msg);
  if (isDnsFailure) {
    return {
      message: `No "${cluster.name}" environment present — the configured host could not be resolved. Remove this cluster from config.yml if you are not using it.`,
      tone: "muted",
    };
  }
  return { message: msg, tone: "error" };
}

router.get("/", async (req, res) => {
  const { clusters } = req.config;
  const now = Date.now();
  if (cache.value && now - cache.at < CACHE_TTL_MS) {
    return res.json(cache.value);
  }

  if (cache.inFlight) {
    try {
      const value = await cache.inFlight;
      return res.json(value);
    } catch {
      // fall through; we'll attempt a fresh fetch below
    }
  }

  cache.inFlight = (async () => {
    const settled = await Promise.allSettled(
      clusters.map(async (cluster) => {
        const client = getClient(cluster);
        const [health, stats] = await Promise.all([
          client.cluster.health(),
          client.cluster.stats({ filter_path: "nodes.count,nodes.fs" }),
        ]);

        const fs = stats.nodes?.fs;
        let diskUsedPercent;
        if (fs?.total_in_bytes && fs.total_in_bytes > 0) {
          const used = fs.total_in_bytes - (fs.free_in_bytes || 0);
          diskUsedPercent = Math.round((used / fs.total_in_bytes) * 100);
        }

        return {
          name: cluster.name,
          status: health.status,
          numberOfNodes: health.number_of_nodes,
          activePrimaryShards: health.active_primary_shards,
          relocatingShards: health.relocating_shards,
          unassignedShards: health.unassigned_shards,
          diskUsedPercent,
          error: null,
        };
      })
    );

    const out = settled.map((r, i) => {
      const cluster = clusters[i];
      if (r.status === "fulfilled") return r.value;
      const { message, tone } = clusterErrorPresentation(cluster, r.reason);
      return {
        name: cluster.name,
        status: "unknown",
        error: message,
        errorTone: tone,
      };
    });

    cache = { at: Date.now(), value: out, inFlight: null };
    return out;
  })();

  try {
    const value = await cache.inFlight;
    return res.json(value);
  } catch (e) {
    cache.inFlight = null;
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
