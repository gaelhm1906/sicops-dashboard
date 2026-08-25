const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/coberturaCtrl");
const rptCtrl = require("../controllers/reporteCoberturaCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/alcances",      authRequired, requireRole("ADMIN"), ctrl.getCobertura);
router.get("/alcances-mapa", authRequired, requireRole("ADMIN"), ctrl.getAlcancesMapa);
router.get("/reporte",       authRequired, requireRole("ADMIN"), rptCtrl.getReporte);
router.get("/excel",         authRequired, requireRole("ADMIN"), rptCtrl.exportarExcel);

module.exports = router;
