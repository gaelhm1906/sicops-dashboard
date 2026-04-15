const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/pgController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/dashboard
 * Estadísticas globales calculadas desde PostgreSQL.
 */
router.get("/", authRequired, ctrl.dashboard);

module.exports = router;
