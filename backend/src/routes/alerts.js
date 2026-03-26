const express = require("express");
const { getAlerts } = require("../services/alertScheduler");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ alerts: getAlerts() });
});

module.exports = router;
