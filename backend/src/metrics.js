const client = require("prom-client");

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const configuredClusters = new client.Gauge({
  name: "elkwatch_configured_clusters_total",
  help: "Number of Elasticsearch clusters defined in config",
  registers: [register],
});

function getMetricsHandler(getConfig) {
  return async (req, res) => {
    try {
      const n = getConfig()?.clusters?.length ?? 0;
      configuredClusters.set(n);
      res.set("Content-Type", register.contentType);
      res.send(await register.metrics());
    } catch (e) {
      res.status(500).end(e.message);
    }
  };
}

module.exports = { getMetricsHandler, register };
