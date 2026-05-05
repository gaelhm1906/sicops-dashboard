/**
 * routes/obrasNew.js
 * Rutas dedicadas a sig_sobse.obras_centralizadas.
 * Se monta en /api (ver server.js), por lo que los endpoints resultantes son:
 *   GET  /api/obras?dg=DGCOP
 *   GET  /api/obra/:id_obra
 *   PUT  /api/avance
 *   GET  /api/historial/:id_obra
 */

const router             = require("express").Router();
const ctrl               = require("../controllers/obrasCtrl");
const { authRequired }   = require("../middleware/auth");

router.get("/obras",              authRequired, ctrl.getObras);
router.get("/obra/:id_obra",      authRequired, ctrl.getObra);
router.put("/avance",             authRequired, ctrl.updateAvance);
router.get("/historial/:id_obra", authRequired, ctrl.getHistorial);
router.get("/export/semana",      authRequired, ctrl.exportSemana);

module.exports = router;
