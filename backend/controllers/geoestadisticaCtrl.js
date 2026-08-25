/**
 * controllers/geoestadisticaCtrl.js
 * Módulo: Gestión Controlada de Obras — ROL_GEOESTADISTICA
 *
 * Operaciones disponibles:
 *   getObras           → listar obras (activas e inactivas) con filtros
 *   getObraDetalle     → detalle completo de una obra + dependencias
 *   altaObra           → crear nueva obra en producción
 *   modificarAtributos → modificar campos no geométricos
 *   bajaLogica         → soft-delete con motivo y auditoría
 *   reactivarObra      → revertir una baja lógica
 *   corregirClaveUnica → cascade update de clave_unica con confirmación previa
 *   verificarDependencias → consultar cuántos registros dependientes existen
 *   getCatalogObras    → listar catalogo_obras
 *   getAuditoria       → consultar obras_auditoria con filtros
 */

const { pool, query, SCHEMA } = require("../config/pg");

/* ══════════════════════════════════════════════════════════
   HELPER COMPARTIDO — generarClaveUnica
   Usada por: FormularioAlta (frontend la replica) + CSV import
   Fórmula: PLATSOBSE_{DG}_{CLAVE_PROGRAMA}_{NOMBRE_OBRA}_{IDENTIFICADOR}
══════════════════════════════════════════════════════════ */
const STOPWORDS_CLAVE = new Set([
  "EL","LA","LOS","LAS","DE","DEL","Y","A","AL","EN","POR","PARA",
  "CON","SIN","UN","UNA","E","O","U","QUE","SE","SU","LO",
]);

function generarClaveUnica({ dg, clave_programa, nombre_obra, identificador }) {
  const toSlug = (text) =>
    (text || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .toUpperCase().split(/\s+/)
      .filter((w) => w.length > 0 && !STOPWORDS_CLAVE.has(w))
      .join("_");

  const dgSeg   = (dg || "XX").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const progSeg = toSlug(clave_programa);
  const obraSeg = toSlug(nombre_obra);
  const idPart  = identificador ? `_${toSlug(identificador)}` : "";

  return `PLATSOBSE_${dgSeg}_${progSeg}_${obraSeg}${idPart}`;
}

/* ── Catálogo de motivos de baja válidos ── */
const MOTIVOS_BAJA = [
  "OBRA_DUPLICADA",
  "ERROR_DE_CAPTURA",
  "OBRA_CANCELADA",
  "OBRA_MIGRADA",
  "OBRA_CONSOLIDADA",
  "CAMBIO_DE_PROGRAMA",
  "FUERA_DE_ALCANCE",
  "CAMBIO_TIPO_GEOMETRICO",
  "OTRO",
];

/* ── Helper: setear variables de sesión para auditoría ── */
async function setSessionVars(client, usuario) {
  await client.query(`SELECT set_config('application.geo_usuario', $1, true)`, [usuario || "sistema"]);
  await client.query(`SELECT set_config('application.origen', 'SICOPS', true)`);
}

/* ── Helper: registrar en obras_auditoria manualmente (para operaciones complejas) ── */
async function registrarAuditoria(client, params) {
  const {
    tabla, operacion, clave_unica, usuario, motivo,
    solicitud_id, valores_antes, valores_despues,
    geom_antes, geom_despues, ip_origen,
  } = params;
  await client.query(`
    INSERT INTO "${SCHEMA}".obras_auditoria
      (tabla, operacion, clave_unica, usuario, origen, ip_origen, motivo,
       solicitud_id, valores_antes, valores_despues, geom_antes, geom_despues)
    VALUES ($1,$2,$3,$4,'SICOPS',$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
  `, [
    tabla, operacion, clave_unica, usuario, ip_origen || null, motivo || null,
    solicitud_id || null,
    valores_antes  ? JSON.stringify(valores_antes)  : null,
    valores_despues ? JSON.stringify(valores_despues) : null,
    geom_antes  || null,
    geom_despues || null,
  ]);
}

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/verificar-clave?clave=XXX
   Verifica si una clave_unica ya existe en el sistema.
   Consulta catalogo_obras (fuente única de verdad).
════════════════════════════════════════════════ */
exports.verificarClave = async (req, res) => {
  const { clave } = req.query;
  if (!clave?.trim())
    return res.status(400).json({ success: false, message: "clave requerida." });
  try {
    const r = await query(
      `SELECT 1 FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1 LIMIT 1`,
      [clave.trim()]
    );
    res.json({ success: true, disponible: r.rows.length === 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/catalogo-programa?programa=X
   Devuelve CLAVE_EJE, NOMBRE_EJE, BLOQUE_MUNDIAL y CLAVE_PROGRAMA
   buscando en las 3 tablas de obras (en ese orden).
   Responde programa_nuevo=true si no hay datos para ese programa.
════════════════════════════════════════════════ */
exports.getCatalogoPrograma = async (req, res) => {
  const { programa } = req.query;
  if (!programa) return res.status(400).json({ success: false, message: "programa requerido." });

  const selectCols = `
    "CLAVE_EJE"      AS clave_eje,
    "NOMBRE_EJE"     AS nombre_eje,
    "BLOQUE_MUNDIAL" AS bloque_mundial,
    "CLAVE_PROGRAMA" AS clave_programa
  `;
  const condicion = `"PROGRAMA" = $1 AND "CLAVE_EJE" IS NOT NULL AND "CLAVE_PROGRAMA" IS NOT NULL`;

  try {
    for (const tabla of ["obras_puntos", "obras_lineas", "obras_poligonos"]) {
      const r = await query(
        `SELECT ${selectCols} FROM "${SCHEMA}".${tabla} WHERE ${condicion} LIMIT 1`,
        [programa]
      );
      if (r.rows.length) {
        return res.json({ success: true, data: r.rows[0], programa_nuevo: false });
      }
    }
    /* Ninguna tabla tiene datos para este programa */
    res.json({ success: true, data: null, programa_nuevo: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/obras
   Lista unificada de las tres tablas con filtros.
════════════════════════════════════════════════ */
exports.getObras = async (req, res) => {
  const { estatus, programa, dg, tipo_geometria, q, limit = 200, offset = 0 } = req.query;

  const filtros = [];
  const params  = [];
  let pi = 1;

  if (estatus)          { filtros.push(`o.estatus_registro = $${pi++}`);     params.push(estatus); }
  if (programa)         { filtros.push(`o."PROGRAMA" = $${pi++}`);            params.push(programa); }
  if (dg)               { filtros.push(`o."DG" = $${pi++}`);                  params.push(dg); }
  if (q) {
    filtros.push(`(o."NOMBRE_OBRA" ILIKE $${pi} OR BTRIM(o.clave_unica::TEXT) ILIKE $${pi})`);
    params.push(`%${q}%`); pi++;
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const tablas = [
    { tabla: "obras_puntos",   tipo: "PUNTO"    },
    { tabla: "obras_lineas",   tipo: "LINEA"    },
    { tabla: "obras_poligonos",tipo: "POLIGONO" },
  ].filter((t) => !tipo_geometria || tipo_geometria === t.tipo);

  try {
    const unions = tablas.map((t) => `
      SELECT
        BTRIM(o.clave_unica::TEXT)                       AS clave_unica,
        o."NOMBRE_OBRA"                                  AS nombre_obra,
        o."PROGRAMA"                                     AS programa,
        o."DG"                                           AS dg,
        COALESCE(o."SEGUIMIENTO", o."DG", '')            AS seguimiento,
        o."ALCALDIA"                                     AS alcaldia,
        COALESCE(o."ESTATUS", 'SIN INICIAR')             AS estatus,
        COALESCE(o."TIPO", '')                           AS tipo,
        COALESCE(o."RESPONSABLE_DG", '')                 AS responsable_dg,
        COALESCE(o.estatus_registro,'ACTIVO')            AS estatus_registro,
        COALESCE(o.modo_calculo_avance, 'GENERAL')       AS modo_calculo_avance,
        o.creado_por,
        o.fecha_creacion,
        o.motivo_baja,
        o.fecha_baja,
        o.usuario_baja,
        '${t.tipo}'::TEXT                                AS tipo_geometria,
        '${t.tabla}'::TEXT                               AS tabla_origen
      FROM "${SCHEMA}".${t.tabla} o
      ${where}
    `).join(" UNION ALL ");

    const total = await query(
      `SELECT COUNT(*) AS n FROM (${unions}) u`,
      params
    );

    const rows = await query(
      `${unions} ORDER BY nombre_obra LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    res.json({
      success: true,
      total:   parseInt(total.rows[0].n, 10),
      data:    rows.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/obras/:clave
   Detalle de una obra + conteo de dependencias.
════════════════════════════════════════════════ */
exports.getObraDetalle = async (req, res) => {
  const { clave } = req.params;
  try {
    /* Buscar en catalogo_obras */
    let cat = await query(
      `SELECT * FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`, [clave]
    );

    let tabla_actual, tipo_geometria;

    if (cat.rows.length) {
      tabla_actual   = cat.rows[0].tabla_actual;
      tipo_geometria = cat.rows[0].tipo_geometria;
    } else {
      /* La obra no está en catalogo_obras (fue creada antes de la migración).
         Buscarla directamente en las tres tablas productivas y auto-registrarla. */
      const busqueda = await query(`
        (SELECT 'obras_puntos'   AS tabla, 'PUNTO'    AS tipo
           FROM "${SCHEMA}".obras_puntos    WHERE BTRIM(clave_unica::TEXT) = $1 LIMIT 1)
        UNION ALL
        (SELECT 'obras_lineas'   AS tabla, 'LINEA'    AS tipo
           FROM "${SCHEMA}".obras_lineas    WHERE BTRIM(clave_unica::TEXT) = $1 LIMIT 1)
        UNION ALL
        (SELECT 'obras_poligonos' AS tabla, 'POLIGONO' AS tipo
           FROM "${SCHEMA}".obras_poligonos WHERE BTRIM(clave_unica::TEXT) = $1 LIMIT 1)
        LIMIT 1
      `, [clave]);

      if (!busqueda.rows.length) {
        return res.status(404).json({ success: false, message: "Obra no encontrada." });
      }

      tabla_actual   = busqueda.rows[0].tabla;
      tipo_geometria = busqueda.rows[0].tipo;

      /* Auto-registrar en catalogo_obras para futuras consultas */
      await query(`
        INSERT INTO "${SCHEMA}".catalogo_obras
          (clave_unica, tipo_geometria, tabla_actual, estatus_registro, fecha_creacion)
        VALUES ($1, $2, $3, 'ACTIVO', NOW())
        ON CONFLICT (clave_unica) DO NOTHING
      `, [clave, tipo_geometria, tabla_actual]);

      cat = await query(
        `SELECT * FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`, [clave]
      );
    }

    /* Obtener datos completos — geom como WKT para evitar problemas de serialización */
    const obra = await query(
      `SELECT *, ST_AsText(geom) AS geom_wkt
       FROM "${SCHEMA}".${tabla_actual}
       WHERE BTRIM(clave_unica::TEXT) = $1`, [clave]
    );

    /* Dependencias */
    const deps = await query(`
      SELECT
        (SELECT COUNT(*) FROM "${SCHEMA}".alcances_obras            WHERE BTRIM(clave_unica::TEXT) = $1) AS alcances,
        (SELECT COUNT(*) FROM "${SCHEMA}".informacion_general_obras  WHERE BTRIM(clave_unica::TEXT) = $1) AS info_general,
        (SELECT COUNT(*) FROM "${SCHEMA}".frentes_obra               WHERE BTRIM(clave_unica::TEXT) = $1) AS frentes,
        (SELECT COUNT(*) FROM "${SCHEMA}".alcances_obras_tipo         WHERE BTRIM(clave_unica::TEXT) = $1) AS clasificaciones
    `, [clave]);

    res.json({
      success: true,
      catalogo:     cat.rows[0] || null,
      obra:         obra.rows[0] || null,
      tipo_geometria,
      tabla_actual,
      dependencias: deps.rows[0],
    });
  } catch (err) {
    console.error('[getObraDetalle]', err.message, err.stack?.split('\n')[1] || '');
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   POST /api/geoestadistica/obras/verificar-dependencias
   Consulta dependencias para una clave (previa a corrección).
════════════════════════════════════════════════ */
exports.verificarDependencias = async (req, res) => {
  const { clave_unica } = req.body;
  if (!clave_unica) return res.status(400).json({ success: false, message: "clave_unica requerida." });
  try {
    const deps = await query(`
      SELECT
        (SELECT COUNT(*) FROM "${SCHEMA}".alcances_obras           WHERE BTRIM(clave_unica::TEXT) = $1) AS alcances,
        (SELECT COUNT(*) FROM "${SCHEMA}".informacion_general_obras WHERE BTRIM(clave_unica::TEXT) = $1) AS info_general,
        (SELECT COUNT(*) FROM "${SCHEMA}".frentes_obra              WHERE BTRIM(clave_unica::TEXT) = $1) AS frentes,
        (SELECT COUNT(*) FROM "${SCHEMA}".alcances_obras_tipo        WHERE BTRIM(clave_unica::TEXT) = $1) AS clasificaciones
    `, [clave_unica]);
    res.json({ success: true, data: deps.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Detecta si la geometría es EWKB hex (QGIS) o WKT ── */
function esEwkbHex(str) {
  return /^[0-9A-Fa-f]+$/.test((str || "").trim()) && str.trim().length > 20;
}
/* Devuelve la expresión SQL y los params para construir la geometría */
function geomSql(geom_wkt, paramIndex) {
  const g = (geom_wkt || "").trim();
  if (esEwkbHex(g)) {
    /* EWKB hex (incluye SRID): cast directo */
    return { expr: `$${paramIndex}::geometry`, val: g };
  }
  /* WKT: ST_GeomFromText con SRID explícito 4326 */
  return { expr: `ST_GeomFromText($${paramIndex}, 4326)`, val: g };
}

/* ════════════════════════════════════════════════
   POST /api/geoestadistica/obras/alta
   Crear nueva obra en producción.
   Acepta geometría como WKT o EWKB hex (exportación QGIS).
════════════════════════════════════════════════ */
exports.altaObra = async (req, res) => {
  const {
    tipo_geometria, clave_unica, nombre_obra, programa,
    dg, seguimiento, alcaldia, geom_wkt,
    identificador,   /* NOT NULL — se usa clave_unica si no se provee */
    anio,            /* YEAR entero */
    bloque_mundial,  /* BLOQUE_MUNDIAL integer */
    clave_eje,       /* CLAVE_EJE  — auto-rellena desde catálogo del programa */
    nombre_eje,      /* NOMBRE_EJE — ídem */
    clave_programa,  /* CLAVE_PROGRAMA */
    colonia, calle_domicilio, url_google_maps, observaciones,
    tipo, modalidad, responsable_dg, monto, estatus,
  } = req.body;
  const usuario = req.user?.email || req.user?.usuario || "sistema";

  if (!tipo_geometria || !["PUNTO","LINEA","POLIGONO"].includes(tipo_geometria))
    return res.status(400).json({ success: false, message: "tipo_geometria inválido." });
  if (!clave_unica?.trim())
    return res.status(400).json({ success: false, message: "clave_unica requerida." });
  if (!nombre_obra?.trim())
    return res.status(400).json({ success: false, message: "nombre_obra requerido." });
  if (!programa?.trim())
    return res.status(400).json({ success: false, message: "programa requerido." });
  if (!dg?.trim())
    return res.status(400).json({ success: false, message: "dg requerido." });
  if (!seguimiento?.trim())
    return res.status(400).json({ success: false, message: "seguimiento requerido." });
  if (!alcaldia?.trim())
    return res.status(400).json({ success: false, message: "alcaldia requerida." });
  if (!geom_wkt?.trim())
    return res.status(400).json({ success: false, message: "Geometría requerida." });

  const TABLA_MAP = { PUNTO: "obras_puntos", LINEA: "obras_lineas", POLIGONO: "obras_poligonos" };
  const tabla    = TABLA_MAP[tipo_geometria];
  const isHex    = esEwkbHex((geom_wkt || "").trim());
  /* Dos expresiones: $1 para la query de validación, $22 para el INSERT */
  const gExprVal = isHex ? "$1::geometry"  : "ST_GeomFromText($1, 4326)";
  const gExprIns = isHex ? "$22::geometry" : "ST_GeomFromText($22, 4326)";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setSessionVars(client, usuario);

    /* Verificar unicidad */
    const existe = await client.query(
      `SELECT 1 FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`,
      [clave_unica.trim()]
    );
    if (existe.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `La clave_unica "${clave_unica}" ya existe en el sistema.`,
      });
    }

    /* Validar geometría (acepta WKT y EWKB hex de QGIS) */
    const validGeom = await client.query(
      `SELECT ST_IsValid(${gExprVal}) AS valida`, [geom_wkt.trim()]
    );
    if (!validGeom.rows[0].valida) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "La geometría no es válida (ST_IsValid = false)." });
    }

    /* INSERT con todos los campos disponibles */
    await client.query(`
      INSERT INTO "${SCHEMA}".${tabla} (
        "IDENTIFICADOR",
        clave_unica, "NOMBRE_OBRA", "PROGRAMA", "CLAVE_PROGRAMA",
        "DG", "SEGUIMIENTO", "ALCALDIA",
        "CLAVE_EJE", "NOMBRE_EJE", "BLOQUE_MUNDIAL",
        "YEAR", "COLONIA", "CALLE/DOMICILIO", "URL DE GOOGLE MAPS", "OBSERVACIONES",
        "TIPO", "MODALIDAD", "RESPONSABLE_DG", "MONTO", "ESTATUS",
        geom,
        "AVANCE REAL", "FECHA ACTUALIZACION", "USUARIO ACTUALIZACION",
        estatus_registro, creado_por, fecha_creacion
      ) VALUES (
        $1,
        $2,  $3,  $4,  $5,
        $6,  $7,  $8,
        $9,  $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        ${gExprIns},
        0, NOW(), $23,
        'ACTIVO', $23, NOW()
      )
    `, [
      (identificador || clave_unica).trim(), /* $1  IDENTIFICADOR (NOT NULL) */
      clave_unica.trim(),         /* $2  */
      nombre_obra.trim(),         /* $3  */
      programa.trim(),            /* $4  */
      clave_programa   || null,   /* $5  */
      dg.trim(),                  /* $6  */
      seguimiento.trim(),         /* $7  */
      alcaldia.trim(),            /* $8  */
      clave_eje        || null,   /* $9  */
      nombre_eje       || null,   /* $10 */
      bloque_mundial ? parseInt(bloque_mundial, 10) : null, /* $11 */
      anio ? parseInt(anio, 10)  : null,   /* $12 YEAR */
      colonia          || null,   /* $13 */
      calle_domicilio  || null,   /* $14 */
      url_google_maps  || null,   /* $15 */
      observaciones    || null,   /* $16 */
      tipo             || null,   /* $17 */
      modalidad        || null,   /* $18 */
      responsable_dg   || null,   /* $19 */
      monto            || null,   /* $20 */
      estatus          || "SIN INICIAR", /* $21 */
      geom_wkt.trim(),            /* $22 (geom) */
      usuario,                    /* $23 USUARIO ACTUALIZACION + creado_por */
    ]);

    /* INSERT en catalogo_obras */
    await client.query(`
      INSERT INTO "${SCHEMA}".catalogo_obras
        (clave_unica, tipo_geometria, tabla_actual, estatus_registro, creado_por, fecha_creacion)
      VALUES ($1, $2, $3, 'ACTIVO', $4, NOW())
    `, [clave_unica.trim(), tipo_geometria, tabla, usuario]);

    await client.query("COMMIT");
    res.json({
      success: true,
      message: `Obra "${clave_unica}" creada exitosamente en ${tabla}.`,
      data: { clave_unica: clave_unica.trim(), tabla, tipo_geometria },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   PUT /api/geoestadistica/obras/:clave/atributos
   Modificar atributos no geométricos.
════════════════════════════════════════════════ */
exports.modificarAtributos = async (req, res) => {
  const { clave } = req.params;
  const {
    nombre_obra, identificador, programa, dg, seguimiento, alcaldia, colonia,
    calle_domicilio, url_google_maps, observaciones,
    tipo, modalidad, responsable_dg, estatus,
    monto, anio, clave_eje, nombre_eje, bloque_mundial, clave_programa,
    avance_real, fecha_inauguracion, motivo_cancelacion,
    superficie_m2, material,
    origen_compromiso, origen_recurso, fondo_recurso, capitulo_recurso,
    long_km, geom_wkt,
    motivo,   /* obligatorio */
  } = req.body;
  const usuario = req.user?.email || req.user?.usuario || "sistema";

  if (!motivo?.trim())
    return res.status(400).json({ success: false, message: "El campo motivo es obligatorio." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Variables de sesión para trigger (incluye motivo) */
    await client.query(`SELECT set_config('application.geo_usuario', $1, true)`, [usuario]);
    await client.query(`SELECT set_config('application.origen', 'SICOPS', true)`);
    await client.query(`SELECT set_config('application.motivo', $1, true)`, [motivo.trim()]);

    const cat = await client.query(
      `SELECT tabla_actual FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`, [clave]
    );
    if (!cat.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }
    const { tabla_actual } = cat.rows[0];

    /* SET dinámico — columnas confirmadas en las tres tablas */
    const sets = [];
    const vals = [];
    let pi = 1;

    const addField = (col, val) => {
      if (val !== undefined && val !== null) {
        sets.push(`"${col}" = $${pi++}`);
        vals.push(typeof val === "string" ? val.trim() : val);
      }
    };

    addField("NOMBRE_OBRA",        nombre_obra);
    addField("IDENTIFICADOR",      identificador  || null);
    addField("PROGRAMA",           programa);
    addField("DG",                 dg);
    addField("SEGUIMIENTO",        seguimiento);
    addField("ALCALDIA",           alcaldia);
    addField("COLONIA",            colonia);
    addField("CALLE/DOMICILIO",    calle_domicilio);
    addField("URL DE GOOGLE MAPS", url_google_maps);
    addField("OBSERVACIONES",      observaciones);
    addField("TIPO",               tipo);
    addField("MODALIDAD",          modalidad);
    addField("RESPONSABLE_DG",     responsable_dg);
    addField("ESTATUS",            estatus);
    addField("CLAVE_EJE",          clave_eje          || null);
    addField("NOMBRE_EJE",         nombre_eje         || null);
    addField("CLAVE_PROGRAMA",     clave_programa     || null);
    if (bloque_mundial !== undefined && bloque_mundial !== null && bloque_mundial !== "") {
      const bm = parseInt(bloque_mundial, 10);
      if (!isNaN(bm)) addField("BLOQUE_MUNDIAL", bm);
    }
    if (monto !== undefined && monto !== null && monto !== "") {
      const m = parseFloat(monto);
      if (!isNaN(m)) addField("MONTO", m);
    }
    if (anio !== undefined && anio !== null && anio !== "") {
      const y = parseInt(anio, 10);
      if (!isNaN(y)) addField("YEAR", y);
    }
    addField("AVANCE REAL",           avance_real          || null);
    addField("FECHA INAUGURACION",    fecha_inauguracion   || null);
    addField("MOTIVO CANCELACION",    motivo_cancelacion   || null);
    addField("SUPERFICIE_M2",         superficie_m2        || null);
    addField("MATERIAL",              material             || null);
    addField("ORIGEN DEL COMPROMISO", origen_compromiso    || null);
    addField("ORIGEN DEL RECURSO",    origen_recurso       || null);
    addField("FONDO DEL RECURSO",     fondo_recurso        || null);
    addField("CAPITULO DEL RECURSO",  capitulo_recurso     || null);
    if (long_km !== undefined && long_km !== null && long_km !== "") {
      const lk = parseFloat(long_km);
      if (!isNaN(lk)) addField("Long (km)", lk);
    }
    /* geom_wkt — usar ST_GeomFromText en lugar de asignación directa */
    if (geom_wkt !== undefined && geom_wkt !== null && geom_wkt.trim()) {
      sets.push(`geom = ST_GeomFromText($${pi++}, 4326)`);
      vals.push(geom_wkt.trim());
    }

    if (!sets.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "No hay campos para modificar." });
    }

    vals.push(clave);
    await client.query(
      `UPDATE "${SCHEMA}".${tabla_actual} SET ${sets.join(", ")} WHERE BTRIM(clave_unica::TEXT) = $${pi}`,
      vals
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Atributos actualizados correctamente." });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   PUT /api/geoestadistica/obras/:clave/baja
   Baja lógica con motivo.
════════════════════════════════════════════════ */
exports.bajaLogica = async (req, res) => {
  const { clave }  = req.params;
  const { motivo_baja, observaciones_baja } = req.body;
  const usuario = req.user?.email || req.user?.usuario || "sistema";

  if (!motivo_baja || !MOTIVOS_BAJA.includes(motivo_baja))
    return res.status(400).json({
      success: false,
      message: `motivo_baja inválido. Valores permitidos: ${MOTIVOS_BAJA.join(", ")}`,
    });
  if (motivo_baja === "OTRO" && !observaciones_baja?.trim())
    return res.status(400).json({ success: false, message: "observaciones_baja requerida cuando motivo = OTRO." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setSessionVars(client, usuario);

    const cat = await client.query(
      `SELECT tabla_actual, estatus_registro FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`,
      [clave]
    );
    if (!cat.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }
    if (cat.rows[0].estatus_registro === "INACTIVO") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "La obra ya está dada de baja." });
    }
    const { tabla_actual } = cat.rows[0];

    await client.query(`
      UPDATE "${SCHEMA}".${tabla_actual}
      SET estatus_registro   = 'INACTIVO',
          motivo_baja        = $1,
          observaciones_baja = $2,
          fecha_baja         = NOW(),
          usuario_baja       = $3
      WHERE BTRIM(clave_unica::TEXT) = $4
    `, [motivo_baja, observaciones_baja || null, usuario, clave]);

    await client.query(`
      UPDATE "${SCHEMA}".catalogo_obras
      SET estatus_registro = 'INACTIVO', actualizado_por = $1, fecha_actualizacion = NOW()
      WHERE clave_unica = $2
    `, [usuario, clave]);

    await client.query("COMMIT");
    res.json({ success: true, message: `Obra "${clave}" dada de baja lógicamente.` });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   PUT /api/geoestadistica/obras/:clave/reactivar
   Revertir una baja lógica.
════════════════════════════════════════════════ */
exports.reactivarObra = async (req, res) => {
  const { clave }  = req.params;
  const { motivo } = req.body;
  const usuario    = req.user?.email || req.user?.usuario || "sistema";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setSessionVars(client, usuario);

    const cat = await client.query(
      `SELECT tabla_actual, estatus_registro FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`,
      [clave]
    );
    if (!cat.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }
    if (cat.rows[0].estatus_registro === "ACTIVO") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "La obra ya está activa." });
    }
    const { tabla_actual } = cat.rows[0];

    await client.query(`
      UPDATE "${SCHEMA}".${tabla_actual}
      SET estatus_registro   = 'ACTIVO',
          motivo_baja        = NULL,
          observaciones_baja = NULL,
          fecha_baja         = NULL,
          usuario_baja       = NULL
      WHERE BTRIM(clave_unica::TEXT) = $1
    `, [clave]);

    await client.query(`
      UPDATE "${SCHEMA}".catalogo_obras
      SET estatus_registro = 'ACTIVO', actualizado_por = $1, fecha_actualizacion = NOW()
      WHERE clave_unica = $2
    `, [usuario, clave]);

    await client.query("COMMIT");
    res.json({ success: true, message: `Obra "${clave}" reactivada exitosamente.` });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   PUT /api/geoestadistica/obras/:clave/corregir-clave
   CASCADE UPDATE de clave_unica en todas las tablas relacionadas.
   Requiere confirmación previa (verificarDependencias).
════════════════════════════════════════════════ */
exports.corregirClaveUnica = async (req, res) => {
  const { clave }                    = req.params;
  const { nueva_clave, motivo, confirmado } = req.body;
  const usuario = req.user?.email || req.user?.usuario || "sistema";

  if (!nueva_clave?.trim())
    return res.status(400).json({ success: false, message: "nueva_clave requerida." });
  if (!confirmado)
    return res.status(400).json({ success: false, message: "Se requiere confirmación explícita." });
  if (!motivo?.trim())
    return res.status(400).json({ success: false, message: "motivo requerido." });
  if (nueva_clave.trim() === clave)
    return res.status(400).json({ success: false, message: "La nueva clave es idéntica a la actual." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setSessionVars(client, usuario);

    /* Verificar que la nueva clave no exista */
    const yaExiste = await client.query(
      `SELECT 1 FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`,
      [nueva_clave.trim()]
    );
    if (yaExiste.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `La clave "${nueva_clave}" ya existe en el sistema.`,
      });
    }

    /* Buscar tabla actual */
    const cat = await client.query(
      `SELECT tabla_actual FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1`,
      [clave]
    );
    if (!cat.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }
    const { tabla_actual } = cat.rows[0];

    const nv = nueva_clave.trim();

    /* Actualizar todas las tablas en cascada */
    await client.query(`UPDATE "${SCHEMA}".${tabla_actual}                SET clave_unica = $1 WHERE BTRIM(clave_unica::TEXT) = $2`, [nv, clave]);
    await client.query(`UPDATE "${SCHEMA}".catalogo_obras                  SET clave_unica = $1, actualizado_por = $3, fecha_actualizacion = NOW() WHERE clave_unica = $2`, [nv, clave, usuario]);
    await client.query(`UPDATE "${SCHEMA}".alcances_obras                  SET clave_unica = $1 WHERE BTRIM(clave_unica::TEXT) = $2`, [nv, clave]);
    await client.query(`UPDATE "${SCHEMA}".alcances_obras_tipo             SET clave_unica = $1 WHERE BTRIM(clave_unica::TEXT) = $2`, [nv, clave]);
    await client.query(`UPDATE "${SCHEMA}".informacion_general_obras       SET clave_unica = $1 WHERE BTRIM(clave_unica::TEXT) = $2`, [nv, clave]);
    await client.query(`UPDATE "${SCHEMA}".frentes_obra                    SET clave_unica = $1 WHERE BTRIM(clave_unica::TEXT) = $2`, [nv, clave]);

    /* Auditoría manual de la corrección */
    await registrarAuditoria(client, {
      tabla:        tabla_actual,
      operacion:    "CORRECCION_CLAVE_UNICA",
      clave_unica:  nv,
      usuario,
      motivo:       `Clave anterior: ${clave}. Motivo: ${motivo}`,
      valores_antes:  { clave_unica: clave },
      valores_despues:{ clave_unica: nv },
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      message: `Clave única actualizada de "${clave}" a "${nv}" en cascada.`,
      clave_anterior: clave,
      clave_nueva:    nv,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/catalogo
   Listado del catalogo_obras con filtros.
════════════════════════════════════════════════ */
exports.getCatalogo = async (req, res) => {
  const { estatus, tipo_geometria, q, limit = 200, offset = 0 } = req.query;
  const filtros = [];
  const params  = [];
  let pi = 1;

  if (estatus)        { filtros.push(`estatus_registro = $${pi++}`);  params.push(estatus); }
  if (tipo_geometria) { filtros.push(`tipo_geometria   = $${pi++}`);  params.push(tipo_geometria); }
  if (q) {
    filtros.push(`clave_unica ILIKE $${pi++}`);
    params.push(`%${q}%`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  try {
    const total = await query(
      `SELECT COUNT(*) AS n FROM "${SCHEMA}".catalogo_obras ${where}`, params
    );
    const rows = await query(
      `SELECT * FROM "${SCHEMA}".catalogo_obras ${where}
       ORDER BY clave_unica LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );
    res.json({ success: true, total: parseInt(total.rows[0].n, 10), data: rows.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/auditoria
   Consultar obras_auditoria con filtros.
════════════════════════════════════════════════ */
exports.getAuditoria = async (req, res) => {
  const { clave_unica, operacion, usuario, origen, desde, hasta, limit = 100, offset = 0 } = req.query;
  const filtros = [];
  const params  = [];
  let pi = 1;

  if (clave_unica) { filtros.push(`clave_unica = $${pi++}`);    params.push(clave_unica); }
  if (operacion)   { filtros.push(`operacion   = $${pi++}`);    params.push(operacion); }
  if (usuario)     { filtros.push(`usuario ILIKE $${pi++}`);    params.push(`%${usuario}%`); }
  if (origen)      { filtros.push(`origen = $${pi++}`);         params.push(origen); }
  if (desde)       { filtros.push(`fecha >= $${pi++}`);         params.push(desde); }
  if (hasta)       { filtros.push(`fecha <= $${pi++}`);         params.push(hasta); }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  try {
    const total = await query(
      `SELECT COUNT(*) AS n FROM "${SCHEMA}".obras_auditoria ${where}`, params
    );
    const rows = await query(
      `SELECT id, tabla, operacion, clave_unica, usuario, fecha, origen,
              motivo, solicitud_id, valores_antes, valores_despues
       FROM "${SCHEMA}".obras_auditoria ${where}
       ORDER BY fecha DESC LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );
    res.json({ success: true, total: parseInt(total.rows[0].n, 10), data: rows.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/geoestadistica/motivos-baja
   Devuelve el catálogo de motivos válidos.
════════════════════════════════════════════════ */
exports.getMotivosBaja = async (_req, res) => {
  res.json({ success: true, data: MOTIVOS_BAJA });
};

/* Exportar helper para uso en importacionCtrl (CSV masivo) */
exports.generarClaveUnica = generarClaveUnica;
