/**
 * routes/topiarios.js
 * Módulo independiente — Registro de Topiarios CDMX.
 * Montado en /api/topiarios — aislado del core SICOPS.
 *
 * GET    /api/topiarios                   → lista todos los registros
 * POST   /api/topiarios/save              → guardar nuevo registro
 * PUT    /api/topiarios/:id/promover      → PROPUESTA → INSTALACION
 * DELETE /api/topiarios/:id              → eliminar registro (ADMIN)
 * GET    /api/topiarios/export/csv        → descarga CSV
 * GET    /api/topiarios/export/excel      → descarga Excel
 * GET    /api/topiarios/export/geojson    → descarga GeoJSON (QGIS/Leaflet)
 */

const express = require("express");
const router  = express.Router();

const ctrl                          = require("../controllers/topiariosController");
const { authRequired, requireRole } = require("../middleware/auth");

/* Rutas fijas ANTES que parámetros */
router.get   ("/export/csv",        authRequired, ctrl.exportarCsv);
router.get   ("/export/excel",      authRequired, ctrl.exportarExcel);
router.get   ("/export/geojson",    authRequired, ctrl.exportarGeoJSON);
router.get   ("/",                  authRequired, ctrl.listar);
router.post  ("/save",              authRequired, ctrl.guardar);

/* Rutas con parámetro */
router.put   ("/:id/promover",      authRequired, ctrl.promover);
router.delete("/:id",               authRequired, requireRole("ADMIN", "SECRETARIO"), ctrl.eliminar);

module.exports = router;
