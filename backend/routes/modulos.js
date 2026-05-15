/**
 * routes/modulos.js
 * Control operativo de módulos del sistema SICOPS.
 * Permite a ADMIN bloquear / desbloquear módulos específicos en tiempo real.
 *
 * GET  /api/modulos/estado           → estado de todos los módulos (auth required)
 * POST /api/modulos/:modulo/toggle   → habilitar/deshabilitar módulo (ADMIN only)
 * PUT  /api/modulos/:modulo          → actualizar config completa (ADMIN only)
 *
 * La tabla sig_sobse.modulos_control se crea automáticamente si no existe,
 * con los valores por defecto de MODULOS_DEFAULT.
 */

const express = require("express");
const router  = express.Router();

const { query, SCHEMA }                  = require("../config/pg");
const { authRequired, requireRole }      = require("../middleware/auth");
const logger                             = require("../middleware/logger");

/* ── Módulos con sus valores por defecto ── */
const MODULOS_DEFAULT = {
  ALCANCES: {
    etiqueta:         "Módulo de Alcances",
    habilitado:       false,
    roles_permitidos: ["ADMIN", "SECRETARIO"],
    mensaje_bloqueo:  "La Administración SOBSE restringió temporalmente el acceso al módulo de Alcances mientras concluyen las validaciones operativas internas.",
  },
  UTOPIAS: {
    etiqueta:         "Subsistema Utopías",
    habilitado:       true,
    roles_permitidos: ["ADMIN", "SECRETARIO", "UTOPIAS", "ENLACE_UTOPIAS"],
    mensaje_bloqueo:  "El subsistema Utopías se encuentra en validación operativa. Contacte al administrador.",
  },
};

/* ── Inicialización de la tabla ── */
async function ensureModulosTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.modulos_control (
      id               SERIAL PRIMARY KEY,
      modulo           VARCHAR(50)   UNIQUE NOT NULL,
      etiqueta         VARCHAR(120),
      habilitado       BOOLEAN       DEFAULT true,
      roles_permitidos TEXT[]        DEFAULT '{}',
      mensaje_bloqueo  TEXT,
      actualizado_por  VARCHAR(100),
      updated_at       TIMESTAMPTZ   DEFAULT NOW()
    )
  `);

  /* Insertar módulos faltantes con valores por defecto */
  for (const [clave, cfg] of Object.entries(MODULOS_DEFAULT)) {
    await query(
      `
      INSERT INTO ${SCHEMA}.modulos_control
        (modulo, etiqueta, habilitado, roles_permitidos, mensaje_bloqueo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (modulo) DO NOTHING
      `,
      [clave, cfg.etiqueta, cfg.habilitado, cfg.roles_permitidos, cfg.mensaje_bloqueo]
    );
  }
}

/* ── GET /api/modulos/estado ── */
router.get("/estado", authRequired, async (req, res) => {
  try {
    await ensureModulosTable();
    const result = await query(
      `SELECT modulo, etiqueta, habilitado, roles_permitidos, mensaje_bloqueo, actualizado_por, updated_at
       FROM ${SCHEMA}.modulos_control
       ORDER BY modulo`
    );

    /* Construir mapa modulo → config */
    const modulos = {};
    for (const row of result.rows) {
      modulos[row.modulo] = {
        etiqueta:         row.etiqueta,
        habilitado:       row.habilitado,
        rolesPermitidos:  row.roles_permitidos || [],
        mensajeBloqueo:   row.mensaje_bloqueo,
        actualizadoPor:   row.actualizado_por,
        updatedAt:        row.updated_at,
      };
    }

    /* Rellenar con defaults los módulos que aún no estén en BD */
    for (const [clave, cfg] of Object.entries(MODULOS_DEFAULT)) {
      if (!modulos[clave]) {
        modulos[clave] = {
          etiqueta:        cfg.etiqueta,
          habilitado:      cfg.habilitado,
          rolesPermitidos: cfg.roles_permitidos,
          mensajeBloqueo:  cfg.mensaje_bloqueo,
          actualizadoPor:  null,
          updatedAt:       null,
        };
      }
    }

    return res.json({ success: true, modulos });
  } catch (err) {
    logger.error("modulos", `Error al leer estado: ${err.message}`);
    /* Fallback: devolver defaults sin BD para no romper el frontend */
    const fallback = {};
    for (const [clave, cfg] of Object.entries(MODULOS_DEFAULT)) {
      fallback[clave] = {
        etiqueta:        cfg.etiqueta,
        habilitado:      cfg.habilitado,
        rolesPermitidos: cfg.roles_permitidos,
        mensajeBloqueo:  cfg.mensaje_bloqueo,
        actualizadoPor:  null,
        updatedAt:       null,
      };
    }
    return res.json({ success: true, modulos: fallback, fallback: true });
  }
});

/* ── POST /api/modulos/:modulo/toggle ── */
router.post("/:modulo/toggle", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { modulo } = req.params;
  const clave = String(modulo).toUpperCase();
  const usuario = req.user?.email || req.user?.username || "admin";

  if (!MODULOS_DEFAULT[clave]) {
    return res.status(400).json({
      success: false,
      message: `Módulo desconocido: ${clave}`,
      code:    "MODULO_DESCONOCIDO",
    });
  }

  try {
    await ensureModulosTable();

    /* Si habilitado viene en el body lo usa; si no, hace toggle */
    const actualResult = await query(
      `SELECT habilitado FROM ${SCHEMA}.modulos_control WHERE modulo = $1`,
      [clave]
    );
    const actual = actualResult.rows[0]?.habilitado ?? MODULOS_DEFAULT[clave].habilitado;
    const nuevoEstado = typeof req.body?.habilitado === "boolean"
      ? req.body.habilitado
      : !actual;

    await query(
      `
      INSERT INTO ${SCHEMA}.modulos_control (modulo, etiqueta, habilitado, roles_permitidos, mensaje_bloqueo, actualizado_por, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (modulo) DO UPDATE
        SET habilitado      = EXCLUDED.habilitado,
            actualizado_por = EXCLUDED.actualizado_por,
            updated_at      = NOW()
      `,
      [
        clave,
        MODULOS_DEFAULT[clave].etiqueta,
        nuevoEstado,
        MODULOS_DEFAULT[clave].roles_permitidos,
        MODULOS_DEFAULT[clave].mensaje_bloqueo,
        usuario,
      ]
    );

    logger.info("modulos", `Toggle módulo ${clave}: habilitado=${nuevoEstado} por ${usuario}`);

    return res.json({
      success:    true,
      modulo:     clave,
      habilitado: nuevoEstado,
      message:    `Módulo ${clave} ${nuevoEstado ? "habilitado" : "deshabilitado"} correctamente.`,
    });
  } catch (err) {
    logger.error("modulos", `Error en toggle de ${clave}: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error al cambiar estado del módulo.",
      detail:  err.message,
    });
  }
});

/* ── PUT /api/modulos/:modulo ── */
router.put("/:modulo", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { modulo } = req.params;
  const clave = String(modulo).toUpperCase();
  const usuario = req.user?.email || req.user?.username || "admin";

  if (!MODULOS_DEFAULT[clave]) {
    return res.status(400).json({
      success: false,
      message: `Módulo desconocido: ${clave}`,
      code:    "MODULO_DESCONOCIDO",
    });
  }

  const {
    habilitado,
    roles_permitidos,
    mensaje_bloqueo,
    etiqueta,
  } = req.body;

  try {
    await ensureModulosTable();

    await query(
      `
      INSERT INTO ${SCHEMA}.modulos_control
        (modulo, etiqueta, habilitado, roles_permitidos, mensaje_bloqueo, actualizado_por, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (modulo) DO UPDATE
        SET etiqueta         = COALESCE(EXCLUDED.etiqueta, ${SCHEMA}.modulos_control.etiqueta),
            habilitado       = COALESCE(EXCLUDED.habilitado, ${SCHEMA}.modulos_control.habilitado),
            roles_permitidos = COALESCE(EXCLUDED.roles_permitidos, ${SCHEMA}.modulos_control.roles_permitidos),
            mensaje_bloqueo  = COALESCE(EXCLUDED.mensaje_bloqueo, ${SCHEMA}.modulos_control.mensaje_bloqueo),
            actualizado_por  = EXCLUDED.actualizado_por,
            updated_at       = NOW()
      `,
      [
        clave,
        etiqueta   ?? MODULOS_DEFAULT[clave].etiqueta,
        habilitado ?? MODULOS_DEFAULT[clave].habilitado,
        roles_permitidos ?? MODULOS_DEFAULT[clave].roles_permitidos,
        mensaje_bloqueo  ?? MODULOS_DEFAULT[clave].mensaje_bloqueo,
        usuario,
      ]
    );

    logger.info("modulos", `Actualización config módulo ${clave} por ${usuario}`);

    return res.json({
      success: true,
      modulo:  clave,
      message: `Configuración del módulo ${clave} actualizada.`,
    });
  } catch (err) {
    logger.error("modulos", `Error al actualizar ${clave}: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar configuración del módulo.",
      detail:  err.message,
    });
  }
});

module.exports = router;
