const router = require('express').Router();
const pool   = require('../db');
const SCHEMA = process.env.DB_SCHEMA || 'sig_sobse';

/* ══════════════════════════════════════════════════════════════════════
   MODO OBRAS — catálogo y mapeo (columnas MAYÚSCULAS en DB)
   ══════════════════════════════════════════════════════════════════════ */
const COLUMN_META = {
  nombre_obra:          { label: 'Nombre de obra',      type: 'text'   },
  identificador:        { label: 'Identificador',        type: 'text'   },
  programa:             { label: 'Programa',             type: 'text'   },
  dg:                   { label: 'DG',                   type: 'text'   },
  year:                 { label: 'Año',                  type: 'text'   },
  alcaldia:             { label: 'Alcaldía',             type: 'text'   },
  colonia:              { label: 'Colonia',              type: 'text'   },
  calle_domicilio:      { label: 'Calle o Domicilio',    type: 'text'   },
  estatus:              { label: 'Estatus',              type: 'text'   },
  avance_real:          { label: 'Avance (%)',           type: 'number' },
  fecha_inauguracion:   { label: 'Fecha inauguración',   type: 'date'   },
  clave_programa:       { label: 'Clave programa',       type: 'text'   },
  clave_eje:            { label: 'Clave eje',            type: 'text'   },
  nombre_eje:           { label: 'Eje',                  type: 'text'   },
  bloque_mundial:       { label: 'Bloque Mundial',       type: 'text'   },
  monto:                { label: 'Monto (obra)',         type: 'number' },
  origen_del_recurso:   { label: 'Origen del recurso',   type: 'text'   },
  fondo_del_recurso:    { label: 'Fondo del recurso',    type: 'text'   },
  capitulo_del_recurso: { label: 'Capítulo del recurso', type: 'text'   },
  modalidad:            { label: 'Modalidad',            type: 'text'   },
  origen_del_compromiso:{ label: 'Origen compromiso',    type: 'text'   },
  tipo:                 { label: 'Tipo',                 type: 'text'   },
  material:             { label: 'Material',             type: 'text'   },
  superficie_m2:        { label: 'Superficie (m²)',      type: 'number' },
  responsable_dg:       { label: 'Responsable DG',       type: 'text'   },
};
const WHITELIST = new Set(Object.keys(COLUMN_META));

const COL_DB = {
  clave_unica:          'clave_unica',
  nombre_obra:          '"NOMBRE_OBRA"',
  identificador:        '"IDENTIFICADOR"',
  programa:             '"PROGRAMA"',
  dg:                   '"DG"',
  year:                 '"YEAR"::text',
  alcaldia:             '"ALCALDIA"',
  colonia:              '"COLONIA"',
  calle_domicilio:      '"CALLE/DOMICILIO"',
  estatus:              '"ESTATUS"',
  avance_real:          '"AVANCE REAL"::text',
  fecha_inauguracion:   '"FECHA INAUGURACION"',
  clave_programa:       '"CLAVE_PROGRAMA"',
  clave_eje:            '"CLAVE_EJE"',
  nombre_eje:           '"NOMBRE_EJE"',
  bloque_mundial:       '"BLOQUE_MUNDIAL"',
  monto:                '"MONTO"::text',
  origen_del_recurso:   '"ORIGEN DEL RECURSO"',
  fondo_del_recurso:    '"FONDO DEL RECURSO"',
  capitulo_del_recurso: '"CAPITULO DEL RECURSO"',
  modalidad:            '"MODALIDAD"',
  origen_del_compromiso:'"ORIGEN DEL COMPROMISO"',
  tipo:                 '"TIPO"',
  material:             '"MATERIAL"',
  superficie_m2:        '"SUPERFICIE_M2"',
  responsable_dg:       '"RESPONSABLE_DG"',
};

/* ══════════════════════════════════════════════════════════════════════
   MODO ALCANCES — alcances_obras (columnas minúsculas)
   ══════════════════════════════════════════════════════════════════════ */
const COLUMN_META_ALCANCES = {
  nombre_obra:   { label: 'Nombre de obra',  type: 'text'   },
  programa:      { label: 'Programa',         type: 'text'   },
  dg:            { label: 'DG',              type: 'text'   },
  accion:        { label: 'Acción',          type: 'text'   },
  concepto:      { label: 'Concepto',        type: 'text'   },
  cantidad:      { label: 'Cantidad',        type: 'number' },
  unidad:        { label: 'Unidad',          type: 'text'   },
  tipo_alcance:  { label: 'Tipo de alcance', type: 'text'   },
  fecha_captura: { label: 'Fecha captura',   type: 'date'   },
};
const WHITELIST_ALCANCES = new Set(Object.keys(COLUMN_META_ALCANCES));

const COL_EXPR_ALCANCES = {
  nombre_obra:   'a.nombre_obra',
  programa:      'a.programa',
  dg:            'a.dg',
  accion:        'a.accion',
  concepto:      'a.concepto',
  cantidad:      'a.cantidad::text',
  unidad:        'a.unidad',
  tipo_alcance:  'a.tipo_alcance',
  fecha_captura: 'a.fecha_captura::text',
};

/* ══════════════════════════════════════════════════════════════════════
   MODO FRENTES — frentes_obra (columnas minúsculas, sin programa/dg)
   programa y dg se enriquecen via JOIN con obras_scope CTE
   ══════════════════════════════════════════════════════════════════════ */
const COLUMN_META_FRENTES = {
  nombre_obra:  { label: 'Nombre de obra',      type: 'text' },
  programa:     { label: 'Programa',             type: 'text' },
  dg:           { label: 'DG',                   type: 'text' },
  empresa:      { label: 'Empresa',              type: 'text' },
  contrato:     { label: 'Contrato',             type: 'text' },
  monto:        { label: 'Monto contrato',       type: 'text' },
  avance:       { label: 'Avance (%)',           type: 'text' },
  estatus:      { label: 'Estatus frente',       type: 'text' },
  jud:          { label: 'JUD',                  type: 'text' },
  inicio_contr: { label: 'Inicio contrato',      type: 'text' },
  fin_contr:    { label: 'Fin contrato',         type: 'text' },
  alcaldia:     { label: 'Alcaldía',             type: 'text' },
  colonia:      { label: 'Colonia',              type: 'text' },
  calle:        { label: 'Calle',                type: 'text' },
  year:         { label: 'Año (frente)',         type: 'text' },
  empresa_sup:  { label: 'Empresa supervisión',  type: 'text' },
  contr_sup:    { label: 'Contrato supervisión', type: 'text' },
  monto_sup:    { label: 'Monto supervisión',    type: 'text' },
};
const WHITELIST_FRENTES = new Set(Object.keys(COLUMN_META_FRENTES));

const COL_EXPR_FRENTES = {
  nombre_obra:  'f.nombre_obra',
  programa:     'o.programa',
  dg:           'o.dg',
  empresa:      'f.empresa',
  contrato:     'f.contrato',
  monto:        'f.monto',
  avance:       'f.avance',
  estatus:      'f.estatus',
  jud:          'f.jud',
  inicio_contr: 'f.inicio_contr',
  fin_contr:    'f.fin_contr',
  alcaldia:     'f.alcaldia',
  colonia:      'f.colonia',
  calle:        'f.calle',
  year:         'f.year',
  empresa_sup:  'f.empresa_sup',
  contr_sup:    'f.contr_sup',
  monto_sup:    'f.monto_sup',
};

/* ══════════════════════════════════════════════════════════════════════
   MODO INFORMACIÓN DE OBRA — informacion_general_obras
   ══════════════════════════════════════════════════════════════════════ */
const COLUMN_META_INFO = {
  nombre_obra:   { label: 'Nombre de obra',   type: 'text'   },
  programa:      { label: 'Programa',          type: 'text'   },
  dg:            { label: 'DG',               type: 'text'   },
  area:          { label: 'Área',             type: 'text'   },
  indicador:     { label: 'Indicador',        type: 'text'   },
  valor:         { label: 'Valor numérico',   type: 'number' },
  valor_texto:   { label: 'Valor texto',      type: 'text'   },
  unidad_medida: { label: 'Unidad de medida', type: 'text'   },
  fecha_captura: { label: 'Fecha captura',    type: 'date'   },
};
const WHITELIST_INFO = new Set(Object.keys(COLUMN_META_INFO));

const COL_EXPR_INFO = {
  nombre_obra:   'ig.nombre_obra',
  programa:      'ig.programa',
  dg:            'ig.dg',
  area:          'ig.area',
  indicador:     'ig.indicador',
  valor:         'ig.valor::text',
  valor_texto:   'ig.valor_texto',
  unidad_medida: 'ig.unidad_medida',
  fecha_captura: 'ig.fecha_captura::text',
};

/* ══════════════════════════════════════════════════════════════════════
   Shared: estatus conditions y year filter
   ══════════════════════════════════════════════════════════════════════ */
const ESTATUS_CONDITIONS = {
  INAUGURADA:   `UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) IN ('INAUGURADA','INAUGURADO','ENTREGADA','ENTREGADO')`,
  TERMINADA:    `UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) IN ('TERMINADA','TERMINADO','CONCLUIDA','CONCLUIDO')`,
  'EN PROCESO': `(UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) LIKE '%PROCESO%' OR UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) LIKE '%EJECUCION%' OR UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) = 'EN OBRA')`,
  'SIN INICIAR':`(UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) NOT IN ('INAUGURADA','INAUGURADO','ENTREGADA','ENTREGADO','TERMINADA','TERMINADO','CONCLUIDA','CONCLUIDO') AND UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) NOT LIKE '%PROCESO%' AND UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) NOT LIKE '%EJECUCION%' AND UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) <> 'EN OBRA' AND UPPER(BTRIM(COALESCE("ESTATUS"::text,''))) NOT LIKE '%CANCELAD%')`,
};

function yearFilterExpr(placeholder) {
  return `(
    "YEAR"::text = ANY(${placeholder}::text[])
    OR ("YEAR"::text LIKE '%-%' AND (
      SPLIT_PART("YEAR"::text,'-',1) = ANY(${placeholder}::text[]) OR
      SPLIT_PART("YEAR"::text,'-',2) = ANY(${placeholder}::text[])
    ))
    OR ("YEAR"::text ILIKE '% Y %' AND (
      BTRIM(SPLIT_PART("YEAR"::text,' ',1)) = ANY(${placeholder}::text[]) OR
      BTRIM(SPLIT_PART("YEAR"::text,' ',3)) = ANY(${placeholder}::text[])
    ))
  )`;
}

/* ── CTE de obras filtradas (compartida por los 3 modos hijos) ────────
   Muta `params` (ya contiene [years] en $1).
   Devuelve el texto del CTE (sin WITH) y el siguiente índice de param. */
function buildObrasCTE(filtros, params) {
  let pi = params.length + 1; // $1 = years, siguiente libre = 2
  const yf = yearFilterExpr('$1');
  let obraWhere = '';

  if (filtros.dg && String(filtros.dg).trim()) {
    params.push(String(filtros.dg).trim());
    obraWhere += ` AND BTRIM(COALESCE("DG"::text,'')) = $${pi++}`;
  }
  if (filtros.programa && String(filtros.programa).trim()) {
    params.push(String(filtros.programa).trim());
    obraWhere += ` AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $${pi++}`;
  }
  if (filtros.bloque_mundial_only) {
    obraWhere += ` AND "BLOQUE_MUNDIAL" IS NOT NULL AND BTRIM(COALESCE("BLOQUE_MUNDIAL"::text,'')) <> ''`;
  }
  const selectedEstatus = (Array.isArray(filtros.estatus) ? filtros.estatus : [])
    .filter(e => ESTATUS_CONDITIONS[e]);
  if (selectedEstatus.length > 0) {
    obraWhere += ` AND (${selectedEstatus.map(e => ESTATUS_CONDITIONS[e]).join(' OR ')})`;
  }

  const cte = `
    obras_union AS (
      SELECT clave_unica, "PROGRAMA" AS programa, "DG" AS dg
        FROM "${SCHEMA}".obras_puntos    WHERE ${yf}${obraWhere}
      UNION ALL
      SELECT clave_unica, "PROGRAMA" AS programa, "DG" AS dg
        FROM "${SCHEMA}".obras_lineas    WHERE ${yf}${obraWhere}
      UNION ALL
      SELECT clave_unica, "PROGRAMA" AS programa, "DG" AS dg
        FROM "${SCHEMA}".obras_poligonos WHERE ${yf}${obraWhere}
    ),
    obras_scope AS (
      SELECT DISTINCT ON (clave_unica) clave_unica, programa, dg
      FROM obras_union ORDER BY clave_unica
    )`;

  return { cte, nextPi: pi };
}

/* ══════════════════════════════════════════════════════════════════════
   MODO OBRAS — sin cambios respecto a implementación original
   ══════════════════════════════════════════════════════════════════════ */
function buildQuery(body, forExport = false) {
  const filtros = body.filtros || {};
  const years = (Array.isArray(filtros.years) && filtros.years.length > 0)
    ? filtros.years.map(String) : ['2025'];

  const requestedCols = (Array.isArray(body.columnas?.obras) ? body.columnas.obras : [])
    .filter(c => WHITELIST.has(c));
  if (!requestedCols.includes('nombre_obra')) requestedCols.unshift('nombre_obra');
  const allCols = ['clave_unica', ...requestedCols.filter(c => c !== 'clave_unica')];

  const params = [years];
  let pi = 2;

  const colSQL = allCols
    .map(c => {
      const dbExpr = COL_DB[c];
      if (!dbExpr) return null;
      return c === 'clave_unica' ? 'clave_unica' : `${dbExpr} AS ${c}`;
    })
    .filter(Boolean)
    .join(', ');

  let extraWhere = '';
  if (filtros.dg && String(filtros.dg).trim()) {
    params.push(String(filtros.dg).trim());
    extraWhere += ` AND BTRIM(COALESCE("DG"::text,'')) = $${pi++}`;
  }
  if (filtros.programa && String(filtros.programa).trim()) {
    params.push(String(filtros.programa).trim());
    extraWhere += ` AND BTRIM(COALESCE("PROGRAMA"::text,'')) = $${pi++}`;
  }
  if (filtros.bloque_mundial_only) {
    extraWhere += ` AND "BLOQUE_MUNDIAL" IS NOT NULL AND BTRIM(COALESCE("BLOQUE_MUNDIAL"::text,'')) <> ''`;
  }
  const selectedEstatus = (Array.isArray(filtros.estatus) ? filtros.estatus : [])
    .filter(e => ESTATUS_CONDITIONS[e]);
  if (selectedEstatus.length > 0) {
    extraWhere += ` AND (${selectedEstatus.map(e => ESTATUS_CONDITIONS[e]).join(' OR ')})`;
  }

  const yf = yearFilterExpr('$1');
  const unionSQL = `
    SELECT ${colSQL} FROM "${SCHEMA}".obras_puntos    WHERE ${yf}${extraWhere}
    UNION ALL
    SELECT ${colSQL} FROM "${SCHEMA}".obras_lineas    WHERE ${yf}${extraWhere}
    UNION ALL
    SELECT ${colSQL} FROM "${SCHEMA}".obras_poligonos WHERE ${yf}${extraWhere}
  `;

  if (forExport) {
    return {
      sql: `WITH base AS (${unionSQL}),
            dedup AS (SELECT DISTINCT ON (clave_unica) * FROM base ORDER BY clave_unica)
            SELECT * FROM dedup ORDER BY nombre_obra NULLS LAST LIMIT 5000`,
      params, cols: allCols,
    };
  }

  const limite = Math.min(Math.max(Number(body.limite) || 50, 10), 500);
  const pagina = Math.max(Number(body.pagina) || 1, 1);
  const offset = (pagina - 1) * limite;
  params.push(limite, offset);

  return {
    sql: `WITH base AS (${unionSQL}),
          dedup AS (SELECT DISTINCT ON (clave_unica) * FROM base ORDER BY clave_unica),
          total_cte AS (SELECT COUNT(*)::int AS n FROM dedup)
          SELECT d.*, t.n AS _total
          FROM dedup d, total_cte t
          ORDER BY d.nombre_obra NULLS LAST
          LIMIT $${pi} OFFSET $${pi + 1}`,
    params, cols: allCols, limite, pagina,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   MODO ALCANCES
   ══════════════════════════════════════════════════════════════════════ */
function buildQueryAlcances(body, forExport = false) {
  const filtros = body.filtros || {};
  const years = (Array.isArray(filtros.years) && filtros.years.length > 0)
    ? filtros.years.map(String) : ['2025'];

  const requested = (Array.isArray(body.columnas?.alcances) ? body.columnas.alcances : [])
    .filter(c => WHITELIST_ALCANCES.has(c));
  const displayCols = requested.length > 0
    ? [...new Set(['nombre_obra', ...requested])]
    : ['nombre_obra', 'programa', 'dg', 'accion', 'concepto', 'cantidad', 'unidad', 'tipo_alcance'];
  const allCols = ['clave_unica', ...displayCols];

  const params = [years];
  const { cte, nextPi } = buildObrasCTE(filtros, params);
  let pi = nextPi;

  const colSQL = displayCols
    .map(c => COL_EXPR_ALCANCES[c] ? `${COL_EXPR_ALCANCES[c]} AS ${c}` : null)
    .filter(Boolean).join(', ');

  const dataSQL = `
    SELECT a.clave_unica, ${colSQL}
    FROM "${SCHEMA}".alcances_obras a
    WHERE a.clave_unica IN (SELECT clave_unica FROM obras_scope)`;

  if (forExport) {
    return {
      sql: `WITH ${cte} ${dataSQL}
            ORDER BY a.nombre_obra NULLS LAST, a.concepto NULLS LAST
            LIMIT 5000`,
      params, cols: allCols,
    };
  }

  const limite = Math.min(Math.max(Number(body.limite) || 50, 10), 500);
  const pagina = Math.max(Number(body.pagina) || 1, 1);
  const offset = (pagina - 1) * limite;
  params.push(limite, offset);

  return {
    sql: `WITH ${cte},
          data AS (${dataSQL}),
          total_cte AS (SELECT COUNT(*)::int AS n FROM data)
          SELECT d.*, t.n AS _total FROM data d, total_cte t
          ORDER BY d.nombre_obra NULLS LAST, d.concepto NULLS LAST
          LIMIT $${pi} OFFSET $${pi + 1}`,
    params, cols: allCols, limite, pagina,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   MODO FRENTES
   programa y dg se inyectan via JOIN con obras_scope (no existen en frentes_obra)
   ══════════════════════════════════════════════════════════════════════ */
function buildQueryFrente(body, forExport = false) {
  const filtros = body.filtros || {};
  const years = (Array.isArray(filtros.years) && filtros.years.length > 0)
    ? filtros.years.map(String) : ['2025'];

  const requested = (Array.isArray(body.columnas?.frentes) ? body.columnas.frentes : [])
    .filter(c => WHITELIST_FRENTES.has(c));
  const displayCols = requested.length > 0
    ? [...new Set(['nombre_obra', ...requested])]
    : ['nombre_obra', 'programa', 'dg', 'empresa', 'contrato', 'monto', 'avance', 'estatus', 'jud', 'inicio_contr', 'fin_contr'];
  const allCols = ['clave_unica', ...displayCols];

  const params = [years];
  const { cte, nextPi } = buildObrasCTE(filtros, params);
  let pi = nextPi;

  const colSQL = displayCols
    .map(c => COL_EXPR_FRENTES[c] ? `${COL_EXPR_FRENTES[c]} AS ${c}` : null)
    .filter(Boolean).join(', ');

  const dataSQL = `
    SELECT f.clave_unica, ${colSQL}
    FROM "${SCHEMA}".frentes_obra f
    JOIN obras_scope o ON o.clave_unica = f.clave_unica`;

  if (forExport) {
    return {
      sql: `WITH ${cte} ${dataSQL}
            ORDER BY f.nombre_obra NULLS LAST
            LIMIT 5000`,
      params, cols: allCols,
    };
  }

  const limite = Math.min(Math.max(Number(body.limite) || 50, 10), 500);
  const pagina = Math.max(Number(body.pagina) || 1, 1);
  const offset = (pagina - 1) * limite;
  params.push(limite, offset);

  return {
    sql: `WITH ${cte},
          data AS (${dataSQL}),
          total_cte AS (SELECT COUNT(*)::int AS n FROM data)
          SELECT d.*, t.n AS _total FROM data d, total_cte t
          ORDER BY d.nombre_obra NULLS LAST
          LIMIT $${pi} OFFSET $${pi + 1}`,
    params, cols: allCols, limite, pagina,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   MODO INFORMACIÓN DE OBRA
   ══════════════════════════════════════════════════════════════════════ */
function buildQueryInfoGeneral(body, forExport = false) {
  const filtros = body.filtros || {};
  const years = (Array.isArray(filtros.years) && filtros.years.length > 0)
    ? filtros.years.map(String) : ['2025'];

  const requested = (Array.isArray(body.columnas?.info_general) ? body.columnas.info_general : [])
    .filter(c => WHITELIST_INFO.has(c));
  const displayCols = requested.length > 0
    ? [...new Set(['nombre_obra', ...requested])]
    : ['nombre_obra', 'programa', 'dg', 'area', 'indicador', 'valor', 'valor_texto', 'unidad_medida'];
  const allCols = ['clave_unica', ...displayCols];

  const params = [years];
  const { cte, nextPi } = buildObrasCTE(filtros, params);
  let pi = nextPi;

  const colSQL = displayCols
    .map(c => COL_EXPR_INFO[c] ? `${COL_EXPR_INFO[c]} AS ${c}` : null)
    .filter(Boolean).join(', ');

  const dataSQL = `
    SELECT ig.clave_unica, ${colSQL}
    FROM "${SCHEMA}".informacion_general_obras ig
    WHERE ig.clave_unica IN (SELECT clave_unica FROM obras_scope)`;

  if (forExport) {
    return {
      sql: `WITH ${cte} ${dataSQL}
            ORDER BY ig.nombre_obra NULLS LAST, ig.indicador NULLS LAST
            LIMIT 5000`,
      params, cols: allCols,
    };
  }

  const limite = Math.min(Math.max(Number(body.limite) || 50, 10), 500);
  const pagina = Math.max(Number(body.pagina) || 1, 1);
  const offset = (pagina - 1) * limite;
  params.push(limite, offset);

  return {
    sql: `WITH ${cte},
          data AS (${dataSQL}),
          total_cte AS (SELECT COUNT(*)::int AS n FROM data)
          SELECT d.*, t.n AS _total FROM data d, total_cte t
          ORDER BY d.nombre_obra NULLS LAST, d.indicador NULLS LAST
          LIMIT $${pi} OFFSET $${pi + 1}`,
    params, cols: allCols, limite, pagina,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Dispatcher y helpers de respuesta
   ══════════════════════════════════════════════════════════════════════ */
function dispatch(body, forExport = false) {
  switch (body.modo) {
    case 'alcances':     return buildQueryAlcances(body, forExport);
    case 'frentes':      return buildQueryFrente(body, forExport);
    case 'info_general': return buildQueryInfoGeneral(body, forExport);
    default:             return buildQuery(body, forExport);
  }
}

function labelsForModo(modo, cols) {
  const meta = {
    alcances:     COLUMN_META_ALCANCES,
    frentes:      COLUMN_META_FRENTES,
    info_general: COLUMN_META_INFO,
  }[modo] ?? COLUMN_META;
  const labels = {};
  cols.forEach(c => { labels[c] = meta[c]?.label ?? c; });
  return labels;
}

/* ══════════════════════════════════════════════════════════════════════
   Rutas
   ══════════════════════════════════════════════════════════════════════ */
router.post('/avanzadas', async (req, res) => {
  try {
    const { sql, params, cols, limite, pagina } = dispatch(req.body);
    const result = await pool.query(sql, params);
    const total  = result.rows[0]?._total ?? 0;
    const data   = result.rows.map(({ _total, ...row }) => row);
    res.json({ ok: true, total, pagina, limite, columnas: cols, labels: labelsForModo(req.body.modo, cols), data });
  } catch (e) {
    console.error('[/api/consultas/avanzadas]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/avanzadas/exportar', async (req, res) => {
  try {
    const { sql, params, cols } = dispatch(req.body, true);
    const result = await pool.query(sql, params);
    res.json({ ok: true, total: result.rows.length, columnas: cols, labels: labelsForModo(req.body.modo, cols), data: result.rows });
  } catch (e) {
    console.error('[/api/consultas/avanzadas/exportar]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/columnas', (_req, res) => {
  res.json({
    ok: true,
    data: {
      obras:       COLUMN_META,
      alcances:    COLUMN_META_ALCANCES,
      frentes:     COLUMN_META_FRENTES,
      info_general:COLUMN_META_INFO,
    },
  });
});

module.exports = router;
