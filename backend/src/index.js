const express = require("express");
const cors = require("cors");
const { loadConfig } = require("./config/loader");
const { startAlertScheduler } = require("./services/alertScheduler");

const clustersRouter = require("./routes/clusters");
const indicesRouter = require("./routes/indices");
const ilmRouter = require("./routes/ilm");
const alertsRouter = require("./routes/alerts");
const nodesRouter = require("./routes/nodes");
const templatesRouter = require("./routes/templates");
const { getMetricsHandler } = require("./metrics");

const PORT = process.env.PORT || 3001;

let config;
try {
  config = loadConfig();
} catch (e) {
  console.error("Failed to load config:", e.message);
  process.exit(1);
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use((req, res, next) => {
  req.config = config;
  next();
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/metrics", getMetricsHandler(() => config));

app.use("/api/clusters", clustersRouter);
app.use("/api/indices", indicesRouter);
app.use("/api/ilm", ilmRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/nodes", nodesRouter);
app.use("/api/templates", templatesRouter);

app.listen(PORT, () => {
  console.log(`Elkwatch backend listening on :${PORT}`);
  startAlertScheduler(config);
});
