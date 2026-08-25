/**
 * controllers/obrasUpdateCtrl.js
 * Backend PostgreSQL para SICOPS — actualización de avance en tiempo real.
 *
 * Endpoints:
 *   PUT  /api/obras/update          → actualizarObra    (sistema externo)
 *   GET  /api/obras?tabla=xxx       → listarObrasTabla
 *   POST /api/obras/:id/editar      → iniciarEdicionPg  (paso 0 — genera cambio_id)
 *   POST /api/obras/:id/confirmar/step1 → confirmarStep1Pg
 *   POST /api/obras/:id/confirmar/step2 → confirmarStep2Pg
 */

const { randomUUID } = require("crypto");
const { query, listarTablas, columnasDe, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

const ALIAS = {
  id: ["id", "gid", "objectid", "fid", "ogc_fid"],
  nombre: [
    "nombre del sitio intervenido",
    "nombre",
    "name",
    "nombre_obra",
    "nom_obra",
    "titulo",
    "descripcion",
  ],
  avance: [
    "avance real",
    "avance_real",
    "avance",
    "porcentaje_avance",
    "porcentaje",
    "avance_fisico",
  ],
  estado: ["estatus", "estado", "status"],
  fecha_actualizacion: ["fecha actualizacion", "fecha_actualizacion", "updated_at"],
  usuario_actualizacion: ["usuario actualizacion", "usuario_actualizacion"],
  fecha_inauguracion: ["fecha inauguracion", "fecha_inauguracion"],
  motivo_cancelacion: ["motivo cancelacion", "motivo_cancelacion"],
};

/* ── Utilidades de identifiers seguros ── */
function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function calcularEstatus(avance) {
  const n = Number(avance);
  if (n === 0)   return "SIN INICIAR";
  if (n < 100)   return "EN PROCESO";
  return "TERMINADO";
}

function getIp(req) {
  const raw = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  return Array.isArray(raw) ? raw[0] : String(raw).split(",")[0].trim();
}

function normalizeTableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeColumnName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectarColumna(columnas, aliases = [], includes = []) {
  const normalizadas = columnas.map((col) => ({
    original: col.column_name,
    lower: normalizeColumnName(col.column_name),
  }));

  for (const alias of aliases) {
    const aliasLower = normalizeColumnName(alias);
    const exacta = normalizadas.find((col) => col.lower === aliasLower);
    if (exacta) return exacta.original;
  }

  for (const pattern of includes) {
    const patternLower = normalizeColumnName(pattern);
    const parcial = normalizadas.find((col) => col.lower.includes(patternLower));
    if (parcial) return parcial.original;
  }

  return null;
}

function detectarCamposActualizacion(columnas) {
  return {
    id: detectarColumna(columnas, ALIAS.id),
    nombre: detectarColumna(columnas, ALIAS.nombre, ["nombre"]),
    avance: detectarColumna(columnas, ALIAS.avance, ["avance"]),
    estado: detectarColumna(columnas, ALIAS.estado, ["estatus", "estado"]),
    fechaActualizacion: detectarColumna(columnas, ALIAS.fecha_actualizacion, ["fecha"]),
    usuarioActualizacion: detectarColumna(columnas, ALIAS.usuario_actualizacion, ["usuario"]),
    fechaInauguracion: detectarColumna(columnas, ALIAS.fecha_inauguracion, ["inauguracion"]),
    motivoCancelacion: detectarColumna(columnas, ALIAS.motivo_cancelacion, ["cancelacion"]),
  };
}

function toNullableInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toNullableDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // Strings YYYY-MM-DD se devuelven directamente para evitar conversión UTC→local
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function verificarSistemaAbierto() {
  const estadoSistema = await query(
    `SELECT activo FROM ${SCHEMA}.sistema_estado ORDER BY id LIMIT 1`
  );

  if (estadoSistema.rows.length > 0 && !estadoSistema.rows[0].activo) {
    const err = new Error("Sistema cerrado temporalmente. No se pueden registrar actualizaciones.");
    err.status = 403;
    err.code = "SISTEMA_CERRADO";
    throw err;
  }
}

async function resolverTablaYCampos(tabla) {
  const tablaReal = await resolverNombreTabla(tabla);
  if (!tablaReal) {
    const err = new Error(`La tabla "${tabla}" no existe en el esquema ${SCHEMA}.`);
    err.status = 400;
    err.code = "TABLA_INVALIDA";
    throw err;
  }

  const columnas = await columnasDe(tablaReal);
  const campos = detectarCamposActualizacion(columnas);
  return { tablaReal, campos };
}

async function buscarObraPorId(tablaReal, campos, id) {
  if (!campos.id) {
    const err = new Error(`La tabla "${tablaReal}" no tiene una columna id compatible.`);
    err.status = 400;
    err.code = "ID_COLUMN_MISSING";
    throw err;
  }

  const findRes = await query(
    `SELECT
       ${qid(campos.id)}::text AS obra_id,
       ${campos.avance ? `${qid(campos.avance)}::text` : "NULL::text"} AS avance_actual,
       ${campos.nombre ? `${qid(campos.nombre)}::text` : "NULL::text"} AS nombre_actual,
       ${campos.estado ? `${qid(campos.estado)}::text` : "NULL::text"} AS estatus_actual
     FROM ${qid(SCHEMA)}.${qid(tablaReal)}
     WHERE ${qid(campos.id)}::text = $1
     LIMIT 1`,
    [String(id)]
  );

  if (findRes.rows.length === 0) {
    const err = new Error("Obra no encontrada.");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const row = findRes.rows[0];
  return {
    obraId: row.obra_id || String(id),
    avanceActual: Number(String(row.avance_actual || "").replace(",", ".")) || 0,
    nombreActual: row.nombre_actual || null,
    estatusAnterior: row.estatus_actual || calcularEstatus(Number(String(row.avance_actual || "").replace(",", ".")) || 0),
  };
}

async function insertarAuditoria({
  accion,
  usuario,
  tabla,
  obraId,
  porcentajeAnterior,
  porcentajeNuevo,
  delta,
  motivo,
  motivoCancelacion,
  fechaInauguracion,
  ip,
  estatusAnterior,
  estatusNuevo,
  nombreObra,
}) {
  await query(
    `INSERT INTO ${qid(SCHEMA)}.auditoria (
       timestamp,
       accion,
       usuario,
       tabla,
       obra_id,
       porcentaje_anterior,
       porcentaje_nuevo,
       delta,
       motivo,
       fecha_inauguracion,
       motivo_cancelacion,
       ip,
       "ESTATUS ANTERIOR",
       "ESTATUS NUEVO",
       "NOMBRE DEL SITIO INTERVENIDO",
       semana,
       anio
     ) VALUES (
       NOW(),
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       EXTRACT(WEEK FROM NOW() AT TIME ZONE 'America/Mexico_City'),
       EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Mexico_City')
     )`,
    [
      accion,
      usuario,
      tabla,
      toNullableInteger(obraId),
      porcentajeAnterior,
      porcentajeNuevo,
      delta,
      motivo || null,
      toNullableDate(fechaInauguracion),
      motivoCancelacion || null,
      ip,
      estatusAnterior,
      estatusNuevo,
      nombreObra,
    ]
  );
}

/* ── Cache de tablas válidas (5 min TTL) ── */
let _tablasCache = null;
let _tablasCacheTs = 0;
const TABLAS_TTL = 5 * 60 * 1000;

async function obtenerTablasValidas() {
  if (_tablasCache && Date.now() - _tablasCacheTs < TABLAS_TTL) return _tablasCache;
  const tablas = await listarTablas();
  _tablasCache = new Set(tablas);
  _tablasCacheTs = Date.now();
  return _tablasCache;
}

async function resolverNombreTabla(tablaSolicitada) {
  const tablasValidas = await obtenerTablasValidas();
  if (tablasValidas.has(tablaSolicitada)) return tablaSolicitada;

  const normalizada = normalizeTableName(tablaSolicitada);
  for (const tablaReal of tablasValidas) {
    if (normalizeTableName(tablaReal) === normalizada) {
      return tablaReal;
    }
  }

  return null;
}

/* ── Store en memoria para el flujo de 3 pasos (TTL 10 min) ── */
const cambiosPendientes = new Map();
const TTL_PENDIENTE = 10 * 60 * 1000;

function limpiarCambiosExpirados() {
  const ahora = Date.now();
  for (const [id, c] of cambiosPendientes.entries()) {
    if (ahora - c.creado > TTL_PENDIENTE) cambiosPendientes.delete(id);
  }
}

/* ─────────────────────────────────────────────────────────────
   PUT /api/obras/update
   Actualización directa desde sistema externo.
   Body: { tabla, id, nombre, avance, usuario, motivo }
───────────────────────────────────────────────────────────── */
async function actualizarObra(req, res) {
  const { tabla, id, nombre, avance, usuario, motivo, permitirRepetido = false, accion = "actualizar" } = req.body;
  const ip = getIp(req);

  /* ── 1. Validar campos obligatorios ── */
  if (!tabla || id === undefined || id === null) {
    return res.status(400).json({
      success: false,
      message: "tabla e id son requeridos.",
      code: "MISSING_FIELDS",
    });
  }

  const avanceNum = Number(avance);
  if (Number.isNaN(avanceNum) || avanceNum < 0 || avanceNum > 100) {
    return res.status(400).json({
      success: false,
      message: "avance debe ser un número entre 0 y 100.",
      code: "INVALID_AVANCE",
    });
  }

  try {
    await verificarSistemaAbierto();

    /* ── 2. Resolver tabla contra lista blanca de pg_tables ── */
    const tablaReal = await resolverNombreTabla(tabla);
    if (!tablaReal) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tabla}" no existe en el esquema ${SCHEMA}.`,
        code: "TABLA_INVALIDA",
      });
    }

    const columnas = await columnasDe(tablaReal);
    const campos = detectarCamposActualizacion(columnas);

    if (!campos.avance) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tablaReal}" no tiene una columna de avance compatible.`,
        code: "AVANCE_COLUMN_MISSING",
      });
    }

    let findRes = null;
    let criterio = null;

    if (campos.id && id !== undefined && id !== null && id !== "") {
      findRes = await query(
        `SELECT
           ${qid(campos.id)}::text AS obra_id,
           ${qid(campos.avance)}::text AS avance_actual,
           ${campos.nombre ? `${qid(campos.nombre)}::text` : "NULL::text"} AS nombre_actual,
           ${campos.estado ? `${qid(campos.estado)}::text` : "NULL::text"} AS estatus_actual
         FROM ${qid(SCHEMA)}.${qid(tablaReal)}
         WHERE ${qid(campos.id)}::text = $1
         LIMIT 2`,
        [String(id)]
      );

      if (findRes.rows.length > 0) {
        criterio = { tipo: "id", valor: String(id) };
      }
    }

    if ((!findRes || findRes.rows.length === 0) && campos.nombre && nombre) {
      findRes = await query(
        `SELECT
           ${campos.id ? `${qid(campos.id)}::text` : "NULL::text"} AS obra_id,
           ${qid(campos.avance)}::text AS avance_actual,
           ${qid(campos.nombre)}::text AS nombre_actual,
           ${campos.estado ? `${qid(campos.estado)}::text` : "NULL::text"} AS estatus_actual
         FROM ${qid(SCHEMA)}.${qid(tablaReal)}
         WHERE ${qid(campos.nombre)}::text = $1
         LIMIT 2`,
        [String(nombre)]
      );

      if (findRes.rows.length === 1) {
        criterio = { tipo: "nombre", valor: String(nombre) };
      } else if (findRes.rows.length > 1) {
        return res.status(409).json({
          success: false,
          message: `Hay múltiples obras con el nombre "${nombre}" en la tabla "${tablaReal}".`,
          code: "AMBIGUOUS_NAME",
        });
      }
    }

    if (!findRes || !criterio) {
      return res.status(400).json({
        success: false,
        message: `No fue posible identificar la obra en la tabla "${tablaReal}" con los campos disponibles.`,
        code: "LOOKUP_NOT_SUPPORTED",
      });
    }

    if (findRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Obra no encontrada con los datos proporcionados.",
        code: "NOT_FOUND",
      });
    }

    /* ── 4. Obtener avance actual ── */
    const matchedRow = findRes.rows[0];
    const avanceActual = Number(String(matchedRow.avance_actual || "").replace(",", ".")) || 0;
    const nombreActual = findRes.rows[0].nombre_actual || nombre || null;
    const obraIdActual = matchedRow.obra_id || (id ?? null);
    const estatusAnterior = matchedRow.estatus_actual || calcularEstatus(avanceActual);

    /* ── 5. Validar que el avance no disminuya ni sea igual ── */
    if (avanceNum < avanceActual) {
      return res.status(400).json({
        success: false,
        message: `No se puede reducir el avance. Actual: ${avanceActual}%, Nuevo: ${avanceNum}%.`,
        code: "AVANCE_REDUCCION",
        avance_actual: avanceActual,
      });
    }
    if (avanceNum === avanceActual && !permitirRepetido) {
      return res.status(400).json({
        success: false,
        message: `El avance ya está en ${avanceActual}%. No hay cambios que guardar.`,
        code: "AVANCE_IGUAL",
      });
    }

    /* ── 6. Calcular estatus ── */
    const estatusNuevo = calcularEstatus(avanceNum);
    const delta = +(avanceNum - avanceActual).toFixed(2);
    const usuarioAudit = usuario || req.user?.email || "sistema";

    /* ── 7. Ejecutar UPDATE ── */
    const setClauses = [`${qid(campos.avance)} = $1`];
    const params = [avanceNum];

    if (campos.estado) {
      params.push(estatusNuevo);
      setClauses.push(`${qid(campos.estado)} = $${params.length}`);
    }
    if (campos.fechaActualizacion) {
      setClauses.push(`${qid(campos.fechaActualizacion)} = NOW()`);
    }
    if (campos.usuarioActualizacion) {
      params.push(usuarioAudit);
      setClauses.push(`${qid(campos.usuarioActualizacion)} = $${params.length}`);
    }

    params.push(String(criterio.valor));
    const whereColumn = criterio.tipo === "id" && campos.id ? campos.id : campos.nombre;

    const updateRes = await query(
      `UPDATE ${qid(SCHEMA)}.${qid(tablaReal)}
       SET ${setClauses.join(", ")}
       WHERE ${qid(whereColumn)}::text = $${params.length}`,
      params
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No se encontró la obra al aplicar la actualización.",
        code: "NOT_FOUND",
      });
    }

    await insertarAuditoria({
      accion: permitirRepetido && avanceNum === avanceActual ? "repetir" : accion,
      usuario: usuarioAudit,
      tabla: tablaReal,
      obraId: obraIdActual,
      porcentajeAnterior: avanceActual,
      porcentajeNuevo: avanceNum,
      delta,
      motivo,
      ip,
      estatusAnterior,
      estatusNuevo,
      nombreObra: nombreActual,
    });

    logger.info(
      "obras-update",
      `criterio=${criterio.tipo}:${criterio.valor} [${tablaReal}] ${avanceActual}%→${avanceNum}% (${estatusNuevo}) por ${usuarioAudit}`
    );

    /* ── 9. Respuesta ── */
    return res.json({
      success: true,
      id: obraIdActual,
      nombre: nombreActual,
      porcentaje_anterior: avanceActual,
      porcentaje_nuevo: avanceNum,
      delta,
      estatus_anterior: estatusAnterior,
      estatus_nuevo: estatusNuevo,
      accion: permitirRepetido && avanceNum === avanceActual ? "repetir" : accion,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code || "REQUEST_ERROR",
      });
    }

    logger.error("obras-update", `Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error interno al actualizar la obra.",
      detail: err.message,
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/obras?tabla=xxx
   Devuelve todos los registros de la tabla indicada.
   Excluye columnas de geometría.
───────────────────────────────────────────────────────────── */
async function listarObrasTabla(req, res, next) {
  const { tabla } = req.query;

  /* Sin ?tabla, pasar al siguiente handler (JSON) */
  if (!tabla) return next();

  try {
    const tablaReal = await resolverNombreTabla(tabla);
    if (!tablaReal) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tabla}" no existe en el esquema ${SCHEMA}.`,
        code: "TABLA_INVALIDA",
      });
    }

    /* Construir SELECT con columnas no-geométricas */
    const columnas = await columnasDe(tablaReal);
    const GEOM_TYPES = new Set(["geometry", "geography", "raster"]);
    const colsSelect = columnas
      .filter((c) => !GEOM_TYPES.has(c.udt_name) && !GEOM_TYPES.has(c.data_type))
      .map((c) => qid(c.column_name))
      .join(", ");

    const result = await query(
      `SELECT ${colsSelect} FROM ${qid(SCHEMA)}.${qid(tablaReal)} ORDER BY id`
    );

    logger.info("obras-list", `${tablaReal}: ${result.rows.length} registros`);

    return res.json({
      success: true,
      tabla: tablaReal,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    logger.error("obras-list", `Error tabla ${tabla}: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error al consultar la tabla.",
      detail: err.message,
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/obras/:id/editar   (paso 0)
   Body: { tabla, porcentaje_nuevo, motivo }
   Responde con cambio_id (UUID) válido 10 min.
───────────────────────────────────────────────────────────── */
async function iniciarEdicionPg(req, res) {
  limpiarCambiosExpirados();

  const id = parseInt(req.params.id, 10);
  const { tabla, porcentaje_nuevo, motivo } = req.body;
  const usuario = req.user?.email || req.user?.username || "anon";

  if (!tabla || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: "tabla y un id numérico son requeridos.",
      code: "MISSING_FIELDS",
    });
  }

  const nuevo = Number(porcentaje_nuevo);
  if (Number.isNaN(nuevo) || nuevo < 0 || nuevo > 100) {
    return res.status(400).json({
      success: false,
      message: "porcentaje_nuevo debe estar entre 0 y 100.",
      code: "INVALID_AVANCE",
    });
  }

  try {
    await verificarSistemaAbierto();

    /* Validar tabla */
    const tablaReal = await resolverNombreTabla(tabla);
    if (!tablaReal) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tabla}" no existe en el esquema ${SCHEMA}.`,
        code: "TABLA_INVALIDA",
      });
    }

    /* Buscar obra */
    const findRes = await query(
      `SELECT id, "AVANCE REAL" AS avance_actual, "NOMBRE DEL SITIO INTERVENIDO" AS nombre, "ESTATUS" AS estatus_actual
       FROM ${qid(SCHEMA)}.${qid(tablaReal)}
       WHERE id = $1`,
      [id]
    );

    if (findRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Obra no encontrada.",
        code: "NOT_FOUND",
      });
    }

    const anterior = Number(findRes.rows[0].avance_actual) || 0;
    const nombreObra = findRes.rows[0].nombre || "";
    const estatusAnterior = findRes.rows[0].estatus_actual || calcularEstatus(anterior);
    const delta = +(nuevo - anterior).toFixed(2);

    /* Validar delta */
    if (nuevo < anterior) {
      return res.status(400).json({
        success: false,
        message: `No se puede reducir el avance. Actual: ${anterior}%, Nuevo: ${nuevo}%.`,
        code: "AVANCE_REDUCCION",
        delta,
      });
    }
    if (nuevo === anterior && !req.body?.permitirRepetido) {
      return res.status(400).json({
        success: false,
        message: `El avance ya está en ${anterior}%. No hay cambios.`,
        code: "AVANCE_IGUAL",
        delta,
      });
    }

    /* Guardar cambio pendiente */
    const cambioId = randomUUID();
    cambiosPendientes.set(cambioId, {
      cambioId,
      obraId: id,
      tabla: tablaReal,
      nombreObra,
      anterior,
      nuevo,
      delta,
      motivo: motivo || "",
      usuario,
      creado: Date.now(),
      paso: 1,
      estatusAnterior,
    });

    logger.info("obras-editar", `Pendiente id=${id} [${tablaReal}] ${anterior}%→${nuevo}% uuid=${cambioId}`);

    return res.json({
      success: true,
      message: "Cambio pendiente de confirmación. TTL: 10 minutos.",
      cambio_id: cambioId,
      anterior,
      nuevo,
      delta,
      obra: { id, nombre: nombreObra, tabla: tablaReal },
    });
  } catch (err) {
    logger.error("obras-editar", `Error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error interno.", detail: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/obras/:id/confirmar/step1
   Body: { cambio_id }
   Verifica cambio_id y solicita código verbal.
───────────────────────────────────────────────────────────── */
function confirmarStep1Pg(req, res) {
  const { cambio_id } = req.body;

  if (!cambio_id) {
    return res.status(400).json({
      success: false,
      message: "cambio_id es requerido.",
      code: "MISSING_CAMBIO_ID",
    });
  }

  const cambio = cambiosPendientes.get(cambio_id);
  if (!cambio || Date.now() - cambio.creado > TTL_PENDIENTE) {
    cambiosPendientes.delete(cambio_id);
    return res.status(400).json({
      success: false,
      message: "Cambio no encontrado o expirado (TTL 10 min).",
      code: "CAMBIO_EXPIRADO",
    });
  }

  /* Avanzar a paso 2 */
  cambio.paso = 2;

  return res.json({
    success: true,
    paso: "requiere_verificacion",
    message: 'Para confirmar, envíe el campo codigo_verbal con el valor exacto: "CONFIRMO"',
    cambio_id,
    resumen: {
      obra_id: cambio.obraId,
      tabla:   cambio.tabla,
      nombre:  cambio.nombreObra,
      anterior: cambio.anterior,
      nuevo:    cambio.nuevo,
      delta:    cambio.delta,
    },
    expira_en: Math.max(0, Math.round((TTL_PENDIENTE - (Date.now() - cambio.creado)) / 1000)),
  });
}

/* ─────────────────────────────────────────────────────────────
   POST /api/obras/:id/confirmar/step2
   Body: { cambio_id, codigo_verbal }
   Aplica el cambio en PostgreSQL y registra auditoría.
───────────────────────────────────────────────────────────── */
async function confirmarStep2Pg(req, res) {
  const { cambio_id, codigo_verbal } = req.body;
  const ip = getIp(req);

  if (!cambio_id) {
    return res.status(400).json({
      success: false,
      message: "cambio_id es requerido.",
      code: "MISSING_CAMBIO_ID",
    });
  }

  if (!codigo_verbal || codigo_verbal.trim().toUpperCase() !== "CONFIRMO") {
    return res.status(400).json({
      success: false,
      message: 'El código verbal debe ser exactamente "CONFIRMO".',
      code: "CODIGO_INVALIDO",
    });
  }

  const cambio = cambiosPendientes.get(cambio_id);
  if (!cambio || Date.now() - cambio.creado > TTL_PENDIENTE) {
    cambiosPendientes.delete(cambio_id);
    return res.status(400).json({
      success: false,
      message: "Cambio no encontrado o expirado.",
      code: "CAMBIO_EXPIRADO",
    });
  }

  if (cambio.paso !== 2) {
    return res.status(400).json({
      success: false,
      message: "Debe completar el step1 antes del step2.",
      code: "PASO_INCORRECTO",
    });
  }

  try {
    await verificarSistemaAbierto();

    const estatusNuevo = calcularEstatus(cambio.nuevo);

    /* UPDATE en PostgreSQL */
    const updateRes = await query(
      `UPDATE ${qid(SCHEMA)}.${qid(cambio.tabla)}
       SET
         "AVANCE REAL"          = $1,
         "ESTATUS"              = $2,
         "FECHA ACTUALIZACION"  = NOW(),
         "USUARIO ACTUALIZACION"= $3
       WHERE id = $4
       RETURNING id, "AVANCE REAL" AS avance_nuevo, "ESTATUS" AS estatus`,
      [cambio.nuevo, estatusNuevo, cambio.usuario, cambio.obraId]
    );

    if (updateRes.rows.length === 0) {
      cambiosPendientes.delete(cambio_id);
      return res.status(404).json({
        success: false,
        message: "Obra no encontrada al aplicar el cambio.",
        code: "NOT_FOUND",
      });
    }

    await insertarAuditoria({
      accion: cambio.delta === 0 ? "repetir" : "actualizar",
      usuario: cambio.usuario,
      tabla: cambio.tabla,
      obraId: cambio.obraId,
      porcentajeAnterior: cambio.anterior,
      porcentajeNuevo: cambio.nuevo,
      delta: cambio.delta,
      motivo: cambio.motivo,
      ip,
      estatusAnterior: cambio.estatusAnterior,
      estatusNuevo,
      nombreObra: cambio.nombreObra,
    });

    cambiosPendientes.delete(cambio_id);

    logger.info(
      "obras-confirmar",
      `Confirmado id=${cambio.obraId} [${cambio.tabla}] ${cambio.anterior}%→${cambio.nuevo}% por ${cambio.usuario}`
    );

    return res.json({
      success: true,
      message: "Cambio guardado correctamente.",
      obra: {
        id:       cambio.obraId,
        tabla:    cambio.tabla,
        nombre:   cambio.nombreObra,
        anterior: cambio.anterior,
        nuevo:    cambio.nuevo,
        delta:    cambio.delta,
        estatus:  estatusNuevo,
      },
    });
  } catch (err) {
    logger.error("obras-confirmar", `Error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error interno.", detail: err.message });
  }
}

async function inaugurarObra(req, res) {
  const { tabla, id, fecha_inauguracion, usuario } = req.body;
  const ip = getIp(req);

  if (!tabla || id === undefined || id === null || !fecha_inauguracion) {
    return res.status(400).json({
      success: false,
      message: "tabla, id y fecha_inauguracion son requeridos.",
      code: "MISSING_FIELDS",
    });
  }

  const fechaNormalizada = toNullableDate(fecha_inauguracion);
  if (!fechaNormalizada) {
    return res.status(400).json({
      success: false,
      message: "fecha_inauguracion no es válida.",
      code: "INVALID_DATE",
    });
  }

  try {
    await verificarSistemaAbierto();

    const { tablaReal, campos } = await resolverTablaYCampos(tabla);
    const obra = await buscarObraPorId(tablaReal, campos, id);
    const usuarioAudit = usuario || req.user?.email || "sistema";
    const estatusNuevo = "ENTREGADO";
    const estatusAnterior = String(obra.estatusAnterior || "").trim().toUpperCase();
    const avanceAnterior = Number(obra.avanceActual) || 0;
    const avanceNuevo = avanceAnterior < 100 ? 100 : avanceAnterior;
    const delta = +(avanceNuevo - avanceAnterior).toFixed(2);

    if (!campos.avance || !campos.estado || !campos.fechaActualizacion || !campos.usuarioActualizacion || !campos.fechaInauguracion) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tablaReal}" no cuenta con las columnas requeridas para inaugurar.`,
        code: "MISSING_REQUIRED_COLUMNS",
      });
    }

    if (estatusAnterior.includes("CANCELAD")) {
      return res.status(400).json({
        success: false,
        message: "No se puede inaugurar una obra cancelada.",
        code: "OBRA_CANCELADA",
      });
    }

    const updateRes = await query(
      `UPDATE ${qid(SCHEMA)}.${qid(tablaReal)}
       SET
         ${qid(campos.avance)} = $1,
         ${qid(campos.estado)} = $2,
         ${qid(campos.fechaInauguracion)} = $3,
         ${qid(campos.fechaActualizacion)} = NOW(),
         ${qid(campos.usuarioActualizacion)} = $4
       WHERE ${qid(campos.id)}::text = $5
       RETURNING ${campos.avance ? `${qid(campos.avance)}::text` : "NULL::text"} AS avance_nuevo`,
      [avanceNuevo, estatusNuevo, fechaNormalizada, usuarioAudit, String(id)]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }

    await insertarAuditoria({
      accion: "inaugurar",
      usuario: usuarioAudit,
      tabla: tablaReal,
      obraId: obra.obraId,
      porcentajeAnterior: avanceAnterior,
      porcentajeNuevo: avanceNuevo,
      delta,
      motivo: "INAUGURACION",
      fechaInauguracion: fechaNormalizada,
      ip,
      estatusAnterior: obra.estatusAnterior,
      estatusNuevo,
      nombreObra: obra.nombreActual,
    });

    logger.info("obras-inaugurar", `id=${obra.obraId} [${tablaReal}] ${obra.estatusAnterior}→${estatusNuevo} por ${usuarioAudit}`);

    return res.json({
      success: true,
      id: obra.obraId,
      nombre: obra.nombreActual,
      avanceAnterior,
      avanceNuevo,
      porcentaje_anterior: avanceAnterior,
      porcentaje_nuevo: avanceNuevo,
      estatus_anterior: obra.estatusAnterior,
      estatus_nuevo: estatusNuevo,
      estatusNuevo,
      fecha_inauguracion: fechaNormalizada,
      accion: "inaugurar",
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code || "REQUEST_ERROR",
      });
    }

    logger.error("obras-inaugurar", `Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error interno al inaugurar la obra.",
      detail: err.message,
    });
  }
}

async function cancelarObra(req, res) {
  const { tabla, id, motivo_cancelacion, usuario } = req.body;
  const ip = getIp(req);

  if (!tabla || id === undefined || id === null || !String(motivo_cancelacion || "").trim()) {
    return res.status(400).json({
      success: false,
      message: "tabla, id y motivo_cancelacion son requeridos.",
      code: "MISSING_FIELDS",
    });
  }

  try {
    await verificarSistemaAbierto();

    const { tablaReal, campos } = await resolverTablaYCampos(tabla);
    const obra = await buscarObraPorId(tablaReal, campos, id);
    const usuarioAudit = usuario || req.user?.email || "sistema";
    const estatusNuevo = "CANCELADO";
    const motivo = String(motivo_cancelacion).trim();

    if (!campos.estado || !campos.fechaActualizacion || !campos.usuarioActualizacion || !campos.motivoCancelacion) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tablaReal}" no cuenta con las columnas requeridas para cancelar.`,
        code: "MISSING_REQUIRED_COLUMNS",
      });
    }

    const updateRes = await query(
      `UPDATE ${qid(SCHEMA)}.${qid(tablaReal)}
       SET
         ${qid(campos.estado)} = $1,
         ${qid(campos.motivoCancelacion)} = $2,
         ${qid(campos.fechaActualizacion)} = NOW(),
         ${qid(campos.usuarioActualizacion)} = $3
       WHERE ${qid(campos.id)}::text = $4
       RETURNING ${campos.avance ? `${qid(campos.avance)}::text` : "NULL::text"} AS avance_nuevo`,
      [estatusNuevo, motivo, usuarioAudit, String(id)]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }

    await insertarAuditoria({
      accion: "cancelar",
      usuario: usuarioAudit,
      tabla: tablaReal,
      obraId: obra.obraId,
      porcentajeAnterior: obra.avanceActual,
      porcentajeNuevo: obra.avanceActual,
      delta: 0,
      motivo: motivo,
      motivoCancelacion: motivo,
      ip,
      estatusAnterior: obra.estatusAnterior,
      estatusNuevo,
      nombreObra: obra.nombreActual,
    });

    logger.info("obras-cancelar", `id=${obra.obraId} [${tablaReal}] ${obra.estatusAnterior}→${estatusNuevo} por ${usuarioAudit}`);

    return res.json({
      success: true,
      id: obra.obraId,
      nombre: obra.nombreActual,
      porcentaje_nuevo: obra.avanceActual,
      estatus_anterior: obra.estatusAnterior,
      estatus_nuevo: estatusNuevo,
      motivo_cancelacion: motivo,
      accion: "cancelar",
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code || "REQUEST_ERROR",
      });
    }

    logger.error("obras-cancelar", `Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error interno al cancelar la obra.",
      detail: err.message,
    });
  }
}

async function agregarFechaInauguracion(req, res) {
  const { tabla, id, fecha_inauguracion, usuario } = req.body;
  const ip = getIp(req);

  if (!tabla || id === undefined || id === null || !fecha_inauguracion) {
    return res.status(400).json({
      success: false,
      message: "tabla, id y fecha_inauguracion son requeridos.",
      code: "MISSING_FIELDS",
    });
  }

  const fechaNormalizada = toNullableDate(fecha_inauguracion);
  if (!fechaNormalizada) {
    return res.status(400).json({
      success: false,
      message: "fecha_inauguracion no es válida.",
      code: "INVALID_DATE",
    });
  }

  try {
    const { tablaReal, campos } = await resolverTablaYCampos(tabla);
    const obra = await buscarObraPorId(tablaReal, campos, id);
    const usuarioAudit = usuario || req.user?.email || "sistema";
    const estatusUpper = String(obra.estatusAnterior || "").trim().toUpperCase();

    const esEntregadaOInaugurada =
      estatusUpper.includes("ENTREGAD") || estatusUpper.includes("INAUGUR");
    if (!esEntregadaOInaugurada) {
      return res.status(400).json({
        success: false,
        message: "Solo se puede agregar fecha de inauguración a obras con estatus ENTREGADA o INAUGURADA.",
        code: "ESTATUS_INVALIDO",
      });
    }

    if (!campos.fechaInauguracion) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tablaReal}" no tiene columna de fecha de inauguración.`,
        code: "MISSING_COLUMN",
      });
    }

    const checkRes = await query(
      `SELECT ${qid(campos.fechaInauguracion)} AS fecha_actual
       FROM ${qid(SCHEMA)}.${qid(tablaReal)}
       WHERE ${qid(campos.id)}::text = $1
       LIMIT 1`,
      [String(id)]
    );
    if (checkRes.rows[0]?.fecha_actual) {
      return res.status(400).json({
        success: false,
        message: "Esta obra ya tiene fecha de inauguración registrada.",
        code: "FECHA_YA_EXISTE",
        fecha_inauguracion: checkRes.rows[0].fecha_actual,
      });
    }

    const setClauses = [`${qid(campos.fechaInauguracion)} = $1`];
    const params = [fechaNormalizada];

    if (campos.fechaActualizacion) {
      setClauses.push(`${qid(campos.fechaActualizacion)} = NOW()`);
    }
    if (campos.usuarioActualizacion) {
      params.push(usuarioAudit);
      setClauses.push(`${qid(campos.usuarioActualizacion)} = $${params.length}`);
    }
    params.push(String(id));

    const updateRes = await query(
      `UPDATE ${qid(SCHEMA)}.${qid(tablaReal)}
       SET ${setClauses.join(", ")}
       WHERE ${qid(campos.id)}::text = $${params.length}
       RETURNING 1`,
      params
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }

    await insertarAuditoria({
      accion: "agregar_fecha_inauguracion",
      usuario: usuarioAudit,
      tabla: tablaReal,
      obraId: obra.obraId,
      porcentajeAnterior: obra.avanceActual,
      porcentajeNuevo: obra.avanceActual,
      delta: 0,
      motivo: "AGREGAR FECHA INAUGURACION",
      fechaInauguracion: fechaNormalizada,
      ip,
      estatusAnterior: obra.estatusAnterior,
      estatusNuevo: obra.estatusAnterior,
      nombreObra: obra.nombreActual,
    });

    logger.info("obras-fecha-inauguracion", `id=${obra.obraId} [${tablaReal}] fecha=${fechaNormalizada} por ${usuarioAudit}`);

    return res.json({
      success: true,
      id: obra.obraId,
      nombre: obra.nombreActual,
      fecha_inauguracion: fechaNormalizada,
      estatus_actual: obra.estatusAnterior,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code || "REQUEST_ERROR",
      });
    }
    logger.error("obras-fecha-inauguracion", `Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error interno al agregar la fecha de inauguración.",
      detail: err.message,
    });
  }
}

module.exports = {
  actualizarObra,
  listarObrasTabla,
  iniciarEdicionPg,
  confirmarStep1Pg,
  confirmarStep2Pg,
  inaugurarObra,
  cancelarObra,
  agregarFechaInauguracion,
};
