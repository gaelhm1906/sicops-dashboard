/**
 * controllers/pgController.js
 * Endpoints que leen datos reales desde PostgreSQL / PostGIS (schema sig_sobse).
 *
 * Estrategia de descubrimiento dinamico:
 *   1. Lista todas las tablas del schema.
 *   2. Por cada tabla, detecta que columnas existen.
 *   3. Mapea los campos encontrados a un esquema unificado.
 *   4. Devuelve un array homogeneo para el frontend.
 */

const { query, listarTablas, columnasDe, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

const ALIAS = {
  id: [
    "id",
    "gid",
    "objectid",
    "fid",
    "ogc_fid",
  ],
  nombre: [
    "nombre",
    "name",
    "nombre_obra",
    "desc_proyecto",
    "descripcion",
    "nom_proyecto",
    "proyecto",
    "nombre_proyecto",
    "nom_obra",
    "titulo",
    "nombre del sitio intervenido",
  ],
  avance: [
    "avance",
    "porcentaje",
    "porcentaje_avance",
    "pct_avance",
    "avance_fisico",
    "avance_obra",
    "avance_pct",
    "pct",
    "percent",
    "porcentaje_fisico",
    "avance_real",
    "avance real",
  ],
  estado: [
    "estado",
    "status",
    "estatus",
    "estado_obra",
    "estatus_obra",
    "estado_proyecto",
    "situacion",
  ],
  fecha: [
    "fecha_actualizacion",
    "fecha_mod",
    "fecha_modificacion",
    "updated_at",
    "fecha",
    "fecha_registro",
    "fecha_captura",
    "fecha_ultima_actualizacion",
  ],
  programa: [
    "programa",
  ],
  direccion_general: [
    "direccion_general",
    "direccion general",
  ],
  origen: [
    "origen_del_compromiso",
    "origen del compromiso",
    "origen",
  ],
  geom: [
    "geom",
    "geometry",
    "the_geom",
    "wkb_geometry",
    "shape",
    "geom_point",
    "geom_poly",
    "geom_line",
    "geom_multipolygon",
  ],
};

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function qlit(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalize(str) {
  return String(str).toLowerCase().replace(/\s+/g, "").trim();
}

function detectarColumna(columnas, aliases = [], includes = []) {
  const normalizadas = columnas.map((col) => ({
    original: col.column_name,
    lower: normalize(col.column_name),
  }));

  for (const alias of aliases) {
    const aliasLower = normalize(alias);
    const exacta = normalizadas.find((col) => col.lower === aliasLower);
    if (exacta) return exacta.original;
  }

  for (const pattern of includes) {
    const patternLower = normalize(pattern);
    const parcial = normalizadas.find((col) => col.lower.includes(patternLower));
    if (parcial) return parcial.original;
  }

  return null;
}

function construirExpresionAvance(columna) {
  if (!columna) return "NULL::numeric";

  const ref = `${qid(columna)}::text`;
  return `CASE
            WHEN ${ref} ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN ${qid(columna)}::numeric
            ELSE NULL
          END`;
}

function inferirEstado(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return "pendiente";
  const n = Number(pct);
  if (n >= 95) return "actualizada";
  if (n > 0) return "en_progreso";
  return "pendiente";
}

function tablaNombre(tabla) {
  return tabla.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function detectarCamposBase(columnas) {
  return {
    id: detectarColumna(columnas, ALIAS.id),
    nombre: detectarColumna(columnas, ALIAS.nombre, ["nombre"]),
    avance: detectarColumna(columnas, ALIAS.avance, ["avance"]),
    estado: detectarColumna(columnas, ALIAS.estado, ["estatus", "estado"]),
    fecha: detectarColumna(columnas, ALIAS.fecha, ["fecha"]),
    programa: detectarColumna(columnas, ALIAS.programa, ["programa"]),
    direccion_general: detectarColumna(columnas, ALIAS.direccion_general, ["direccion"]),
    origen: detectarColumna(columnas, ALIAS.origen, ["origen"]),
    geom: detectarColumna(columnas, ALIAS.geom),
  };
}

async function listarObras(req, res) {
  const inicio = Date.now();

  try {
    const tablas = await listarTablas();

    if (tablas.length === 0) {
      logger.warn("pg-obras", `Schema ${SCHEMA} no contiene tablas BASE TABLE`);
      return res.json({ success: true, data: [], total: 0, tablas: [], paginas: 1 });
    }

    const { tabla: tablaFiltro, pagina = 1, limite = 10000 } = req.query;
    const tablasAConsultar = tablaFiltro
      ? tablas.filter((tabla) => tabla === tablaFiltro)
      : tablas;

    const todasObras = [];
    const metaTablas = [];

    for (const nombreTabla of tablasAConsultar) {
      try {
        const columnas = await columnasDe(nombreTabla);
        const cols = columnas.map((c) => c.column_name.toLowerCase());
        const campos = detectarCamposBase(columnas);

        const selectPartes = [];

        if (campos.id) {
          selectPartes.push(`${qid(campos.id)} AS id`);
        } else {
          selectPartes.push(`ROW_NUMBER() OVER () AS id`);
        }

        selectPartes.push(
          campos.nombre
            ? `COALESCE(${qid(campos.nombre)}::text, 'SIN DATO') AS nombre`
            : `'SIN DATO' AS nombre`
        );
        selectPartes.push(
          campos.avance
            ? `COALESCE(${qid(campos.avance)}::text, 'SIN DATO') AS avance`
            : `'SIN DATO' AS avance`
        );
        selectPartes.push(
          campos.estado
            ? `COALESCE(${qid(campos.estado)}::text, 'SIN DATO') AS estatus`
            : `'SIN DATO' AS estatus`
        );
        selectPartes.push(
          campos.programa
            ? `COALESCE(${qid(campos.programa)}::text, 'SIN DATO') AS programa`
            : `${qlit(tablaNombre(nombreTabla))} AS programa`
        );
        selectPartes.push(
          campos.direccion_general
            ? `COALESCE(${qid(campos.direccion_general)}::text, 'SIN DATO') AS direccion_general`
            : `'SIN DATO' AS direccion_general`
        );
        selectPartes.push(
          campos.origen
            ? `COALESCE(${qid(campos.origen)}::text, 'SIN DATO') AS origen`
            : `'No definido' AS origen`
        );
        if (campos.fecha) {
          selectPartes.push(`COALESCE(${qid(campos.fecha)}::text, NULL) AS fecha_actualizacion`);
        } else {
          selectPartes.push(`NULL AS fecha_actualizacion`);
        }
        selectPartes.push(`${qlit(nombreTabla)} AS tabla`);

        const sql = `
          SELECT
            ${selectPartes.join(",\n            ")}
          FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
          LIMIT 10000
        `;

        const result = await query(sql);

        for (const row of result.rows) {
          const pct = row.avance && /^(\d+|\d+\.\d+)$/.test(String(row.avance).trim())
            ? Number(row.avance)
            : null;
          todasObras.push({
            id: row.id,
            nombre: row.nombre || `Registro #${row.id}`,
            avance: pct ?? 0,
            porcentaje_avance: pct ?? 0,
            estatus: row.estatus && row.estatus !== "SIN DATO" ? row.estatus : inferirEstado(pct),
            estado: row.estatus && row.estatus !== "SIN DATO" ? row.estatus : inferirEstado(pct),
            programa: row.programa || tablaNombre(nombreTabla),
            direccion_general: row.direccion_general || "SIN DATO",
            origen: row.origen || "No definido",
            tabla: row.tabla || nombreTabla,
            fecha_actualizacion: row.fecha_actualizacion || null,
            confirmado_por: null,
            usuario_responsable: null,
            tiene_geom: !!campos.geom,
          });
        }

        metaTablas.push({
          tabla: nombreTabla,
          registros: result.rows.length,
          campos: columnas.length,
          con_geom: !!campos.geom,
          columnas_detectadas: cols.slice(0, 12),
          campos_map: campos,
        });

        logger.debug("pg-obras", `${nombreTabla}: ${result.rows.length} registros`);
      } catch (tableErr) {
        logger.warn("pg-obras", `Error leyendo tabla ${nombreTabla}: ${tableErr.message}`);
        metaTablas.push({ tabla: nombreTabla, error: tableErr.message });
      }
    }

    const pag = Math.max(1, parseInt(pagina, 10));
    const lim = Math.max(1, Math.min(10000, parseInt(limite, 10)));
    const total = todasObras.length;
    const data = todasObras.slice((pag - 1) * lim, pag * lim);
    const ms = Date.now() - inicio;

    logger.info("pg-obras", `${total} obras de ${tablasAConsultar.length} tabla(s) en ${ms}ms`);

    res.json({
      success: true,
      data,
      total,
      pagina: pag,
      paginas: Math.max(1, Math.ceil(total / lim)),
      limite: lim,
      tablas: metaTablas,
      ms,
    });
  } catch (err) {
    logger.error("pg-obras", `Error fatal: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Error al consultar obras desde PostgreSQL",
      detail: err.message,
    });
  }
}

async function dashboard(req, res) {
  try {
    const tablas = await listarTablas();

    let totalGlobal = 0;
    let sumAvance = 0;
    let actualizadas = 0;
    let enProgreso = 0;
    let pendientes = 0;
    const detallePorTabla = [];

    for (const nombreTabla of tablas) {
      try {
        const columnas = await columnasDe(nombreTabla);
        const campos = detectarCamposBase(columnas);

        if (!campos.avance) {
          logger.warn("pg-dashboard", `Tabla ${nombreTabla}: sin columna de avance, se omite del promedio`);
          continue;
        }

        const avanceExpr = construirExpresionAvance(campos.avance);

        const r = await query(`
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE ${avanceExpr} >= 95) AS actualizadas,
            COUNT(*) FILTER (WHERE ${avanceExpr} > 0 AND ${avanceExpr} < 95) AS en_progreso,
            COUNT(*) FILTER (WHERE ${avanceExpr} = 0 OR ${avanceExpr} IS NULL) AS pendientes,
            COALESCE(AVG(${avanceExpr}), 0) AS promedio
          FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
        `);

        const row = r.rows[0];
        const tTotal = parseInt(row.total, 10);
        const tActual = parseInt(row.actualizadas, 10);
        const tProg = parseInt(row.en_progreso, 10);
        const tPend = parseInt(row.pendientes, 10);
        const tProm = Math.round(parseFloat(row.promedio) || 0);

        totalGlobal += tTotal;
        actualizadas += tActual;
        enProgreso += tProg;
        pendientes += tPend;
        sumAvance += tProm * tTotal;

        detallePorTabla.push({
          tabla: nombreTabla,
          programa: tablaNombre(nombreTabla),
          total: tTotal,
          actualizadas: tActual,
          en_progreso: tProg,
          pendientes: tPend,
          promedio: tProm,
        });
      } catch (tableErr) {
        logger.warn("pg-dashboard", `Skip tabla ${nombreTabla}: ${tableErr.message}`);
      }
    }

    const porcentaje_avance = totalGlobal > 0
      ? Math.round(sumAvance / totalGlobal)
      : 0;

    logger.info("pg-dashboard", `Dashboard: ${totalGlobal} obras, ${actualizadas} act., ${porcentaje_avance}% prom.`);

    res.json({
      success: true,
      data: {
        total: totalGlobal,
        actualizadas,
        en_progreso: enProgreso,
        pendientes,
        porcentaje_avance,
        por_programa: detallePorTabla,
      },
    });
  } catch (err) {
    logger.error("pg-dashboard", `Error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Error al calcular estadisticas",
      detail: err.message,
    });
  }
}

async function geo(req, res) {
  try {
    const { tabla: tablaFiltro, limite = 500 } = req.query;
    const lim = Math.max(1, Math.min(2000, parseInt(limite, 10)));

    const tablas = tablaFiltro ? [tablaFiltro] : await listarTablas();
    const features = [];

    for (const nombreTabla of tablas) {
      try {
        const columnas = await columnasDe(nombreTabla);
        const campos = detectarCamposBase(columnas);

        if (!campos.geom) continue;

        const propPartes = [];
        if (campos.id) propPartes.push(`${qid(campos.id)} AS id`);
        if (campos.nombre) propPartes.push(`${qid(campos.nombre)}::text AS nombre`);
        if (campos.avance) propPartes.push(`${construirExpresionAvance(campos.avance)} AS avance`);
        if (campos.estado) propPartes.push(`${qid(campos.estado)}::text AS estado`);
        propPartes.push(`${qlit(nombreTabla)} AS tabla`);

        const sql = `
          SELECT
            ST_AsGeoJSON(${qid(campos.geom)})::json AS geom_json,
            ${propPartes.join(",\n            ")}
          FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
          WHERE ${qid(campos.geom)} IS NOT NULL
          LIMIT ${lim}
        `;

        const result = await query(sql);

        for (const row of result.rows) {
          if (!row.geom_json) continue;

          features.push({
            type: "Feature",
            geometry: row.geom_json,
            properties: {
              id: row.id || null,
              nombre: row.nombre || null,
              avance: row.avance !== undefined && row.avance !== null ? Number(row.avance) : null,
              estado: row.estado || null,
              tabla: row.tabla,
              programa: tablaNombre(nombreTabla),
            },
          });
        }

        logger.debug("pg-geo", `${nombreTabla}: ${result.rows.length} geometrias`);
      } catch (tableErr) {
        logger.warn("pg-geo", `Skip ${nombreTabla}: ${tableErr.message}`);
      }
    }

    logger.info("pg-geo", `GeoJSON: ${features.length} features devueltas`);

    res.json({
      type: "FeatureCollection",
      features,
      total: features.length,
      success: true,
    });
  } catch (err) {
    logger.error("pg-geo", `Error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Error al generar GeoJSON",
      detail: err.message,
    });
  }
}

/**
 * dashboardObras()
 * GET /api/dashboard/obras
 * Unified endpoint para consultar TODAS las obras de todas las tablas del schema sig_sobse.
 * 
 * Lógica:
 *   1. Listar todas las tablas
 *   2. Para cada tabla, intentar consultar "DIRECCION GENERAL" AS dg, "NOMBRE_OBRA" AS nombre, "AVANCE REAL" AS avance
 *   3. Si tiene esas columnas, agregar los registros
 *   4. Clasificar estatus: 0="SIN INICIAR", 1-99="EN PROCESO", 100="ENTREGADA"
 *   5. Devolver array unificado
 */
async function dashboardObras(req, res) {
  const inicio = Date.now();

  try {
    const tablas = await listarTablas();

    if (tablas.length === 0) {
      logger.warn("pg-dashboard", `Schema ${SCHEMA} no contiene tablas`);
      return res.json({
        success: true,
        total: 0,
        data: [],
        ms: Date.now() - inicio,
      });
    }

    const todasLasObras = [];
    let tablasConsultadas = 0;
    let tablasIgnoradas = 0;

    for (const nombreTabla of tablas) {
      try {
        const columnas = await columnasDe(nombreTabla);
        const colsNombres = columnas.map((c) => c.column_name);
        
        // Buscar las columnas exactas (case-insensitive)
        const dgCol = colsNombres.find(
          (col) => col.toLowerCase() === "direccion general" || col.toLowerCase() === "direccion_general"
        );
        const nombreCol = colsNombres.find(
          (col) => col.toLowerCase() === "nombre_obra" || col.toLowerCase() === "nombre de obra"
        );
        const avanceCol = colsNombres.find(
          (col) => col.toLowerCase() === "avance real" || col.toLowerCase() === "avance_real"
        );

        // Si no tiene las 3 columnas requeridas, saltar esta tabla
        if (!dgCol || !nombreCol || !avanceCol) {
          tablasIgnoradas++;
          logger.debug(
            "pg-dashboard",
            `Tabla ${nombreTabla} ignorada: falta columnas (dg=${!!dgCol}, nombre=${!!nombreCol}, avance=${!!avanceCol})`
          );
          continue;
        }

        // Consultar la tabla
        const sql = `
          SELECT
            ${qid(dgCol)} AS dg,
            ${qid(nombreCol)} AS nombre,
            ${qid(avanceCol)}::numeric AS avance
          FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
          WHERE ${qid(avanceCol)} IS NOT NULL
          LIMIT 10000
        `;

        const result = await query(sql);

        for (const row of result.rows) {
          const avance = Number(row.avance) || 0;
          let estatus = "SIN INICIAR";
          
          if (avance === 100) {
            estatus = "ENTREGADA";
          } else if (avance > 0 && avance < 100) {
            estatus = "EN PROCESO";
          }

          todasLasObras.push({
            dg: row.dg || "SIN DATO",
            nombre: row.nombre || "SIN DATO",
            avance: Math.round(avance * 100) / 100, // 2 decimales
            estatus: estatus,
            tabla: nombreTabla,
          });
        }

        tablasConsultadas++;
        logger.debug("pg-dashboard", `${nombreTabla}: ${result.rows.length} registros`);
      } catch (tableErr) {
        logger.warn("pg-dashboard", `Error consultando ${nombreTabla}: ${tableErr.message}`);
        tablasIgnoradas++;
      }
    }

    const ms = Date.now() - inicio;
    logger.info(
      "pg-dashboard",
      `Dashboard: ${todasLasObras.length} obras de ${tablasConsultadas} tabla(s) en ${ms}ms`
    );

    res.json({
      success: true,
      total: todasLasObras.length,
      data: todasLasObras,
      tablas_consultadas: tablasConsultadas,
      tablas_ignoradas: tablasIgnoradas,
      ms,
    });
  } catch (err) {
    logger.error("pg-dashboard", `Error fatal: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Error al consultar obras desde PostgreSQL",
      detail: err.message,
    });
  }
}

module.exports = { listarObras, dashboard, dashboardObras, geo };
