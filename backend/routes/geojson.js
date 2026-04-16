const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/pgController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/geojson/obras
 * GeoJSON dinámico generado desde PostgreSQL/PostGIS.
 * Recorre todas las tablas del schema sig_sobse que tengan columna geom.
 * Query: ?tabla=nombre_tabla&limite=2000
 *
 * Respuesta: GeoJSON FeatureCollection con propiedades:
 *   id, nombre, avance_real, estatus, direccion_general, programa, tabla
 */
router.get("/obras", authRequired, ctrl.geoJsonObras);

module.exports = router;
