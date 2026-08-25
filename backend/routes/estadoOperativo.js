const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/estadoOperativoCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/",              authRequired, requireRole("ADMIN"), ctrl.getEstadoOperativo);
router.get("/programas-modo", authRequired, requireRole("ADMIN"), ctrl.getProgramasModo);
router.patch("/programa-modo", authRequired, requireRole("ADMIN"), ctrl.setProgramaModo);

module.exports = router;
