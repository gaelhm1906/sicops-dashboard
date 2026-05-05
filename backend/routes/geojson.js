const express = require("express");
const router  = express.Router();

const obrasCtrl        = require("../controllers/obrasCtrl");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/geojson/obras?dg=DGCOP
 * GeoJSON desde sig_sobse.obras_centralizadas, filtrado por DG opcional.
 * Propiedades: id_obra, nombre, direccion_general, programa, alcaldia,
 *              avance_real, estatus, ultima_actualizacion, color
 */
router.get("/obras", authRequired, obrasCtrl.geoJsonByDg);

module.exports = router;
