const express = require("express");

const router = express.Router();
const ctrl = require("../controllers/semanaController");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/actual", authRequired, ctrl.actual);
router.post("/iniciar", authRequired, requireRole("ADMIN"), ctrl.iniciar);

module.exports = router;
