/**
 * /api/cio — Centro de Inteligencia de Obras
 * Rutas de solo lectura. GET no requiere token (authRequired lo permite).
 * Columnas de obras_puntos/lineas/poligonos son MAYÚSCULAS: "YEAR", "PROGRAMA", "DG", etc.
 * Columnas de frentes_obra y uto_2025 son minúsculas: monto, monto_con_iva, etc.
 */
const router = require('express').Router();
const pool   = require('../db');

const SCHEMA = process.env.DB_SCHEMA || 'sig_sobse';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function normalizeYears(raw) {
  const src = String(raw ?? '').trim();
  if (!src) return [];
  const allowed = new Set([2024, 2025, 2026]);
  return Array.from(
    new Set(
      src.split(',')
        .map(p => parseInt(p.trim(), 10))
        .filter(n => Number.isFinite(n) && allowed.has(n))
    )
  ).sort((a, b) => a - b);
}

function normalizeConcepto(col) {
  return `UPPER(TRANSLATE(BTRIM(COALESCE(${col}::text,'')),
    'ÁÉÍÓÚÄËÏÖÜÀÈÌÒÙÑáéíóúäëïöüàèìòùñ',
    'AEIOUAEIOUAEIOUNAEIOUAEIOUAEIOUn'))`;
}

// "YEAR" puede ser INTEGER o TEXT. Para rangos como '2025-2026' se evalúa si cualquier extremo está en la selección
const YEAR_FILTER = `(
  "YEAR"::text = ANY($1::text[])
  OR ("YEAR"::text LIKE '%-%'
      AND (SPLIT_PART("YEAR"::text,'-',1) = ANY($1::text[])
           OR SPLIT_PART("YEAR"::text,'-',2) = ANY($1::text[])))
)`;

// obras_union: solo clave_unica — columna lowercase en las 3 tablas
function obrasCTE(extraWhere = '') {
  return `
    obras_union AS (
      SELECT clave_unica FROM "${SCHEMA}".obras_puntos    WHERE ${YEAR_FILTER} ${extraWhere}
      UNION ALL
      SELECT clave_unica FROM "${SCHEMA}".obras_lineas    WHERE ${YEAR_FILTER} ${extraWhere}
      UNION ALL
      SELECT clave_unica FROM "${SCHEMA}".obras_poligonos WHERE ${YEAR_FILTER} ${extraWhere}
    )`;
}

// monto en frentes_obra es TEXT con valores como "" o "4/2/14256" → solo castear si es numérico puro
function safeMontoFrentes() {
  return `CASE WHEN BTRIM(COALESCE(f.monto::text,'')) ~ '^[0-9]+(\\.[0-9]+)?$' THEN BTRIM(f.monto::text)::numeric ELSE 0 END`;
}

// "MONTO" en obras_lineas es TEXT; puede incluir comas como separador de miles → remover antes de castear
function safeMontoLineas(col) {
  return `CASE WHEN REGEXP_REPLACE(BTRIM(COALESCE(${col}::text,'')),',','','g') ~ '^[0-9]+(\\.[0-9]+)?$'
    THEN REGEXP_REPLACE(BTRIM(COALESCE(${col}::text,'')),',','','g')::numeric ELSE 0 END`;
}

function monetaryCTE() {
  return `
    frentes_agg AS (
      SELECT
        COALESCE(SUM(${safeMontoFrentes()}), 0) AS monto_frentes,
        COUNT(*)::int                           AS contratos_frentes
      FROM "${SCHEMA}".frentes_obra f
      WHERE f.clave_unica IN (SELECT clave_unica FROM obras_union)
    ),
    uto_agg AS (
      SELECT
        COALESCE(SUM(COALESCE(u.monto_con_iva::numeric, 0)), 0) AS monto_uto,
        COUNT(*)::int                                            AS contratos_uto
      FROM "${SCHEMA}".uto_2025 u
      WHERE u.clave_unica IN (SELECT clave_unica FROM obras_union)
    )`;
}

function coberturaCTE() {
  return `
    cobertura AS (
      SELECT
        COUNT(DISTINCT o.clave_unica)::int  AS obras_total,
        COUNT(DISTINCT a.clave_unica)::int  AS obras_con_alcances,
        COUNT(DISTINCT ig.clave_unica)::int AS obras_con_info_general
      FROM obras_union o
      LEFT JOIN "${SCHEMA}".alcances_obras            a  ON a.clave_unica  = o.clave_unica
      LEFT JOIN "${SCHEMA}".informacion_general_obras ig ON ig.clave_unica = o.clave_unica
    )`;
}

// CTE para indicadores estructurados de informacion_general_obras
function infoGeneralCTE() {
  return `
    info_general_agg AS (
      SELECT
        ig.indicador,
        BTRIM(COALESCE(ig.unidad_medida::text,'')) AS unidad_medida,
        ROUND(SUM(COALESCE(ig.valor, 0))::numeric, 2) AS total_valor,
        COUNT(DISTINCT ig.clave_unica)::int AS obras_con_dato
      FROM "${SCHEMA}".informacion_general_obras ig
      WHERE ig.clave_unica IN (SELECT clave_unica FROM obras_union)
        AND ig.valor IS NOT NULL AND ig.valor > 0
      GROUP BY ig.indicador, ig.unidad_medida
      HAVING SUM(COALESCE(ig.valor, 0)) > 0
      ORDER BY obras_con_dato DESC, total_valor DESC
      LIMIT 10
    )`;
}

const SELECT_BASE = `
  SELECT
    cv.obras_total,
    cv.obras_con_alcances,
    cv.obras_con_info_general,
    (cv.obras_total - cv.obras_con_alcances)        AS obras_sin_alcances,
    CASE WHEN cv.obras_total > 0
      THEN ROUND((cv.obras_con_info_general::numeric / cv.obras_total * 100), 1)
      ELSE 0 END AS cobertura_pct`;

/* ── GET /api/cio/global ──────────────────────────────────────────────────── */
router.get('/global', async (req, res) => {
  const years = normalizeYears(req.query.years ?? req.query.year);
  if (!years.length) years.push(2025);
  try {
    const query = `
      WITH ${obrasCTE()},
      km_agg AS (
        SELECT COALESCE(ROUND(SUM(ST_Length(ST_CurveToLine(geom)::geography)/1000)::numeric, 2), 0) AS km_lineas
        FROM "${SCHEMA}".obras_lineas
        WHERE ("YEAR"::text = ANY($1::text[]) OR ("YEAR"::text LIKE '%-%' AND (SPLIT_PART("YEAR"::text,'-',1) = ANY($1::text[]) OR SPLIT_PART("YEAR"::text,'-',2) = ANY($1::text[]))))
          AND geom IS NOT NULL
      ),
      ${coberturaCTE()}
      ${SELECT_BASE},
        km.km_lineas
      FROM km_agg km, cobertura cv
    `;
    const result = await pool.query(query, [years]);
    res.json({ ok: true, years, data: result.rows[0] ?? null });
  } catch (e) {
    console.error('[/api/cio/global]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── GET /api/cio/dg/:dg ──────────────────────────────────────────────────── */
router.get('/dg/:dg', async (req, res) => {
  const dgNombre = String(req.params.dg ?? '').trim();
  if (!dgNombre) return res.status(400).json({ ok: false, error: 'DG requerida' });
  const years = normalizeYears(req.query.years ?? req.query.year);
  if (!years.length) years.push(2025);

  // "DG" es la columna en obras (MAYÚSCULA)
  const dgWhere = `AND BTRIM(COALESCE("DG"::text,'')) = $2`;

  const isDgsusDg = dgNombre === 'DGSUS';

  const dgsusDgCTEs = !isDgsusDg ? '' : `,
    dgsus_luminarias AS (
      SELECT COALESCE(ROUND(SUM(COALESCE(a.cantidad::numeric,0))::numeric, 0), 0) AS luminarias_total
      FROM "${SCHEMA}".alcances_obras a
      WHERE a.clave_unica IN (SELECT clave_unica FROM obras_union)
        AND BTRIM(UPPER(COALESCE(a.unidad::text,''))) LIKE 'LUMINARIA%'
        AND a.cantidad IS NOT NULL AND a.cantidad::numeric > 0
    ),
    dgsus_monto_dg AS (
      SELECT (
        COALESCE((SELECT SUM(${safeMontoLineas('op."MONTO"')}) FROM "${SCHEMA}".obras_puntos    op   WHERE op.clave_unica   IN (SELECT clave_unica FROM obras_union)), 0)
      + COALESCE((SELECT SUM(${safeMontoLineas('ol."MONTO"')}) FROM "${SCHEMA}".obras_lineas   ol   WHERE ol.clave_unica   IN (SELECT clave_unica FROM obras_union)), 0)
      + COALESCE((SELECT SUM(COALESCE(opol."MONTO"::numeric, 0)) FROM "${SCHEMA}".obras_poligonos opol WHERE opol.clave_unica IN (SELECT clave_unica FROM obras_union)), 0)
      ) AS monto_total
    )`;

  const dgsusDgSelect = !isDgsusDg ? '' : `,
    dgl.luminarias_total AS dgsus_luminarias_total,
    dgm.monto_total      AS dgsus_monto_total`;

  const dgsusDgFrom = !isDgsusDg ? '' : `, dgsus_luminarias dgl, dgsus_monto_dg dgm`;

  try {
    const query = `
      WITH ${obrasCTE(dgWhere)},
      km_agg AS (
        SELECT COALESCE(ROUND(SUM(ST_Length(ST_CurveToLine(geom)::geography)/1000)::numeric, 2), 0) AS km_lineas
        FROM "${SCHEMA}".obras_lineas
        WHERE ${YEAR_FILTER} AND BTRIM(COALESCE("DG"::text,'')) = $2
          AND geom IS NOT NULL
      ),
      m2_agg AS (
        SELECT COALESCE(ROUND(SUM(ST_Area(geom::geography))::numeric,2),0) AS m2_poligonos
        FROM "${SCHEMA}".obras_poligonos
        WHERE ${YEAR_FILTER} AND BTRIM(COALESCE("DG"::text,'')) = $2
          AND geom IS NOT NULL
          AND ST_GeometryType(geom) IN ('ST_Polygon','ST_MultiPolygon')
      ),
      ${coberturaCTE()},
      ${infoGeneralCTE()}
      ${dgsusDgCTEs}
      ${SELECT_BASE},
        km.km_lineas,
        m2.m2_poligonos,
        COALESCE((SELECT json_agg(row_to_json(ig)) FROM info_general_agg ig), '[]'::json) AS indicadores_info_general
        ${dgsusDgSelect}
      FROM km_agg km, m2_agg m2, cobertura cv${dgsusDgFrom}
    `;
    const result = await pool.query(query, [years, dgNombre]);
    res.json({ ok: true, dg: dgNombre, years, data: result.rows[0] ?? null });
  } catch (e) {
    console.error('[/api/cio/dg]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── GET /api/cio/programa/:programa ─────────────────────────────────────── */
router.get('/programa/:programa', async (req, res) => {
  const progNombre = String(req.params.programa ?? '').trim();
  if (!progNombre) return res.status(400).json({ ok: false, error: 'Programa requerido' });
  const years = normalizeYears(req.query.years ?? req.query.year);
  if (!years.length) years.push(2025);
  const dg = String(req.query.dg ?? '').trim();

  // Filtro opcional por claves_unicas específicas (para reportes con filtros activos)
  const clavesParam = String(req.query.claves ?? '').trim();
  const clavesList = clavesParam ? clavesParam.split(',').map(s => s.trim()).filter(Boolean) : null;

  const params = dg ? [years, progNombre, dg] : [years, progNombre];
  let clavesWhere = '';
  if (clavesList && clavesList.length > 0) {
    const idx = params.length + 1;
    clavesWhere = `AND clave_unica = ANY($${idx}::text[])`;
    params.push(clavesList);
  }

  const progWhere = dg
    ? `AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $2 AND BTRIM(COALESCE("DG"::text,'')) = $3 ${clavesWhere}`
    : `AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $2 ${clavesWhere}`;
  const dgCond = dg ? `AND BTRIM(COALESCE("DG"::text,'')) = $3` : '';

  const isDgsus = dg === 'DGSUS';

  const dgsusCTEs = !isDgsus ? '' : `,
    dgsus_ind AS (
      SELECT
        BTRIM(UPPER(COALESCE(a.unidad::text,'')))               AS unidad,
        ROUND(SUM(COALESCE(a.cantidad::numeric,0))::numeric, 0) AS cantidad_total,
        COUNT(DISTINCT a.clave_unica)::int                      AS obras_count,
        COUNT(DISTINCT CASE WHEN a.concepto IS NOT NULL AND BTRIM(a.concepto::text) <> ''
          THEN ${normalizeConcepto('a.concepto')} END)::int      AS conceptos_count
      FROM "${SCHEMA}".alcances_obras a
      WHERE a.clave_unica IN (SELECT clave_unica FROM obras_union)
        AND a.unidad IS NOT NULL AND BTRIM(a.unidad::text) <> ''
        AND a.cantidad IS NOT NULL AND a.cantidad::numeric > 0
      GROUP BY BTRIM(UPPER(COALESCE(a.unidad::text,'')))
      HAVING SUM(COALESCE(a.cantidad::numeric,0)) > 0
    ),
    dgsus_ind_agg AS (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'unidad',          di.unidad,
            'cantidad_total',  di.cantidad_total,
            'obras_count',     di.obras_count,
            'conceptos_count', di.conceptos_count
          ) ORDER BY di.obras_count DESC, di.cantidad_total DESC
        ), '[]'::json
      ) AS dgsus_indicadores
      FROM dgsus_ind di
    ),
    dgsus_monto AS (
      SELECT (
        COALESCE((SELECT SUM(${safeMontoLineas('op."MONTO"')}) FROM "${SCHEMA}".obras_puntos    op   WHERE op.clave_unica   IN (SELECT clave_unica FROM obras_union)), 0)
      + COALESCE((SELECT SUM(${safeMontoLineas('ol."MONTO"')}) FROM "${SCHEMA}".obras_lineas   ol   WHERE ol.clave_unica   IN (SELECT clave_unica FROM obras_union)), 0)
      + COALESCE((SELECT SUM(COALESCE(opol."MONTO"::numeric, 0)) FROM "${SCHEMA}".obras_poligonos opol WHERE opol.clave_unica IN (SELECT clave_unica FROM obras_union)), 0)
      ) AS monto_total
    )`;

  const dgsusSelect = !isDgsus ? '' : `,
    dia.dgsus_indicadores,
    dm.monto_total AS dgsus_monto_total`;

  const dgsusFrom = !isDgsus ? '' : `, dgsus_ind_agg dia, dgsus_monto dm`;

  try {
    const query = `
      WITH ${obrasCTE(progWhere)},
      km_agg AS (
        SELECT COALESCE(ROUND(SUM(ST_Length(ST_CurveToLine(geom)::geography)/1000)::numeric, 2), 0) AS km_lineas
        FROM "${SCHEMA}".obras_lineas
        WHERE ${YEAR_FILTER} AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $2
          ${dgCond} AND geom IS NOT NULL
      ),
      m2_agg AS (
        SELECT COALESCE(ROUND(SUM(ST_Area(geom::geography))::numeric,2),0) AS m2_poligonos
        FROM "${SCHEMA}".obras_poligonos
        WHERE ${YEAR_FILTER} AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $2
          ${dgCond} AND geom IS NOT NULL AND ST_GeometryType(geom) IN ('ST_Polygon','ST_MultiPolygon')
      ),
      ${coberturaCTE()},
      ${infoGeneralCTE()},
      indicadores_alcances AS (
        SELECT
          concepto_norm,
          MAX(obras_con_dato) AS obras_con_dato,
          json_agg(
            json_build_object('unidad', unidad, 'cantidad_total', cantidad_total)
            ORDER BY obras_con_dato DESC, cantidad_total DESC
          ) AS valores
        FROM (
          SELECT
            ${normalizeConcepto('a.concepto')} AS concepto_norm,
            BTRIM(COALESCE(a.unidad::text,'')) AS unidad,
            ROUND(SUM(COALESCE(a.cantidad::numeric,0))::numeric,2) AS cantidad_total,
            COUNT(DISTINCT a.clave_unica)::int AS obras_con_dato
          FROM "${SCHEMA}".alcances_obras a
          WHERE a.clave_unica IN (SELECT clave_unica FROM obras_union)
            AND a.concepto IS NOT NULL AND BTRIM(a.concepto::text) <> ''
            AND a.cantidad IS NOT NULL AND a.cantidad::numeric > 0
          GROUP BY concepto_norm, unidad
          HAVING SUM(COALESCE(a.cantidad::numeric,0)) > 0
        ) sub
        GROUP BY concepto_norm
        ORDER BY MAX(obras_con_dato) DESC, MAX(cantidad_total) DESC
      )
      ${dgsusCTEs}
      ${SELECT_BASE},
        km.km_lineas,
        m2.m2_poligonos,
        COALESCE((SELECT json_agg(row_to_json(ig)) FROM info_general_agg ig),  '[]'::json) AS indicadores_info_general,
        COALESCE((SELECT json_agg(row_to_json(a))  FROM indicadores_alcances a),'[]'::json) AS indicadores_alcances
        ${dgsusSelect}
      FROM km_agg km, m2_agg m2, cobertura cv${dgsusFrom}
    `;
    const result = await pool.query(query, params);
    res.json({ ok: true, programa: progNombre, dg, years, data: result.rows[0] ?? null });
  } catch (e) {
    console.error('[/api/cio/programa]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── GET /api/cio/obra/:clave_unica ───────────────────────────────────────────
   Versión a nivel de UNA obra de "Información General de la Obra" — misma
   tabla (informacion_general_obras) que ya alimenta /api/cio/programa, solo
   que aquí no se agrega por programa: se filtra a una sola clave_unica.
   Mismo shape de indicador (indicador/unidad_medida/total_valor/obras_con_dato)
   para que el frontend reutilice el mismo tipo IndicadorInfoGeneral. */
router.get('/obra/:clave_unica', async (req, res) => {
  const claveUnica = String(req.params.clave_unica ?? '').trim();
  if (!claveUnica) return res.status(400).json({ ok: false, error: 'clave_unica requerida' });

  try {
    const query = `
      SELECT
        ig.indicador,
        BTRIM(COALESCE(ig.unidad_medida::text,'')) AS unidad_medida,
        ROUND(COALESCE(ig.valor, 0)::numeric, 2)    AS total_valor
      FROM "${SCHEMA}".informacion_general_obras ig
      WHERE ig.clave_unica = $1
        AND ig.valor IS NOT NULL AND ig.valor > 0
      ORDER BY ig.valor DESC
    `;
    const result = await pool.query(query, [claveUnica]);
    const indicadores = result.rows.map(r => ({
      indicador:      r.indicador,
      unidad_medida:  r.unidad_medida,
      total_valor:    Number(r.total_valor),
      obras_con_dato: 1,
    }));
    res.json({
      ok: true,
      clave_unica: claveUnica,
      data: {
        obras_con_info_general: indicadores.length > 0 ? 1 : 0,
        indicadores_info_general: indicadores,
      },
    });
  } catch (e) {
    console.error('[/api/cio/obra]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── GET /api/cio/trazabilidad ────────────────────────────────────────────── */
router.get('/trazabilidad', async (req, res) => {
  const tipo     = String(req.query.tipo     ?? '').trim();
  const programa = String(req.query.programa ?? '').trim();
  const dg       = String(req.query.dg       ?? '').trim();
  const concepto = String(req.query.concepto ?? '').trim();
  const years    = normalizeYears(req.query.years ?? req.query.year);
  if (!years.length) years.push(2025);
  if (!tipo) return res.status(400).json({ ok: false, error: 'tipo requerido' });

  const yearExpr = `("YEAR"::text = ANY($1::text[]) OR ("YEAR"::text LIKE '%-%' AND (SPLIT_PART("YEAR"::text,'-',1) = ANY($1::text[]) OR SPLIT_PART("YEAR"::text,'-',2) = ANY($1::text[]))))`;
  const whereParts = [yearExpr];
  const qParams = [years];
  if (programa) { qParams.push(programa); whereParts.push(`BTRIM(COALESCE("PROGRAMA"::text,'')) = $${qParams.length}`); }
  if (dg)       { qParams.push(dg);       whereParts.push(`BTRIM(COALESCE("DG"::text,''))       = $${qParams.length}`); }
  const whereClause = whereParts.join(' AND ');

  // Subconsulta reutilizable para obras origen con nombre
  const OBRAS_NOMBRE_SQL = `(
    SELECT clave_unica, "NOMBRE_OBRA" AS nombre_obra, "PROGRAMA" AS programa, "DG" AS dg
    FROM "${SCHEMA}".obras_puntos
    UNION ALL
    SELECT clave_unica, "NOMBRE_OBRA" AS nombre_obra, "PROGRAMA" AS programa, "DG" AS dg
    FROM "${SCHEMA}".obras_lineas
    UNION ALL
    SELECT clave_unica, "NOMBRE_OBRA" AS nombre_obra, "PROGRAMA" AS programa, "DG" AS dg
    FROM "${SCHEMA}".obras_poligonos
  )`;

  const OBRAS_UNION_SQL = `
    WITH obras_union AS (
      SELECT clave_unica FROM "${SCHEMA}".obras_puntos    WHERE ${whereClause}
      UNION ALL SELECT clave_unica FROM "${SCHEMA}".obras_lineas    WHERE ${whereClause}
      UNION ALL SELECT clave_unica FROM "${SCHEMA}".obras_poligonos WHERE ${whereClause}
    )`;

  try {
    if (tipo === 'concepto') {
      if (!concepto) return res.status(400).json({ ok: false, error: 'concepto requerido' });
      qParams.push(concepto);
      const concIdx = qParams.length;
      const query = `
        ${OBRAS_UNION_SQL},
        alcances_filt AS (
          SELECT a.clave_unica,
            BTRIM(COALESCE(a.concepto::text,''))  AS concepto_orig,
            BTRIM(COALESCE(a.unidad::text,''))    AS unidad,
            COALESCE(a.cantidad::numeric, 0)      AS cantidad
          FROM "${SCHEMA}".alcances_obras a
          WHERE a.clave_unica IN (SELECT clave_unica FROM obras_union)
            AND ${normalizeConcepto('concepto')} = $${concIdx}
            AND a.cantidad IS NOT NULL AND a.cantidad::numeric > 0
        ),
        desglose AS (
          SELECT concepto_orig, unidad,
            ROUND(SUM(cantidad)::numeric,2) AS subtotal,
            COUNT(DISTINCT clave_unica)::int AS obras_count
          FROM alcances_filt GROUP BY concepto_orig, unidad ORDER BY subtotal DESC
        ),
        obras_origen AS (
          SELECT af.clave_unica,
            COALESCE(o.nombre_obra,'') AS nombre_obra,
            COALESCE(o.programa,'')   AS programa,
            COALESCE(o.dg,'')         AS dg,
            ROUND(SUM(af.cantidad)::numeric,2) AS cantidad_obra
          FROM alcances_filt af
          JOIN ${OBRAS_NOMBRE_SQL} o USING (clave_unica)
          GROUP BY af.clave_unica, o.nombre_obra, o.programa, o.dg
          ORDER BY cantidad_obra DESC LIMIT 20
        )
        SELECT
          ROUND(SUM(cantidad)::numeric,2)  AS valor_total,
          MAX(unidad)                      AS unidad,
          COUNT(DISTINCT clave_unica)::int AS obras_con_dato,
          (SELECT COUNT(DISTINCT clave_unica)::int FROM obras_union) AS obras_total,
          COALESCE((SELECT json_agg(row_to_json(d)) FROM desglose d),'[]'::json) AS desglose,
          COALESCE((SELECT json_agg(row_to_json(oo)) FROM obras_origen oo),'[]'::json) AS obras_origen
        FROM alcances_filt
      `;
      const result = await pool.query(query, qParams);
      return res.json({ ok: true, tipo, concepto, data: result.rows[0] ?? null });
    }

    if (tipo === 'monto') {
      const query = `
        ${OBRAS_UNION_SQL},
        frentes_data AS (
          SELECT f.clave_unica,
            COALESCE(o.nombre_obra,'') AS nombre_obra,
            COALESCE(o.programa,'')   AS programa,
            COALESCE(o.dg,'')         AS dg,
            COALESCE(f.monto::numeric,0) AS monto_frente
          FROM "${SCHEMA}".frentes_obra f
          JOIN ${OBRAS_NOMBRE_SQL} o USING (clave_unica)
          WHERE f.clave_unica IN (SELECT clave_unica FROM obras_union)
        ),
        por_obra AS (
          SELECT clave_unica, nombre_obra, programa, dg,
            ROUND(SUM(monto_frente)::numeric,2) AS monto_obra,
            COUNT(*)::int AS frentes_count
          FROM frentes_data GROUP BY clave_unica, nombre_obra, programa, dg
          ORDER BY monto_obra DESC LIMIT 20
        )
        SELECT
          ROUND(SUM(monto_frente)::numeric,2)  AS valor_total,
          COUNT(DISTINCT clave_unica)::int     AS obras_con_dato,
          (SELECT COUNT(DISTINCT clave_unica)::int FROM obras_union) AS obras_total,
          COALESCE((SELECT json_agg(row_to_json(p)) FROM por_obra p),'[]'::json) AS obras_origen
        FROM frentes_data
      `;
      const result = await pool.query(query, qParams);
      return res.json({ ok: true, tipo, data: result.rows[0] ?? null });
    }

    if (tipo === 'cobertura') {
      const query = `
        ${OBRAS_UNION_SQL},
        obras_con_alcances_cte AS (
          SELECT DISTINCT clave_unica
          FROM "${SCHEMA}".alcances_obras
          WHERE clave_unica IN (SELECT clave_unica FROM obras_union)
        ),
        obras_sin_alcances_cte AS (
          SELECT DISTINCT ou.clave_unica
          FROM obras_union ou
          LEFT JOIN obras_con_alcances_cte a ON a.clave_unica = ou.clave_unica
          WHERE a.clave_unica IS NULL
        ),
        obras_info AS (
          SELECT
            osa.clave_unica,
            MAX(COALESCE(o.nombre_obra,'')) AS nombre_obra,
            MAX(COALESCE(o.programa,''))    AS programa,
            MAX(COALESCE(o.dg,''))          AS dg
          FROM obras_sin_alcances_cte osa
          LEFT JOIN ${OBRAS_NOMBRE_SQL} o ON o.clave_unica = osa.clave_unica
          GROUP BY osa.clave_unica
          ORDER BY nombre_obra
          LIMIT 20
        ),
        por_programa AS (
          SELECT
            COALESCE(NULLIF(BTRIM(o.programa),''), 'SIN PROGRAMA') AS programa,
            COUNT(DISTINCT osa.clave_unica)::int                    AS obras_sin_alcances
          FROM obras_sin_alcances_cte osa
          LEFT JOIN ${OBRAS_NOMBRE_SQL} o ON o.clave_unica = osa.clave_unica
          GROUP BY COALESCE(NULLIF(BTRIM(o.programa),''), 'SIN PROGRAMA')
          ORDER BY obras_sin_alcances DESC
        )
        SELECT
          (SELECT COUNT(DISTINCT clave_unica)::int FROM obras_union)            AS obras_total,
          (SELECT COUNT(DISTINCT clave_unica)::int FROM obras_con_alcances_cte) AS obras_con_dato,
          NULL::numeric                                                          AS valor_total,
          COALESCE((SELECT json_agg(row_to_json(oi)) FROM obras_info oi), '[]'::json) AS obras_origen,
          COALESCE((SELECT json_agg(row_to_json(pp)) FROM por_programa pp), '[]'::json) AS por_programa
      `;
      const result = await pool.query(query, qParams);
      return res.json({ ok: true, tipo, data: result.rows[0] ?? null });
    }

    res.status(400).json({ ok: false, error: `tipo '${tipo}' no soportado` });
  } catch (e) {
    console.error('[/api/cio/trazabilidad]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
