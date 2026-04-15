const express = require("express");
const router  = express.Router();

const ctrl = require("../controllers/controlController");
const { authRequired, requireRole } = require("../middleware/auth");

router.get("/estado", authRequired, ctrl.estado);
router.post("/toggle", authRequired, requireRole("DG", "ADMIN"), ctrl.toggle);

module.exports = router;
