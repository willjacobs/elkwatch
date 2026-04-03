const express = require("express");
const { listAlerts, DEFAULT_LIST_LIMIT } = require("../services/alertStore");

const router = express.Router();

router.get("/", (req, res) => {
  const raw = req.query.limit;
  const limit =
    raw !== undefined ? parseInt(String(raw), 10) : DEFAULT_LIST_LIMIT;
  res.json({ alerts: listAlerts(limit) });
});

module.exports = router;
