const express = require("express");

const router = express.Router();
const { query, SCHEMA } = require("../config/pg");
const { authRequired, requireRole } = require("../middleware/auth");
const logger = require("../middleware/logger");
const { ensureSemanaInicial, getSemanaActiva } = require("../services/semanaService");

async function ensureSistemaEstado() {
  await query(`
    INSERT INTO ${SCHEMA}.sistema_estado (activo, modo)
    SELECT true, 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.sistema_estado)
  `);
}

router.get("/estado", async (req, res) => {
  try {
    await ensureSistemaEstado();
    await ensureSemanaInicial();

    const [estadoRes, semana] = await Promise.all([
      query(`
        SELECT activo, modo, actualizado_por, updated_at
        FROM ${SCHEMA}.sistema_estado
        ORDER BY id
        LIMIT 1
      `),
      getSemanaActiva(),
    ]);

    const row = estadoRes.rows[0] || { activo: true, modo: "manual", updated_at: new Date() };
    const abierto = !!row.activo;

    return res.json({
      success: true,
      activo: abierto,
      abierto,
      estado: abierto ? "abierto" : "cerrado",
      modo: row.modo,
      actualizado_por: row.actualizado_por,
      updated_at: row.updated_at,
      periodo_actual: semana?.periodo || null,
      semana_actual: semana?.semana ? Number(semana.semana) : null,
      anio_actual: semana?.anio ? Number(semana.anio) : null,
    });
  } catch (err) {
    logger.error("sistema", `Error al leer estado: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al leer estado del sistema.", detail: err.message });
  }
});

router.post("/toggle", authRequired, requireRole("ADMIN", "DG"), async (req, res) => {
  const usuario = req.user?.email || req.user?.username || "admin";

  try {
    await ensureSistemaEstado();
    const actual = await query(`SELECT activo FROM ${SCHEMA}.sistema_estado ORDER BY id LIMIT 1`);
    const nuevoActivo =
      typeof req.body?.activo === "boolean"
        ? req.body.activo
        : !(actual.rows[0]?.activo ?? true);

    await query(
      `
        UPDATE ${SCHEMA}.sistema_estado
        SET activo = $1,
            modo = 'manual',
            actualizado_por = $2,
            updated_at = NOW()
        WHERE id = (SELECT id FROM ${SCHEMA}.sistema_estado ORDER BY id LIMIT 1)
      `,
      [nuevoActivo, usuario]
    );

    logger.info("sistema", `Toggle manual: activo=${nuevoActivo} por ${usuario}`);

    return res.json({
      success: true,
      activo: nuevoActivo,
      abierto: nuevoActivo,
      estado: nuevoActivo ? "abierto" : "cerrado",
      modo: "manual",
      actualizado_por: usuario,
      message: `Sistema ${nuevoActivo ? "abierto" : "cerrado"} correctamente.`,
    });
  } catch (err) {
    logger.error("sistema", `Error en toggle: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al cambiar estado del sistema.", detail: err.message });
  }
});

router.post("/modo", authRequired, requireRole("ADMIN", "DG"), async (req, res) => {
  const { modo } = req.body;

  if (!["manual", "automatico"].includes(modo)) {
    return res.status(400).json({
      success: false,
      message: 'El campo "modo" debe ser "manual" o "automatico".',
      code: "INVALID_MODO",
    });
  }

  const usuario = req.user?.email || req.user?.username || "admin";

  try {
    await ensureSistemaEstado();
    await query(
      `
        UPDATE ${SCHEMA}.sistema_estado
        SET modo = $1,
            actualizado_por = $2,
            updated_at = NOW()
        WHERE id = (SELECT id FROM ${SCHEMA}.sistema_estado ORDER BY id LIMIT 1)
      `,
      [modo, usuario]
    );

    logger.info("sistema", `Modo cambiado a "${modo}" por ${usuario}`);

    return res.json({
      success: true,
      modo,
      actualizado_por: usuario,
      message: `Modo cambiado a "${modo}" correctamente.`,
    });
  } catch (err) {
    logger.error("sistema", `Error al cambiar modo: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al cambiar modo del sistema.", detail: err.message });
  }
});

module.exports = router;
