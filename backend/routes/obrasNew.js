/**
 * routes/obrasNew.js
 * Rutas dedicadas a sig_sobse.obras_centralizadas.
 * Se monta en /api (ver server.js), por lo que los endpoints resultantes son:
 *   GET  /api/obras?dg=DGCOP     — público (solo lectura)
 *   GET  /api/obra/:id_obra      — público (solo lectura)
 *   PUT  /api/avance             — protegido (escritura)
 *   GET  /api/historial/:id_obra — protegido
 *   GET  /api/export/semana      — protegido
 */

const router             = require("express").Router();
const ctrl               = require("../controllers/obrasCtrl");
const { authRequired }   = require("../middleware/auth");

// Lectura pública: el frontend usa autenticación local y no tiene JWT real
router.get("/obras",              ctrl.getObras);
router.get("/obra/:id_obra",      ctrl.getObra);

// Escritura protegida: requiere token válido en el header Authorization
router.put("/avance",             authRequired, ctrl.updateAvance);
router.get("/historial/:id_obra", authRequired, ctrl.getHistorial);
router.get("/export/semana",      authRequired, ctrl.exportSemana);

module.exports = router;
