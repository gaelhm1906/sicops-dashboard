const express = require("express");
const router  = express.Router();

const obrasCtrl        = require("../controllers/obrasCtrl");
const csvObrasCtrl     = require("../controllers/csvObrasCtrl");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/geojson/obras?dg=DGCOP
 * GeoJSON desde sig_sobse.obras_centralizadas, filtrado por DG opcional.
 * Propiedades: id_obra, nombre, direccion_general, programa, alcaldia,
 *              avance_real, estatus, ultima_actualizacion, color
 *
 * TEMPORAL (dev local): sin Postgres disponible, se sirve desde los CSV
 * en /data (csvObrasCtrl). Revertir a obrasCtrl.geoJsonByDg cuando haya
 * una BD real conectada.
 */
router.get("/obras", authRequired, csvObrasCtrl.geoJsonFromCsv);

module.exports = router;
