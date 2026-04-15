const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/reportesController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/reportes/periodos
 * Lista todos los períodos históricos disponibles.
 */
router.get("/periodos", authRequired, ctrl.periodos);

/**
 * GET /api/reportes/corte?periodo=2025-01-W01
 * Reporte completo de un corte.
 */
router.get("/corte", authRequired, ctrl.corte);

/**
 * GET /api/reportes/descargar?formato=csv&periodo=2025-01-W01
 * Descarga el reporte en CSV o JSON.
 */
router.get("/descargar", authRequired, ctrl.descargar);

module.exports = router;
