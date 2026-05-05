const { query, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");
const { ensureSemanaInicial, getSemanaActiva } = require("../services/semanaService");

async function ensureSistemaEstado() {
  await query(`
    INSERT INTO ${SCHEMA}.sistema_estado (activo, modo)
    SELECT true, 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.sistema_estado)
  `);
}

async function getSistemaEstado() {
  await ensureSistemaEstado();
  const result = await query(`
    SELECT id, activo, modo, actualizado_por, updated_at
    FROM ${SCHEMA}.sistema_estado
    ORDER BY id
    LIMIT 1
  `);
  return result.rows[0] || { activo: true, modo: "manual", actualizado_por: null, updated_at: new Date() };
}

async function setSistemaActivo(activo, usuario, modo = "manual") {
  await ensureSistemaEstado();
  await query(
    `
      UPDATE ${SCHEMA}.sistema_estado
      SET activo = $1,
          modo = $2,
          actualizado_por = $3,
          updated_at = NOW()
      WHERE id = (SELECT id FROM ${SCHEMA}.sistema_estado ORDER BY id LIMIT 1)
    `,
    [activo, modo, usuario]
  );
  return getSistemaEstado();
}

async function estado(req, res, next) {
  try {
    await ensureSemanaInicial();
    const [sistema, semana] = await Promise.all([getSistemaEstado(), getSemanaActiva()]);
    const abierto = !!sistema.activo;

    res.json({
      success: true,
      estado: abierto ? "abierto" : "cerrado",
      abierto,
      activo: abierto,
      bloqueado_edicion: !abierto,
      proxima_clausura: null,
      tiempo_restante_minutos: null,
      periodo_actual: semana?.periodo || null,
      semana_actual: semana?.semana ? Number(semana.semana) : null,
      anio_actual: semana?.anio ? Number(semana.anio) : null,
      fecha_apertura: sistema.updated_at,
      ultimo_cierre: sistema.updated_at,
      modo: sistema.modo,
      actualizado_por: sistema.actualizado_por,
      updated_at: sistema.updated_at,
    });
  } catch (err) {
    next(err);
  }
}

async function abrir(req, res, next) {
  try {
    const usuario = req.user?.email || req.user?.username || "admin";
    const actual = await getSistemaEstado();

    if (actual.activo) {
      return res.status(400).json({
        success: false,
        message: "El sistema ya esta abierto.",
        code: "ALREADY_OPEN",
      });
    }

    const updated = await setSistemaActivo(true, usuario, "manual");
    const semana = await getSemanaActiva();

    logger.info("control", `Sistema abierto manualmente por ${usuario}`);

    res.json({
      success: true,
      message: "Sistema abierto correctamente.",
      periodo: semana?.periodo || null,
      estado: updated,
      abierto: true,
    });
  } catch (err) {
    next(err);
  }
}

async function cerrar(req, res, next) {
  try {
    const usuario = req.user?.email || req.user?.username || "admin";
    const actual = await getSistemaEstado();

    if (!actual.activo) {
      return res.status(400).json({
        success: false,
        message: "El sistema ya esta cerrado.",
        code: "ALREADY_CLOSED",
      });
    }

    const updated = await setSistemaActivo(false, usuario, "manual");

    logger.info("control", `Sistema cerrado manualmente por ${usuario}`);

    res.json({
      success: true,
      message: "Sistema cerrado correctamente.",
      estado: updated,
      abierto: false,
      resumen: null,
    });
  } catch (err) {
    next(err);
  }
}

async function toggle(req, res, next) {
  try {
    const usuario = req.user?.email || req.user?.username || "admin";
    const actual = await getSistemaEstado();
    const nuevoActivo = !actual.activo;
    const updated = await setSistemaActivo(nuevoActivo, usuario, "manual");
    const semana = await getSemanaActiva();

    res.json({
      success: true,
      message: `Sistema ${nuevoActivo ? "abierto" : "cerrado"} correctamente.`,
      abierto: nuevoActivo,
      periodo: semana?.periodo || null,
      estado: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function auditoria(req, res, next) {
  try {
    const { obra_id, usuario, pagina = 1, limite = 20 } = req.query;
    const pag = Math.max(1, parseInt(pagina, 10));
    const lim = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const filters = [];
    const params = [];

    if (obra_id) {
      params.push(parseInt(obra_id, 10));
      filters.push(`obra_id = $${params.length}`);
    }

    if (usuario) {
      params.push(usuario);
      filters.push(`usuario = $${params.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const totalRes = await query(`SELECT COUNT(*)::int AS total FROM ${SCHEMA}.auditoria ${where}`, params);
    const total = totalRes.rows[0]?.total || 0;
    const paginas = Math.max(1, Math.ceil(total / lim));

    params.push(lim, (pag - 1) * lim);
    const dataRes = await query(
      `
        SELECT *
        FROM ${SCHEMA}.auditoria
        ${where}
        ORDER BY timestamp DESC, id DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params
    );

    res.json({
      success: true,
      data: dataRes.rows,
      total,
      pagina: pag,
      paginas,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { estado, abrir, cerrar, auditoria, toggle };
