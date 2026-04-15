const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/obrasController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/obras
 * Lista obras con filtros y paginación.
 * Query: ?programa=X&estado=Y&pagina=1&limite=10&orden=nombre&dir=asc
 */
router.get("/", authRequired, ctrl.listar);

/**
 * GET /api/obras/historico
 * Devuelve snapshot histórico de un período.
 * Query: ?periodo=2025-01-W01
 * IMPORTANTE: esta ruta debe ir ANTES de /:id para no ser capturada por el parámetro
 */
router.get("/historico", authRequired, ctrl.historico);

/**
 * GET /api/obras/:id
 * Obtiene una obra por su ID.
 */
router.get("/:id", authRequired, ctrl.obtener);

router.put("/:id/avance", authRequired, ctrl.actualizarAvance);

/**
 * POST /api/obras/:id/editar
 * Inicia el flujo de edición (paso 0 → genera cambio_id).
 * Body: { porcentaje_nuevo, motivo }
 */
router.post("/:id/editar", authRequired, ctrl.iniciarEdicion);

/**
 * POST /api/obras/:id/confirmar/step1
 * Paso 1 de confirmación — valida cambio_id y solicita código verbal.
 * Body: { cambio_id }
 */
router.post("/:id/confirmar/step1", authRequired, ctrl.confirmarStep1);

/**
 * POST /api/obras/:id/confirmar/step2
 * Paso 2 — aplica el cambio con código verbal "CONFIRMO".
 * Body: { cambio_id, codigo_verbal }
 */
router.post("/:id/confirmar/step2", authRequired, ctrl.confirmarStep2);

module.exports = router;
