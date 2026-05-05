/**
 * routes/auditoria.js
 *
 * GET /api/auditoria/export?programa=XXX  → Excel con todos los campos (solo ADMIN / DG)
 */
const express = require("express");
const router  = express.Router();

const { exportarExcel }              = require("../controllers/auditoriaCtrl");
const { authRequired, requireRole }  = require("../middleware/auth");

router.get("/export", authRequired, requireRole("ADMIN", "DG"), exportarExcel);

module.exports = router;
