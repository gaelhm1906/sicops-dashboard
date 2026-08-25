const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/inteligenciaCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/", authRequired, requireRole("ADMIN"), ctrl.getInteligenciaOperativa);

module.exports = router;
