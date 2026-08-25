/**
 * controllers/coberturaCtrl.js
 *
 * GET /api/cobertura/alcances-mapa
 *   Devuelve un mapa { clave_unica → info_alcances }.
 *   No lee tablas de obras — solo alcances_obras y alcances_obras_tipo.
 *   Las obras (con su seguimiento correcto) las provee useObras() en el frontend.
 *
 * GET /api/cobertura/alcances  (legacy — lo usan los modales de reporte)
 *   Se mantiene sin cambios para no romper ReporteCoberturaModal ni ReporteDGModal.
 */

const { query, SCHEMA } = require("../config/pg");
const { getProgSeguimientoMap, applySegMap } = require("../utils/seguimientoMap");

/* ════════════════════════════════════════════════════
   GET /api/cobertura/alcances-mapa
   Mapa ligero: { "CLAVE": { tiene_alcances, total_alcances,
                              ultima_captura, ultimo_usuario,
                              tipo_alcance } }
════════════════════════════════════════════════════ */
exports.getAlcancesMapa = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        BTRIM(ao.clave_unica::text)                                             AS clave_unica,
        COUNT(*)::int                                                           AS total_alcances,
        COUNT(DISTINCT ao.concepto)::int                                        AS total_conceptos,
        MAX(ao.fecha_captura)                                                   AS ultima_captura,
        (ARRAY_AGG(ao.usuario_actualizacion ORDER BY ao.fecha_captura DESC))[1] AS ultimo_usuario,
        aot.tipo_alcance
      FROM "${SCHEMA}".alcances_obras ao
      LEFT JOIN "${SCHEMA}".alcances_obras_tipo aot
             ON aot.clave_unica = BTRIM(ao.clave_unica::text)
      GROUP BY BTRIM(ao.clave_unica::text), aot.tipo_alcance
    `);

    const data = {};
    for (const r of result.rows) {
      if (!r.clave_unica) continue;
      data[r.clave_unica] = {
        tiene_alcances:  true,
        total_alcances:  r.total_alcances,
        total_conceptos: r.total_conceptos,
        ultima_captura:  r.ultima_captura,
        ultimo_usuario:  r.ultimo_usuario,
        tipo_alcance:    r.tipo_alcance || null,
      };
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════════
   GET /api/cobertura/alcances  (legacy — mantener para reportes)
════════════════════════════════════════════════════ */
const BASE_SQL_LEGACY = `
  WITH todas_obras AS (
    SELECT
      clave_unica,
      "NOMBRE_OBRA"  AS nombre_obra,
      "PROGRAMA"     AS programa,
      "DG"           AS dg,
      "ALCALDIA"     AS alcaldia,
      ''::text       AS area
    FROM "${SCHEMA}".obras_puntos
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
    UNION
    SELECT clave_unica, "NOMBRE_OBRA", "PROGRAMA", "DG", "ALCALDIA", ''::text
    FROM "${SCHEMA}".obras_lineas
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
    UNION
    SELECT clave_unica, "NOMBRE_OBRA", "PROGRAMA", "DG", "ALCALDIA", ''::text
    FROM "${SCHEMA}".obras_poligonos
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
  ),
  alcances_agg AS (
    SELECT
      BTRIM(clave_unica::text)  AS clave_unica,
      COUNT(*)::int             AS total_alcances,
      MAX(fecha_captura)        AS ultima_captura,
      (ARRAY_AGG(usuario_actualizacion ORDER BY fecha_captura DESC))[1] AS ultimo_usuario
    FROM "${SCHEMA}".alcances_obras
    GROUP BY BTRIM(clave_unica::text)
  )
  SELECT
    BTRIM(o.clave_unica::text)       AS clave_unica,
    o.nombre_obra, o.programa, o.dg, o.alcaldia, o.area,
    (a.clave_unica IS NOT NULL)      AS tiene_alcances,
    COALESCE(a.total_alcances, 0)    AS total_alcances,
    a.ultima_captura, a.ultimo_usuario,
    t.tipo_alcance                   AS tipo_alcance_obra
  FROM todas_obras o
  LEFT JOIN alcances_agg a ON a.clave_unica = BTRIM(o.clave_unica::text)
  LEFT JOIN "${SCHEMA}".alcances_obras_tipo t ON t.clave_unica = BTRIM(o.clave_unica::text)
  WHERE
    ($1::text IS NULL OR o.programa   = $1)
    AND ($2::text IS NULL OR o.alcaldia = $2)
    AND ($3::int  IS NULL OR EXTRACT(YEAR FROM a.ultima_captura) = $3)
  ORDER BY o.programa, BTRIM(o.clave_unica::text)
`;

exports.getCobertura = async (req, res) => {
  const { programa, dg, alcaldia, anio } = req.query;
  const programaVal = programa || null;
  const dgVal       = dg       || null;
  const alcaldiaVal = alcaldia || null;
  const anioVal     = anio ? parseInt(anio, 10) : null;

  try {
    const [result, segMap] = await Promise.all([
      query(BASE_SQL_LEGACY, [programaVal, alcaldiaVal, anioVal]),
      getProgSeguimientoMap(),
    ]);

    const rows = applySegMap(result.rows, segMap, dgVal);

    const conAlcances     = rows.filter((r) =>  r.tiene_alcances);
    const sinAlcances     = rows.length - conAlcances.length;
    const obrasProyectado = conAlcances.filter((r) => r.tipo_alcance_obra === "PROYECTADO").length;
    const obrasEjecutado  = conAlcances.filter((r) => r.tipo_alcance_obra === "EJECUTADO").length;
    const obrasSinTipo    = conAlcances.filter((r) => !r.tipo_alcance_obra).length;
    const cobertura       = rows.length
      ? parseFloat(((conAlcances.length / rows.length) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      kpis: {
        total: rows.length, con_alcances: conAlcances.length,
        sin_alcances: sinAlcances, cobertura_pct: cobertura,
        obras_proyectado: obrasProyectado, obras_ejecutado: obrasEjecutado,
        obras_sin_tipo: obrasSinTipo,
      },
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
