const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/infoGeneralCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

/* Catálogo de indicadores por programa */
router.get("/catalogo",    authRequired, ctrl.getCatalogo);

/* Valores capturados para una obra */
router.get("/obra",        authRequired, ctrl.getObra);

/* Conteo batch — 1 query para N obras (reemplaza N llamadas individuales) */
router.post("/conteos",       authRequired, ctrl.getConteos);

/* Guardar ficha completa (transaccional) */
router.post("/guardar-ficha", authRequired, ctrl.guardarFicha);

/* Limpiar un valor (solo ADMIN) */
router.put("/limpiar/:id", authRequired, requireRole("ADMIN"), ctrl.limpiarValor);

module.exports = router;
