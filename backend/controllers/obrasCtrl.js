/**
 * controllers/obrasCtrl.js
 * Lee TODAS las tablas del schema sig_sobse excepto obras_centralizadas.
 * Normaliza datos a estructura unificada usando detección dinámica de columnas.
 * Extrae DG y nombre de programa desde el nombre de la tabla cuando las columnas no existen.
 */

const { query, listarTablas, columnasDe, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

const TABLAS_EXCLUIR = new Set([
  "obras_centralizadas",
  "historial_avances",
  "spatial_ref_sys",
  "geometry_columns",
  "geography_columns",
  "raster_columns",
  "raster_overviews",
]);

// Lista explícita de tablas de programas de obras.
// Se usa en lugar de listarTablas() para mayor confiabilidad en producción.
const TABLAS_PROGRAMA = [
  "123 POR MI ESCUELA DGCOP",
  "123 POR MI ESCUELA ILIFE",
  "ALBERGUES",
  "BICIESTACIONAMIENTO DGCOP",
  "BICIESTACIONAMIENTOS DGOIV",
  "CAMINOS SEGUROS",
  "CAPTACION DE AGUA EN MERCADOS",
  "CASA DE LAS 3RS",
  "CETRAM",
  "CICLOVIA",
  "CLINICA CONDESA",
  "COMUNIDAD SEGURA",
  "CONSTRUCCION DE UTOPIAS",
  "ERUM Y DGIT",
  "ILUMINACION DE CALLES DEL CENTRO HISTORICO",
  "ILUMINACION DE EDIFICIOS DEL CENTRO HISTORICO",
  "LINEA DEL CABLEBUS",
  "MANTENIMIENTO A MERCADOS PUBLICOS",
  "MANTENIMIENTO A PUENTES PEATONALES",
  "MANTENIMIENTO A PUENTES VEHICULARES",
  "MANTENIMIENTO DE UTOPIAS",
  "MODERNIZACION DEL TREN LIGERO",
  "MODULOS DE POLICIA",
  "OBRAS ADICIONALES DGCOP",
  "OBRAS ADICIONANLES DGOIV",
  "PARQUE ELEVADO",
  "PARQUES ALEGRIA",
  "PASOS A DESNIVEL DGCOP",
  "PASOS A DESNIVEL DGOT",
  "REPAVIMENTACION DGOIV",
  "REPAVIMENTACION DGOT",
  "TROLEBUS RUTA 14",
  "UNIVERSIDAD DE LAS ARTES",
  "YOLOTL ANAHUAC",
];

const H = "historial_avances";

// Códigos de DG conocidos — se usan para extraer DG del nombre de tabla
const CODIGOS_DG = [
  "DGCOP", "DGOT", "DGOIV", "DGPEST", "DGSUS",
  "ILIFE", "IECM", "FIDERE", "SACMEX", "DGODU",
];

// Aliases para detección flexible de columnas (orden importa: más específico primero)
const ALIAS = {
  id: [
    "ID OBRA", "id obra", "id_obra",
    "id", "ID", "gid", "objectid", "fid", "ogc_fid",
  ],
  nombre: [
    "NOMBRE DEL SITIO INTERVENIDO", "nombre del sitio intervenido",
    "NOMBRE_OBRA", "nombre_obra",
    "NOMBRE DE OBRA", "nombre de obra",
    "NOMBRE", "nombre",
    "obra", "OBRA",
    "proyecto", "PROYECTO",
    "nom_proyecto", "NOM_PROYECTO",
    "desc_proyecto", "titulo",
  ],
  estatus: [
    "ESTATUS", "estatus",
    "STATUS", "status",
    "ESTADO", "estado",
    "estatus_obra", "estado_obra",
    "situacion",
  ],
  avance: [
    "AVANCE REAL", "avance real",
    "AVANCE", "avance",
    "PORCENTAJE", "porcentaje",
    "avance_real", "AVANCE_REAL",
    "pct_avance", "porcentaje_avance",
    "avance_fisico", "avance_obra",
    "avance_pct", "pct",
  ],
  dg: [
    "DIRECCION GENERAL", "direccion general",
    "DIRECCIÓN GENERAL", "dirección general",
    "direccion_general", "DIRECCION_GENERAL",
    "dg", "DG",
  ],
  alcaldia: [
    "ALCALDIA", "alcaldia",
    "ALCALDÍA", "alcaldía",
    "municipio", "MUNICIPIO",
    "demarcacion", "demarcación",
  ],
  fecha: [
    "ULTIMA ACTUALIZACION", "ultima actualizacion",
    "ÚLTIMA ACTUALIZACIÓN", "última actualización",
    "ultima_actualizacion", "ULTIMA_ACTUALIZACION",
    "fecha_actualizacion", "FECHA_ACTUALIZACION",
    "updated_at", "fecha", "fecha_registro",
  ],
  geom: ["geom", "geometry", "the_geom", "wkb_geometry", "shape"],
};

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .trim();
}

function findColumn(columnas, keys) {
  const normalized = columnas.map((col) => ({
    original: col.column_name,
    key: normalizeKey(col.column_name),
  }));
  for (const key of keys) {
    const match = normalized.find((col) => col.key === normalizeKey(key));
    if (match) return match.original;
  }
  return null;
}

// Extrae código DG desde el nombre de la tabla
// "123 POR MI ESCUELA DGCOP" → "DGCOP"
// "REPAVIMENTACION DGOIV" → "DGOIV"
function extraerDGDesdeNombreTabla(tableName) {
  const palabras = tableName.trim().toUpperCase().split(/\s+/);
  // Última palabra primero (patrón más común)
  const ultima = palabras[palabras.length - 1];
  if (CODIGOS_DG.includes(ultima)) return ultima;
  // Buscar en cualquier posición
  for (const codigo of CODIGOS_DG) {
    if (tableName.toUpperCase().includes(codigo)) return codigo;
  }
  return "SIN DIRECCION";
}

// Nombre de programa = tabla sin el sufijo de código DG
// "123 POR MI ESCUELA DGCOP" → "123 POR MI ESCUELA"
// "REPAVIMENTACION DGOIV" → "REPAVIMENTACION"
function limpiarNombrePrograma(tableName) {
  const palabras = tableName.trim().toUpperCase().split(/\s+/);
  const ultima = palabras[palabras.length - 1];
  if (CODIGOS_DG.includes(ultima)) {
    return palabras.slice(0, -1).join(" ").trim() || tableName.toUpperCase().trim();
  }
  return tableName.toUpperCase().trim();
}

// Detecta y mapea columnas útiles de una tabla
async function buildTableMeta(tableName) {
  const columnas = await columnasDe(tableName);
  const campos = Object.fromEntries(
    Object.entries(ALIAS).map(([key, aliases]) => [key, findColumn(columnas, aliases)])
  );
  const selectCols = columnas
    .filter((col) => !["geometry", "geography"].includes(col.udt_name))
    .map((col) => qid(col.column_name));
  return { columnas, campos, selectCols };
}

// Normaliza una fila de cualquier tabla a estructura unificada
function normalizeRow(row, tableName, campos) {
  const avanceRaw = campos.avance ? row[campos.avance] : null;
  const av = (avanceRaw !== null && avanceRaw !== undefined && avanceRaw !== "")
    ? Number(avanceRaw) : null;
  const avance = Number.isNaN(av) ? null : av;

  const estatusRaw = campos.estatus ? row[campos.estatus] : null;
  const est = estatusRaw || estatusPorAvance(avance);

  const dgDB = campos.dg ? row[campos.dg] : null;
  const dgFinal = (dgDB && String(dgDB).trim() && String(dgDB).trim() !== "SIN DATO")
    ? String(dgDB).trim().toUpperCase()
    : extraerDGDesdeNombreTabla(tableName);

  const idRaw = campos.id ? row[campos.id] : null;
  const id = (idRaw !== null && idRaw !== undefined) ? String(idRaw) : null;

  return {
    uid:                 `${tableName}::${id}`,
    id,
    id_obra:             id,
    nombre:              (campos.nombre ? row[campos.nombre] : null) || "SIN DATO",
    direccion_general:   dgFinal,
    programa:            limpiarNombrePrograma(tableName),
    alcaldia:            campos.alcaldia ? row[campos.alcaldia] : null,
    estatus:             est,
    estado:              est,
    avance,
    porcentaje_avance:   avance ?? 0,
    porcentaje:          avance ?? 0,
    fecha_actualizacion: campos.fecha ? row[campos.fecha] : null,
    color:               colorPorEstatus(est, avance),
    tabla:               tableName,
  };
}

function colorPorAvance(avance) {
  if (avance === null || avance === undefined) return "#9e9e9e";
  const n = Number(avance);
  if (isNaN(n)) return "#9e9e9e";
  if (n > 70)  return "#4caf50";
  if (n >= 30) return "#ff9800";
  return "#f44336";
}

function colorPorEstatus(estatus, avance) {
  const estado = String(estatus || "").toUpperCase();
  if (estado === "ENTREGADO") return "#2196f3";
  if (estado === "CANCELADA" || estado === "CANCELADO") return "#6b7280";
  return colorPorAvance(avance);
}

function estatusPorAvance(avance) {
  if (avance === null || avance === undefined) return "SIN INICIAR";
  const n = Number(avance);
  if (n >= 100) return "TERMINADO";
  if (n > 0)   return "EN PROCESO";
  return "SIN INICIAR";
}

// ── GET /api/obras?dg=DGCOP ────────────────────────────────────────

async function getObras(req, res) {
  const { dg } = req.query;
  const inicio = Date.now();
  try {
    // Usar lista explícita; agregar dinámicamente las tablas que no estén en ella
    let tablas = [...TABLAS_PROGRAMA];
    try {
      const dinamicas = await listarTablas();
      for (const t of dinamicas) {
        if (!TABLAS_EXCLUIR.has(t) && !tablas.includes(t)) tablas.push(t);
      }
    } catch {
      // Si information_schema falla, continuar solo con la lista explícita
    }

    if (tablas.length === 0) {
      return res.json({ success: true, total: 0, data: [] });
    }

    const todasObras = [];

    for (const nombreTabla of tablas) {
      try {
        const { campos, selectCols } = await buildTableMeta(nombreTabla);
        if (selectCols.length === 0) continue;

        // Optimización: si DG está en columna y se filtra, usar WHERE en SQL
        let where = "";
        const params = [];
        if (dg && campos.dg) {
          params.push(dg.toUpperCase());
          where = `WHERE UPPER(${qid(campos.dg)}::text) = $1`;
        } else if (dg && !campos.dg) {
          // DG se deriva del nombre de tabla; si no coincide, saltar toda la tabla
          const tablaDG = extraerDGDesdeNombreTabla(nombreTabla);
          if (tablaDG.toUpperCase() !== dg.toUpperCase()) continue;
        }

        const { rows } = await query(
          `SELECT ${selectCols.join(", ")} FROM "${SCHEMA}"."${nombreTabla}" ${where} LIMIT 10000`,
          params
        );

        for (const row of rows) {
          todasObras.push(normalizeRow(row, nombreTabla, campos));
        }

        logger.debug("obras-get", `${nombreTabla}: ${rows.length} registros`);
      } catch (tableErr) {
        logger.warn("obras-get", `Skip tabla ${nombreTabla}: ${tableErr.message}`);
      }
    }

    const ms = Date.now() - inicio;
    logger.info("obras-get", `${todasObras.length} obras de ${tablas.length} tabla(s) en ${ms}ms`);

    res.json({ success: true, total: todasObras.length, data: todasObras });
  } catch (err) {
    logger.error("obras-get", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/obra/:id_obra ─────────────────────────────────────────

async function getObra(req, res) {
  const { id_obra } = req.params;
  const { tabla: tablaHint } = req.query;
  try {
    let tablas = [...TABLAS_PROGRAMA];
    try {
      const din = await listarTablas();
      for (const t of din) { if (!TABLAS_EXCLUIR.has(t) && !tablas.includes(t)) tablas.push(t); }
    } catch {}
    const tablasABuscar = tablaHint ? tablas.filter((t) => t === tablaHint) : tablas;

    for (const nombreTabla of tablasABuscar) {
      try {
        const { campos, selectCols } = await buildTableMeta(nombreTabla);
        if (!campos.id || selectCols.length === 0) continue;

        const { rows } = await query(
          `SELECT ${selectCols.join(", ")}
           FROM "${SCHEMA}"."${nombreTabla}"
           WHERE ${qid(campos.id)}::text = $1 LIMIT 1`,
          [id_obra]
        );

        if (rows.length > 0) {
          return res.json({ success: true, data: normalizeRow(rows[0], nombreTabla, campos) });
        }
      } catch { /* tabla sin columna id compatible */ }
    }

    res.status(404).json({ success: false, message: "Obra no encontrada" });
  } catch (err) {
    logger.error("obra-get", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── PUT /api/avance — body: { id_obra, avance, responsable, tabla? } ─

async function updateAvance(req, res) {
  const {
    id_obra,
    avance,
    responsable,
    tabla: tablaHint,
    marcar_entregada   = false,
    marcar_cancelada   = false,
    repetir_porcentaje = false,
    fecha_inauguracion = null,   // guardado en historial si existe
    motivo_cancelacion = null,   // guardado en historial si existe
  } = req.body;

  if (!id_obra) {
    return res.status(400).json({ success: false, message: "id_obra es requerido" });
  }

  const avanceNum = Number(avance);
  if (isNaN(avanceNum) || avanceNum < 0 || avanceNum > 100) {
    return res.status(400).json({ success: false, message: "avance debe ser un número entre 0 y 100" });
  }

  const resp = responsable || req.user?.email || "sistema";

  try {
    let tablas = [...TABLAS_PROGRAMA];
    try {
      const din = await listarTablas();
      for (const t of din) { if (!TABLAS_EXCLUIR.has(t) && !tablas.includes(t)) tablas.push(t); }
    } catch {}
    const tablasABuscar = tablaHint ? tablas.filter((t) => t === tablaHint) : tablas;

    let tablaObjetivo = null;
    let campos        = null;
    let avanceAnterior = 0;
    let estatusActual  = "";

    for (const nombreTabla of tablasABuscar) {
      try {
        const meta = await buildTableMeta(nombreTabla);
        if (!meta.campos.id || !meta.campos.avance) continue;

        const selectStatus = meta.campos.estatus
          ? `, ${qid(meta.campos.estatus)} AS estatus`
          : ", NULL AS estatus";

        const { rows } = await query(
          `SELECT ${qid(meta.campos.avance)} AS avance ${selectStatus}
           FROM "${SCHEMA}"."${nombreTabla}"
           WHERE ${qid(meta.campos.id)}::text = $1 LIMIT 1`,
          [id_obra]
        );

        if (rows.length > 0) {
          tablaObjetivo  = nombreTabla;
          campos         = meta.campos;
          avanceAnterior = rows[0].avance !== null ? Number(rows[0].avance) : 0;
          estatusActual  = rows[0].estatus || "";
          break;
        }
      } catch { /* tabla sin columna id compatible */ }
    }

    if (!tablaObjetivo || !campos) {
      return res.status(404).json({ success: false, message: "Obra no encontrada" });
    }

    if (avanceNum < avanceAnterior) {
      return res.status(400).json({
        success: false,
        message: `El porcentaje no puede disminuir. Actual: ${avanceAnterior}%`,
        code:    "AVANCE_REDUCCION",
        actual:  avanceAnterior,
      });
    }

    const estatusUpper = estatusActual.toUpperCase();
    const nuevoEstatus = marcar_cancelada
      ? "CANCELADA"
      : marcar_entregada
        ? "ENTREGADO"
        : estatusUpper === "ENTREGADO" || estatusUpper === "CANCELADA" || estatusUpper === "CANCELADO"
          ? estatusActual
          : repetir_porcentaje && avanceNum === avanceAnterior
            ? estatusActual || estatusPorAvance(avanceNum)
            : estatusPorAvance(avanceNum);

    const setParts    = [`${qid(campos.avance)} = $1`];
    const updateParams = [avanceNum];

    if (campos.estatus) {
      updateParams.push(nuevoEstatus);
      setParts.push(`${qid(campos.estatus)} = $${updateParams.length}`);
    }
    if (campos.fecha) {
      setParts.push(`${qid(campos.fecha)} = NOW()`);
    }

    updateParams.push(String(id_obra));

    await query(
      `UPDATE "${SCHEMA}"."${tablaObjetivo}"
       SET ${setParts.join(", ")}
       WHERE ${qid(campos.id)}::text = $${updateParams.length}`,
      updateParams
    );

    // Historial (falla silenciosamente si la tabla no existe)
    try {
      const fechaFinal = (marcar_entregada && fecha_inauguracion)
        ? new Date(fecha_inauguracion).toISOString()
        : "NOW()";

      const notaHistorial = motivo_cancelacion
        ? `CANCELACIÓN: ${motivo_cancelacion}`
        : marcar_entregada && fecha_inauguracion
          ? `INAUGURADA: ${fecha_inauguracion}`
          : null;

      await query(
        `INSERT INTO "${SCHEMA}"."${H}" ("ID OBRA", "AVANCE REAL", fecha, responsable)
         VALUES ($1, $2, ${marcar_entregada && fecha_inauguracion ? `'${fechaFinal}'::timestamptz` : "NOW()"}, $3)`,
        [id_obra, avanceNum, notaHistorial ? `${resp} | ${notaHistorial}` : resp]
      );
    } catch (hErr) {
      logger.warn("historial", `historial_avances: ${hErr.message}`);
    }

    logger.info(
      "avance-update",
      `Obra ${id_obra} [${tablaObjetivo}]: ${avanceAnterior}% → ${avanceNum}% [${nuevoEstatus}] por ${resp}`
    );

    res.json({
      success:         true,
      id_obra,
      tabla:           tablaObjetivo,
      avance_anterior: avanceAnterior,
      avance_nuevo:    avanceNum,
      estatus:         nuevoEstatus,
      color:           colorPorEstatus(nuevoEstatus, avanceNum),
    });
  } catch (err) {
    logger.error("avance-update", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/historial/:id_obra ────────────────────────────────────

async function getHistorial(req, res) {
  const { id_obra } = req.params;
  try {
    const { rows } = await query(
      `SELECT id, "ID OBRA" AS id_obra, "AVANCE REAL" AS avance, fecha, responsable
       FROM "${SCHEMA}"."${H}"
       WHERE "ID OBRA" = $1
       ORDER BY fecha DESC`,
      [id_obra]
    );
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    logger.error("historial-get", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/geojson/obras?dg=DGCOP ───────────────────────────────

async function geoJsonByDg(req, res) {
  const { dg } = req.query;
  const inicio = Date.now();
  try {
    const todasTablas = await listarTablas();
    const tablas = todasTablas.filter((t) => !TABLAS_EXCLUIR.has(t));
    const features = [];

    for (const nombreTabla of tablas) {
      try {
        const { columnas, campos } = await buildTableMeta(nombreTabla);
        if (!campos.geom) continue;

        // Filtro DG por tabla cuando no hay columna
        if (dg && !campos.dg) {
          const tablaDG = extraerDGDesdeNombreTabla(nombreTabla);
          if (tablaDG.toUpperCase() !== dg.toUpperCase()) continue;
        }

        const dataCols = columnas
          .filter((c) => !["geometry", "geography"].includes(c.udt_name))
          .map((c) => qid(c.column_name));

        const params = [];
        let where = `WHERE ${qid(campos.geom)} IS NOT NULL`;
        if (dg && campos.dg) {
          params.push(dg.toUpperCase());
          where += ` AND UPPER(${qid(campos.dg)}::text) = $1`;
        }

        const sql = `
          SELECT
            ST_AsGeoJSON(${qid(campos.geom)})::json AS geom_json
            ${dataCols.length ? `, ${dataCols.join(", ")}` : ""}
          FROM "${SCHEMA}"."${nombreTabla}"
          ${where}
          LIMIT 2000
        `;

        const { rows } = await query(sql, params);

        for (const r of rows) {
          if (!r.geom_json) continue;
          const obra = normalizeRow(r, nombreTabla, campos);
          features.push({
            type:     "Feature",
            geometry: r.geom_json,
            properties: {
              id_obra:              obra.id_obra,
              nombre:               obra.nombre,
              direccion_general:    obra.direccion_general,
              programa:             obra.programa,
              alcaldia:             obra.alcaldia,
              avance_real:          obra.avance,
              estatus:              obra.estatus,
              ultima_actualizacion: obra.fecha_actualizacion,
              color:                obra.color,
              tabla:                obra.tabla,
            },
          });
        }
      } catch (tableErr) {
        logger.warn("geojson-dg", `Skip ${nombreTabla}: ${tableErr.message}`);
      }
    }

    const ms = Date.now() - inicio;
    logger.info("geojson-dg", `${features.length} features${dg ? ` (DG=${dg})` : ""} en ${ms}ms`);
    res.json({ type: "FeatureCollection", features, total: features.length, success: true });
  } catch (err) {
    logger.error("geojson-dg", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/export/semana ─────────────────────────────────────────

async function exportSemana(req, res) {
  try {
    const { rows } = await query(
      `SELECT "ID OBRA" AS id_obra, "AVANCE REAL" AS avance, fecha, responsable
       FROM "${SCHEMA}"."${H}"
       WHERE fecha >= NOW() - INTERVAL '7 days'
       ORDER BY fecha DESC`
    );

    const lines = [
      "ID OBRA,AVANCE REAL (%),FECHA,RESPONSABLE",
      ...rows.map((r) =>
        [
          `"${r.id_obra || ""}"`,
          r.avance !== null ? r.avance : "",
          r.fecha ? new Date(r.fecha).toISOString().replace("T", " ").slice(0, 19) : "",
          `"${r.responsable || ""}"`,
        ].join(",")
      ),
    ];

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="avances-semana-${fecha}.csv"`);
    res.send("\uFEFF" + lines.join("\r\n"));
  } catch (err) {
    logger.error("export-semana", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getObras, getObra, updateAvance, getHistorial, geoJsonByDg, exportSemana };
