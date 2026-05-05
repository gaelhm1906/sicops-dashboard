const { pool, query, columnasDe, listarTablas, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

const SEMANA_MINIMA = 3;
const TABLAS_EXCLUIDAS = new Set([
  "spatial_ref_sys",
  "geometry_columns",
  "geography_columns",
  "auditoria",
  "semana_control",
  "snapshots_semanales",
  "sistema_estado",
]);

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getSemanaISO(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);

  return {
    semana: week,
    anio: temp.getUTCFullYear(),
    periodo: `${temp.getUTCFullYear()}-W${week}`,
  };
}

function assertSemanaPermitida(semana) {
  if (Number(semana) < SEMANA_MINIMA) {
    const err = new Error("Semanas 1 y 2 pertenecen al sistema legacy (JSON)");
    err.status = 400;
    err.code = "LEGACY_WEEK_BLOCKED";
    throw err;
  }
}

async function getSemanaActiva() {
  const res = await query(
    `SELECT id, semana, anio, periodo, activa, fecha_inicio, fecha_cierre, creado_por, created_at
     FROM ${qid(SCHEMA)}.semana_control
     WHERE activa = true
     ORDER BY anio DESC, semana DESC, id DESC
     LIMIT 1`
  );

  return res.rows[0] || null;
}

async function ensureSemanaInicial() {
  await query(
    `INSERT INTO ${qid(SCHEMA)}.semana_control (
       semana, anio, periodo, activa, fecha_inicio, creado_por
     )
     SELECT 3, 2026, '2026-W3', true, NOW(), 'migracion_inicial'
     WHERE NOT EXISTS (
       SELECT 1 FROM ${qid(SCHEMA)}.semana_control WHERE semana = 3 AND anio = 2026
     )`
  );

  return getSemanaActiva();
}

async function registrarAuditoriaCambioSemana(usuario, semana, anio, motivo = "CAMBIO DE SEMANA", client = null) {
  const executor = client || { query };
  await executor.query(
    `INSERT INTO ${qid(SCHEMA)}.auditoria (
       timestamp,
       accion,
       usuario,
       tabla,
       motivo,
       semana,
       anio
     )
     VALUES (
       NOW() AT TIME ZONE 'America/Mexico_City',
       'cambio_semana',
       $1,
       'SISTEMA',
       $2,
       $3,
       $4
     )`,
    [usuario, motivo, semana, anio]
  );
}

function detectarColumna(columnas, candidatos = []) {
  const normalizadas = columnas.map((col) => ({
    original: col.column_name,
    lower: String(col.column_name).trim().toLowerCase(),
  }));

  for (const candidato of candidatos) {
    const found = normalizadas.find((col) => col.lower === candidato.toLowerCase());
    if (found) return found.original;
  }
  return null;
}

async function generarSnapshot(semana, anio, client = null) {
  assertSemanaPermitida(semana);

  const executor = client || { query };
  const tablas = (await listarTablas()).filter((tabla) => !TABLAS_EXCLUIDAS.has(tabla));

  for (const tabla of tablas) {
    const columnas = await columnasDe(tabla);
    const colId = detectarColumna(columnas, ["id"]);
    const colAvance = detectarColumna(columnas, ["AVANCE REAL", "avance real", "avance_real"]);
    const colEstatus = detectarColumna(columnas, ["ESTATUS", "estatus", "estado"]);

    if (!colId || !colAvance || !colEstatus) {
      continue;
    }

    const colNombre = detectarColumna(columnas, ["NOMBRE DEL SITIO INTERVENIDO", "nombre del sitio intervenido", "nombre"]);
    const colPrograma = detectarColumna(columnas, ["PROGRAMA", "programa"]);
    const colDG = detectarColumna(columnas, ["DIRECCION GENERAL", "direccion general", "direccion_general"]);

    const sql = `
      INSERT INTO ${qid(SCHEMA)}.snapshots_semanales (
        tabla,
        obra_id,
        avance,
        estatus,
        semana,
        anio,
        fecha,
        nombre_sitio,
        programa,
        direccion_general
      )
      SELECT
        $1,
        ${qid(colId)}::integer,
        NULLIF(${qid(colAvance)}::text, '')::real,
        ${qid(colEstatus)}::text,
        $2,
        $3,
        NOW(),
        ${colNombre ? `${qid(colNombre)}::text` : "NULL::text"},
        ${colPrograma ? `${qid(colPrograma)}::text` : "NULL::text"},
        ${colDG ? `${qid(colDG)}::text` : "NULL::text"}
      FROM ${qid(SCHEMA)}.${qid(tabla)}
      ON CONFLICT (tabla, obra_id, semana, anio) DO NOTHING
    `;

    await executor.query(sql, [tabla, String(semana), anio]);
  }
}

async function iniciarSemana({ usuario = "auto", manual = false } = {}) {
  const { semana, anio, periodo } = getSemanaISO();
  assertSemanaPermitida(semana);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existente = await client.query(
      `SELECT id, semana, anio, periodo, activa, fecha_inicio, fecha_cierre, creado_por, created_at
       FROM ${qid(SCHEMA)}.semana_control
       WHERE activa = true AND periodo = $1
       ORDER BY id DESC
       LIMIT 1`,
      [periodo]
    );

    if (existente.rows.length > 0) {
      await client.query("COMMIT");
      return { creada: false, semana: existente.rows[0] };
    }

    await client.query(
      `UPDATE ${qid(SCHEMA)}.semana_control
       SET activa = false,
           fecha_cierre = COALESCE(fecha_cierre, NOW())
       WHERE activa = true`
    );

    const insertRes = await client.query(
      `INSERT INTO ${qid(SCHEMA)}.semana_control (
         semana, anio, periodo, activa, fecha_inicio, creado_por
       )
       VALUES ($1, $2, $3, true, NOW(), $4)
       RETURNING id, semana, anio, periodo, activa, fecha_inicio, fecha_cierre, creado_por, created_at`,
      [semana, anio, periodo, usuario]
    );

    await registrarAuditoriaCambioSemana(usuario, semana, anio, "CAMBIO DE SEMANA", client);
    await generarSnapshot(semana, anio, client);

    await client.query("COMMIT");
    logger.info("semana", `Semana iniciada: ${periodo} por ${usuario} (${manual ? "manual" : "auto"})`);
    return { creada: true, semana: insertRes.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listarPeriodosSemana() {
  const res = await query(
    `SELECT id, semana, anio, periodo, activa, fecha_inicio, fecha_cierre, creado_por, created_at
     FROM ${qid(SCHEMA)}.semana_control
     WHERE semana >= $1
     ORDER BY anio DESC, semana DESC, id DESC`,
    [SEMANA_MINIMA]
  );
  return res.rows;
}

async function obtenerCortePorPeriodo(periodo) {
  const semanaRowRes = await query(
    `SELECT id, semana, anio, periodo, activa, fecha_inicio, fecha_cierre, creado_por, created_at
     FROM ${qid(SCHEMA)}.semana_control
     WHERE periodo = $1
     ORDER BY id DESC
     LIMIT 1`,
    [periodo]
  );

  if (!semanaRowRes.rows.length) return null;
  const semanaRow = semanaRowRes.rows[0];

  const snapsRes = await query(
    `SELECT tabla, obra_id, avance, estatus, semana, anio, fecha, nombre_sitio, programa, direccion_general
     FROM ${qid(SCHEMA)}.snapshots_semanales
     WHERE semana = $1 AND anio = $2
     ORDER BY tabla, obra_id`,
    [String(semanaRow.semana), semanaRow.anio]
  );

  const snapshots = snapsRes.rows;
  const total = snapshots.length;
  const actualizadas = snapshots.filter((s) => {
    const est = String(s.estatus || "").toUpperCase();
    return est.includes("ENTREGAD") || est.includes("TERMINAD");
  }).length;

  return {
    periodo: semanaRow.periodo,
    fecha_cierre: semanaRow.fecha_cierre || semanaRow.created_at,
    semana: semanaRow.semana,
    anio: semanaRow.anio,
    resumen: {
      total_obras: total,
      actualizadas,
      no_actualizadas: Math.max(0, total - actualizadas),
      porcentaje_actualizacion: total > 0 ? +((actualizadas / total) * 100).toFixed(2) : 0,
    },
    snapshot_obras: snapshots.map((s) => ({
      id: s.obra_id,
      tabla: s.tabla,
      porcentaje_avance: Number(s.avance || 0),
      estado: s.estatus,
      nombre: s.nombre_sitio || `Obra #${s.obra_id}`,
      programa: s.programa || s.tabla,
      direccion_general: s.direccion_general || null,
      confirmado_por: null,
    })),
  };
}

module.exports = {
  SEMANA_MINIMA,
  getSemanaISO,
  assertSemanaPermitida,
  getSemanaActiva,
  ensureSemanaInicial,
  generarSnapshot,
  iniciarSemana,
  listarPeriodosSemana,
  obtenerCortePorPeriodo,
};
