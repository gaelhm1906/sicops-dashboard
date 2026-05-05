/**
 * routes/obrasUpdate.js
 * Rutas PostgreSQL para actualización de avance en tiempo real.
 * Se monta en /api/obras ANTES que routes/obras.js (prioridad).
 *
 * PUT  /api/obras/update               → actualizarObra
 * GET  /api/obras?tabla=xxx            → listarObrasTabla  (sin ?tabla pasa al siguiente handler)
 * POST /api/obras/:id/editar           → iniciarEdicionPg
 * POST /api/obras/:id/confirmar/step1  → confirmarStep1Pg
 * POST /api/obras/:id/confirmar/step2  → confirmarStep2Pg
 */

const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/obrasUpdateCtrl");
const { authRequired } = require("../middleware/auth");

/* PUT /update — sistema externo, va ANTES de /:id para evitar captura */
router.put("/update", authRequired, ctrl.actualizarObra);
router.put("/inaugurar", authRequired, ctrl.inaugurarObra);
router.put("/cancelar", authRequired, ctrl.cancelarObra);

/* GET / — si lleva ?tabla consulta PG; si no, next() cede al handler JSON */
router.get("/", authRequired, ctrl.listarObrasTabla);

/* Flujo de 3 pasos */
router.post("/:id/editar",            authRequired, ctrl.iniciarEdicionPg);
router.post("/:id/confirmar/step1",   authRequired, ctrl.confirmarStep1Pg);
router.post("/:id/confirmar/step2",   authRequired, ctrl.confirmarStep2Pg);

module.exports = router;
