/**
 * routes/kpis.js
 * GET /api/kpis/summary
 */

const express = require("express");
const router  = express.Router();

const { kpisSummary }  = require("../controllers/kpisCtrl");
const { authRequired } = require("../middleware/auth");

router.get("/summary", authRequired, kpisSummary);

module.exports = router;
