const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/importacionCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

const GEO = requireRole("GEOESTADISTICA", "ADMIN");

router.post("/preview",     authRequired, GEO, ctrl.preview);
router.post("/ejecutar",    authRequired, GEO, ctrl.ejecutar);
router.get("/plantilla",    authRequired, GEO, ctrl.descargarPlantilla);

module.exports = router;
