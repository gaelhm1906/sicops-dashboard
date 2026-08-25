/**
 * routes/alcances.js
 * Catálogo dinámico de alcances + historial operativo.
 * Montado en /api/alcances
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/alcancesCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

/* ── Rutas fijas (deben ir ANTES de los parámetros /:x) ── */
router.get ("/programas",      authRequired, ctrl.getProgramas);
router.get ("/conceptos",      authRequired, ctrl.getConceptos);
router.get ("/detalle",        authRequired, ctrl.getDetalle);
router.get ("/historial",      authRequired, ctrl.getHistorial);
router.post("/guardar",        authRequired, ctrl.guardar);

/* Configuración de edición */
router.get ("/config",         authRequired, ctrl.getConfigEdicion);
router.post("/config",         authRequired, requireRole("ADMIN"), ctrl.updateConfigEdicion);

/* Edición / eliminación de registros */
router.put   ("/editar/:id",   authRequired, ctrl.editarAlcance);
router.delete("/eliminar/:id", authRequired, ctrl.eliminarAlcance);

/* Catálogo auxiliar */
router.get ("/unidades",       authRequired, ctrl.getUnidades);
router.get ("/sugerencias",    authRequired, ctrl.getSugerencias);

/* Clasificación PROYECTADO/EJECUTADO a nivel de obra */
router.get  ("/tipo/:clave",         authRequired, ctrl.getTipoObra);
router.put  ("/tipo/:clave",         authRequired, ctrl.updateTipoObra);

/* Clasificación individual por registro */
router.patch("/tipo-individual/:id", authRequired, ctrl.updateTipoIndividual);

/* ── Compatibilidad Centro de Mando — GET /:clave ──
   Debe ir AL FINAL para no capturar las rutas nombradas arriba. */
const pool      = require("../db");
const SCHEMA_CM = process.env.DB_SCHEMA || "sig_sobse";

router.get("/:clave", async (req, res) => {
  const claveUnica = String(req.params.clave ?? "").trim();
  if (!claveUnica) return res.json({ success: true, rows: [] });
  try {
    const result = await pool.query(
      `SELECT id, clave_unica, nombre_obra, programa, dg, accion, concepto,
              cantidad, unidad, usuario_actualizacion, fecha_captura,
              usuario_edicion, fecha_edicion
         FROM "${SCHEMA_CM}".alcances_obras
        WHERE BTRIM(COALESCE(clave_unica::text, '')) = BTRIM($1)
        ORDER BY fecha_captura DESC`,
      [claveUnica]
    );
    res.json({ success: true, rows: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
