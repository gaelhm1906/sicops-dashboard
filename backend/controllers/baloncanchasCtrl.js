/**
 * controllers/baloncanchasCtrl.js
 * Endpoint público — GeoJSON para StoryMap "El Balón Vuelve al Barrio".
 * SIN autenticación. CORS abierto (*).
 *
 * Detecta nombres reales de columna (GIS los importa en mayúsculas con espacios).
 * Devuelve propiedades sin requerir geom IS NOT NULL porque el StoryMap
 * usa la geometría de latest.geojson y solo necesita los campos dinámicos.
 */
const { query, columnasDe, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

const PROGRAMA = "EL BALON VUELVE AL BARRIO";

const ALIASES = {
  identificador: [
    "IDENTIFICADOR", "identificador",
  ],
  nombre: [
    "NOMBRE_OBRA", "nombre_obra",
    "NOMBRE DEL SITIO INTERVENIDO", "nombre del sitio intervenido",
    "NOMBRE", "nombre",
  ],
  avance: [
    "AVANCE REAL",   // columna real en esta tabla (con espacio)
    "AVANCE_REAL", "avance_real",
    "AVANCE", "avance",
    "PORCENTAJE", "porcentaje",
  ],
  estatus: [
    "ESTATUS", "estatus",
    "STATUS", "status",
    "ESTADO", "estado",
  ],
  monto: [
    "MONTO", "monto",
    "COSTO CONTRATO", "costo contrato",
    "COSTO", "costo",
  ],
  programa: [
    "PROGRAMA", "programa",
    "PROGRAMA_OBRA", "programa_obra",
  ],
};

let _colCache = null;

function findCol(columnas, aliases) {
  for (const alias of aliases) {
    const col = columnas.find((c) => c.column_name === alias);
    if (col) return col.column_name;
  }
  for (const alias of aliases) {
    const col = columnas.find(
      (c) => c.column_name.toLowerCase() === alias.toLowerCase()
    );
    if (col) return col.column_name;
  }
  return null;
}

function qid(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function detectarColumnas() {
  if (_colCache) return _colCache;
  const columnas = await columnasDe("obras_puntos");
  const geomCol =
    columnas.find((c) => ["geometry", "geography"].includes(c.udt_name))
      ?.column_name || null;
  _colCache = {
    identificador: findCol(columnas, ALIASES.identificador),
    nombre:        findCol(columnas, ALIASES.nombre),
    avance:        findCol(columnas, ALIASES.avance),
    estatus:       findCol(columnas, ALIASES.estatus),
    monto:         findCol(columnas, ALIASES.monto),
    programa:      findCol(columnas, ALIASES.programa),
    geom:          geomCol,
  };
  logger.info("public-balon", `columnas detectadas: ${JSON.stringify(_colCache)}`);
  return _colCache;
}

exports.getGeoJSON = async (_req, res) => {
  try {
    const cols = await detectarColumnas();

    const safeAvance = cols.avance
      ? `COALESCE(CASE WHEN ${qid(cols.avance)}::text ~ '^[0-9]+(\\.[0-9]+)?$'
                      THEN ${qid(cols.avance)}::text::numeric
                      ELSE NULL END, 0)`
      : "0";

    const safeMonto = cols.monto
      ? `COALESCE(${qid(cols.monto)}, 0)`
      : "0";

    // Geometría opcional — el StoryMap la ignora y usa latest.geojson
    const geomExpr = cols.geom
      ? `CASE WHEN ${qid(cols.geom)} IS NOT NULL
              THEN ST_AsGeoJSON(${qid(cols.geom)})::json
              ELSE NULL END`
      : "NULL";

    const selectParts = [
      cols.identificador
        ? `${qid(cols.identificador)} AS "NO. DE CANCHA. OFICIAL"`
        : `NULL::text AS "NO. DE CANCHA. OFICIAL"`,
      cols.nombre
        ? `${qid(cols.nombre)} AS "UBICACION / NOMBRE"`
        : `NULL::text AS "UBICACION / NOMBRE"`,
      `${safeAvance} AS "PORCENTAJE DE OBRA"`,
      cols.estatus
        ? `COALESCE(${qid(cols.estatus)}, '') AS "ESTATUS"`
        : `'' AS "ESTATUS"`,
      `${safeMonto} AS "MONTO"`,
      `${geomExpr} AS _geom`,
    ];

    const whereClause = cols.programa
      ? `UPPER(TRIM(${qid(cols.programa)})) = UPPER(TRIM($1))`
      : "TRUE";

    const sql = `
      SELECT
        ${selectParts.join(",\n        ")}
      FROM "${SCHEMA}".obras_puntos
      WHERE ${whereClause}
    `;

    const result = await query(sql, cols.programa ? [PROGRAMA] : []);

    const features = result.rows.map((row) => {
      const { _geom, ...props } = row;
      return { type: "Feature", geometry: _geom || null, properties: props };
    });

    logger.info("public-balon", `devolviendo ${features.length} features`);

    res.setHeader("Cache-Control", "no-store, no-cache");
    res.json({
      type: "FeatureCollection",
      features,
      total: features.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    _colCache = null;
    logger.error("public-balon", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
