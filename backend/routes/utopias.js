/**
 * routes/utopias.js
 * Subsistema especializado UTOPÍAS — SICOPS.
 * Montado en /api/utopias — completamente independiente de /api/obras.
 *
 * GET  /api/utopias                    → lista utopías agrupadas por obra
 * GET  /api/utopias/resumen            → KPIs globales del subsistema
 * GET  /api/utopias/frentes            → tabla plana con filtros (empresa/frente/jud/avance)
 * GET  /api/utopias/:clave             → detalle: resumen + frentes de una utopía
 * PUT  /api/utopias/frentes/update     → actualizar un frente (avance_real, semanal, etc.)
 */

const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/utopiasController");
const { authRequired, requireRole, importKeyOrAuth } = require("../middleware/auth");

/* ── Roles que pueden usar el subsistema ── */
const ROLES_UTOPIAS = ["ADMIN", "SECRETARIO", "UTOPIAS", "ENLACE_UTOPIAS", "DG", "ACTUALIZACION"];

/* Orden de declaración importa: rutas fijas ANTES que parámetros */

/* POST /api/utopias/importar — ingesta desde sistema PHP de UTOPÍAS (Excel→PG) */
router.post("/importar", importKeyOrAuth, ctrl.importarDesdeExcel);

/* GET /api/utopias/resumen */
router.get("/resumen", authRequired, ctrl.resumenGlobal);

/* GET /api/utopias/frentes */
router.get("/frentes", authRequired, ctrl.listarFrente);

/* PUT /api/utopias/frentes/update — debe ir ANTES de /:clave */
router.put(
  "/frentes/update",
  authRequired,
  requireRole(...ROLES_UTOPIAS),
  ctrl.actualizarFrente
);

/* GET /api/utopias — lista agrupada */
router.get("/", authRequired, ctrl.listarUtopias);

/* GET /api/utopias/:clave — detalle de una utopía */
router.get("/:clave", authRequired, ctrl.detalleUtopia);

module.exports = router;
