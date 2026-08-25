const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/evolucionCtrl");
const { authRequired } = require("../middleware/auth");

router.get("/obra", authRequired, ctrl.getEvolucionObra);
// Sin authRequired: igual que /api/frentes y /api/alcances, esta ruta la
// consume Centro de Mando (app pública, sin login). Solo expone conteos
// agregados por programa/DG, no detalle de auditoría ni datos de usuario.
router.get("/resumen", ctrl.getResumenAlertas);
// Sin authRequired: solo avance de semana actual/anterior, sin auditoría
// ni datos de usuario — para la Ficha Técnica de Centro de Mando.
router.get("/obra-resumen", ctrl.getResumenObraSemanal);
// Sin authRequired: mismo patrón público que /resumen y /obra-resumen.
// Focos rojos por FRENTE (programa CONSTRUCCION DE UTOPIAS) — capa
// independiente, no afecta /resumen ni /obra-resumen.
router.get("/frentes-resumen", ctrl.getResumenFrentesObra);

module.exports = router;
