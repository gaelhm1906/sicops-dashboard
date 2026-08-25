/**
 * controllers/inteligenciaCtrl.js
 * Inteligencia Operativa — Fase 1.
 * Explota la tabla `auditoria` (eventos de actualización de avance/estatus)
 * para generar resumen ejecutivo, transiciones de estatus y alertas de
 * obras sin movimiento. No depende de tabla dimensión (Fase 2).
 *
 * GET /api/inteligencia
 */
const { query, SCHEMA } = require("../config/pg");

const UMBRAL_DIAS = [7, 15, 30];
const ESTATUS_TERMINALES = ["CANCELADO", "ENTREGADO"];

function diasDesde(timestamp) {
  if (!timestamp) return null;
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000);
}

async function getResumen() {
  const totalesRes = await query(`
    SELECT
      COUNT(*)::int AS total_eventos,
      COUNT(DISTINCT tabla || '::' || obra_id::text) FILTER (WHERE obra_id IS NOT NULL)::int AS obras_unicas,
      COUNT(*) FILTER (WHERE accion = 'inaugurar')::int AS inauguraciones,
      COUNT(*) FILTER (WHERE accion = 'cancelar')::int AS cancelaciones,
      COUNT(*) FILTER (WHERE accion IN ('actualizar','repetir'))::int AS actualizaciones,
      ROUND(AVG(delta) FILTER (WHERE delta > 0)::numeric, 2) AS avance_promedio_capturado,
      COUNT(DISTINCT usuario) FILTER (WHERE usuario IS NOT NULL AND usuario <> 'SISTEMA')::int AS dgs_activas
    FROM ${SCHEMA}.auditoria
  `);

  const semanalRes = await query(`
    SELECT anio, semana, COUNT(*)::int AS eventos
    FROM ${SCHEMA}.auditoria
    WHERE anio IS NOT NULL AND semana IS NOT NULL
    GROUP BY anio, semana
    ORDER BY anio, semana
  `);

  const topDgRes = await query(`
    SELECT
      usuario,
      COUNT(*)::int AS eventos,
      COUNT(DISTINCT tabla || '::' || obra_id::text) FILTER (WHERE obra_id IS NOT NULL)::int AS obras_distintas,
      ROUND(AVG(delta) FILTER (WHERE delta > 0)::numeric, 2) AS avance_promedio
    FROM ${SCHEMA}.auditoria
    WHERE usuario IS NOT NULL AND usuario <> 'SISTEMA'
    GROUP BY usuario
    ORDER BY eventos DESC
    LIMIT 10
  `);

  const t = totalesRes.rows[0] || {};
  return {
    total_eventos: t.total_eventos || 0,
    obras_unicas: t.obras_unicas || 0,
    inauguraciones: t.inauguraciones || 0,
    cancelaciones: t.cancelaciones || 0,
    actualizaciones: t.actualizaciones || 0,
    avance_promedio_capturado: t.avance_promedio_capturado !== null ? Number(t.avance_promedio_capturado) : null,
    dgs_activas: t.dgs_activas || 0,
    actividad_semanal: semanalRes.rows.map((r) => ({
      anio: r.anio,
      semana: r.semana,
      eventos: r.eventos,
    })),
    top_dgs: topDgRes.rows.map((r) => ({
      usuario: r.usuario,
      eventos: r.eventos,
      obras_distintas: r.obras_distintas,
      avance_promedio: r.avance_promedio !== null ? Number(r.avance_promedio) : null,
    })),
  };
}

async function getTransiciones() {
  const matrizRes = await query(`
    SELECT
      "ESTATUS ANTERIOR" AS estatus_anterior,
      "ESTATUS NUEVO"    AS estatus_nuevo,
      COUNT(*)::int      AS total,
      MAX(timestamp)     AS ultima_fecha
    FROM ${SCHEMA}.auditoria
    WHERE "ESTATUS ANTERIOR" IS NOT NULL
      AND "ESTATUS NUEVO" IS NOT NULL
      AND "ESTATUS ANTERIOR" <> "ESTATUS NUEVO"
    GROUP BY "ESTATUS ANTERIOR", "ESTATUS NUEVO"
    ORDER BY total DESC
  `);

  const recientesRes = await query(`
    SELECT
      tabla, obra_id,
      "NOMBRE DEL SITIO INTERVENIDO" AS nombre_obra,
      "ESTATUS ANTERIOR" AS estatus_anterior,
      "ESTATUS NUEVO"    AS estatus_nuevo,
      usuario, timestamp
    FROM ${SCHEMA}.auditoria
    WHERE "ESTATUS ANTERIOR" IS NOT NULL
      AND "ESTATUS NUEVO" IS NOT NULL
      AND "ESTATUS ANTERIOR" <> "ESTATUS NUEVO"
    ORDER BY timestamp DESC
    LIMIT 15
  `);

  return {
    matriz: matrizRes.rows,
    recientes: recientesRes.rows,
  };
}

async function getSinMovimiento() {
  const ultimoEventoRes = await query(`
    SELECT DISTINCT ON (tabla, obra_id)
      tabla, obra_id,
      "NOMBRE DEL SITIO INTERVENIDO" AS nombre_obra,
      "ESTATUS NUEVO" AS estatus,
      usuario, timestamp
    FROM ${SCHEMA}.auditoria
    WHERE obra_id IS NOT NULL AND tabla IS NOT NULL AND tabla <> 'SISTEMA'
    ORDER BY tabla, obra_id, timestamp DESC
  `);

  const activos = ultimoEventoRes.rows.filter(
    (r) => !ESTATUS_TERMINALES.includes(String(r.estatus || "").trim().toUpperCase())
  );

  const conDias = activos.map((r) => ({
    tabla: r.tabla,
    obra_id: r.obra_id,
    nombre_obra: r.nombre_obra,
    estatus: r.estatus,
    usuario: r.usuario,
    ultima_actualizacion: r.timestamp,
    dias_sin_movimiento: diasDesde(r.timestamp),
  }));

  const resumenBuckets = { d7: 0, d15: 0, d30: 0 };
  conDias.forEach((o) => {
    if (o.dias_sin_movimiento >= 30) resumenBuckets.d30 += 1;
    else if (o.dias_sin_movimiento >= 15) resumenBuckets.d15 += 1;
    else if (o.dias_sin_movimiento >= 7) resumenBuckets.d7 += 1;
  });

  const listado = conDias
    .filter((o) => o.dias_sin_movimiento >= UMBRAL_DIAS[0])
    .sort((a, b) => b.dias_sin_movimiento - a.dias_sin_movimiento)
    .slice(0, 200);

  return { resumen: resumenBuckets, listado };
}

exports.getInteligenciaOperativa = async (req, res) => {
  try {
    const [resumen, transiciones, sinMovimiento] = await Promise.all([
      getResumen(),
      getTransiciones(),
      getSinMovimiento(),
    ]);

    res.json({
      success: true,
      generado_en: new Date().toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
      resumen,
      transiciones,
      sinMovimiento,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
