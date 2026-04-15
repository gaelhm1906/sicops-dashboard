const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/pgController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/geo
 * GeoJSON FeatureCollection con geometrías de las tablas del schema.
 * Query: ?tabla=nombre_tabla&limite=500
 */
router.get("/", authRequired, ctrl.geo);

module.exports = router;
