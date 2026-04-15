const express = require("express");
const router  = express.Router();

const ctrl                         = require("../controllers/controlController");
const { authRequired, requireRole } = require("../middleware/auth");

/**
 * GET /api/control/estado
 * Estado actual del sistema (público dentro de la API).
 */
router.get("/estado", authRequired, ctrl.estado);

/**
 * POST /api/control/abrir
 * Abre el sistema manualmente (solo rol DG).
 */
router.post("/abrir", authRequired, requireRole("DG", "ADMIN"), ctrl.abrir);

/**
 * POST /api/control/cerrar
 * Cierra el sistema manualmente (solo rol DG o ADMIN).
 */
router.post("/cerrar", authRequired, requireRole("DG", "ADMIN"), ctrl.cerrar);

/**
 * GET /api/control/auditoria
 * Lista el registro de auditoría de cambios.
 * Query: ?obra_id=1&usuario=juan@obra.com&pagina=1&limite=20
 */
router.get("/auditoria", authRequired, requireRole("DG"), ctrl.auditoria);

module.exports = router;
