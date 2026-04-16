const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/pgController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/dashboard
 * Estadísticas globales calculadas desde PostgreSQL.
 */
router.get("/", authRequired, ctrl.dashboard);

/**
 * GET /api/dashboard/obras
 * Devuelve TODAS las obras unificadas de todas las tablas del schema sig_sobse.
 * Consulta "DIRECCION GENERAL", "NOMBRE_OBRA", "AVANCE REAL" de cada tabla.
 * Ignora automáticamente tablas que no tengan esas columnas.
 * 
 * Respuesta:
 * {
 *   success: boolean,
 *   total: number,
 *   data: [
 *     {
 *       dg: string,
 *       nombre: string,
 *       avance: number,
 *       estatus: "SIN INICIAR" | "EN PROCESO" | "ENTREGADA"
 *     }
 *   ]
 * }
 */
router.get("/obras", authRequired, ctrl.dashboardObras);

module.exports = router;
