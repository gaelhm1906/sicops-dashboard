const { Pool } = require("pg");
const logger = require("../middleware/logger");

const SCHEMA = process.env.DB_SCHEMA || "sig_sobse";

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX || "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT_MS || "8000", 10),
      options: `-c search_path=${SCHEMA},public`,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "sig_sobse",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT_MS || "8000", 10),
      options: `-c search_path=${SCHEMA},public`,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  logger.error("pg-pool", `Error inesperado en cliente idle: ${err.message}`);
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function testConnection() {
  try {
    const res = await query(`
      SELECT
        NOW() AS ahora,
        current_database() AS base_datos,
        current_schema() AS esquema,
        version() AS version_pg
    `);
    const { ahora, base_datos, esquema, version_pg } = res.rows[0];
    const pgVersion = version_pg.split(" ").slice(0, 2).join(" ");
    logger.info("pg", `Conectado ${base_datos}/${esquema} - ${pgVersion} - ${ahora}`);
    return true;
  } catch (err) {
    logger.error("pg", `No se pudo conectar a PostgreSQL (${process.env.DB_HOST}:${process.env.DB_PORT}): ${err.message}`);
    return false;
  }
}

async function listarTablas() {
  const res = await query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns')
      ORDER BY table_name
    `,
    [SCHEMA]
  );
  return res.rows.map((row) => row.table_name);
}

async function columnasDe(tabla) {
  const res = await query(
    `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [SCHEMA, tabla]
  );
  return res.rows;
}

async function inicializarDB() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.auditoria (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accion TEXT,
        usuario TEXT,
        tabla TEXT,
        obra_id INTEGER,
        porcentaje_anterior NUMERIC(6,2),
        porcentaje_nuevo NUMERIC(6,2),
        delta NUMERIC(6,2),
        motivo TEXT,
        fecha_inauguracion DATE,
        motivo_cancelacion TEXT,
        ip TEXT,
        "ESTATUS ANTERIOR" TEXT,
        "ESTATUS NUEVO" TEXT,
        "NOMBRE DEL SITIO INTERVENIDO" TEXT,
        semana INTEGER,
        anio INTEGER
      )
    `);

    for (const sql of [
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS accion TEXT`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS "ESTATUS ANTERIOR" TEXT`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS "ESTATUS NUEVO" TEXT`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS "NOMBRE DEL SITIO INTERVENIDO" TEXT`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS fecha_inauguracion DATE`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS semana INTEGER`,
      `ALTER TABLE ${SCHEMA}.auditoria ADD COLUMN IF NOT EXISTS anio INTEGER`,
    ]) {
      await query(sql);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.semana_control (
        id SERIAL PRIMARY KEY,
        semana INTEGER,
        anio INTEGER,
        periodo TEXT,
        activa BOOLEAN DEFAULT true,
        fecha_inicio TIMESTAMP,
        fecha_cierre TIMESTAMP,
        creado_por TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.snapshots_semanales (
        id SERIAL PRIMARY KEY,
        tabla TEXT,
        obra_id INTEGER,
        avance REAL,
        estatus TEXT,
        semana TEXT,
        anio INTEGER,
        fecha TIMESTAMP,
        nombre_sitio TEXT,
        programa TEXT,
        direccion_general TEXT,
        captured_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    for (const sql of [
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS avance REAL`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS anio INTEGER`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS fecha TIMESTAMP`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS nombre_sitio TEXT`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS programa TEXT`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS direccion_general TEXT`,
      `ALTER TABLE ${SCHEMA}.snapshots_semanales ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NOW()`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS semana INTEGER`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS anio INTEGER`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS periodo TEXT`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMP`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS creado_por TEXT`,
      `ALTER TABLE ${SCHEMA}.semana_control ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    ]) {
      await query(sql);
    }

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS snapshots_semanales_tabla_obra_semana_anio_uidx
      ON ${SCHEMA}.snapshots_semanales (tabla, obra_id, semana, anio)
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.sistema_estado (
        id SERIAL PRIMARY KEY,
        activo BOOLEAN DEFAULT true,
        modo VARCHAR(20) DEFAULT 'manual',
        actualizado_por TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      INSERT INTO ${SCHEMA}.sistema_estado (activo, modo)
      SELECT true, 'manual'
      WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.sistema_estado)
    `);

    await query(`
      INSERT INTO ${SCHEMA}.semana_control (
        semana,
        anio,
        periodo,
        activa,
        fecha_inicio,
        creado_por
      )
      SELECT 3, 2026, '2026-W3', true, NOW(), 'migracion_inicial'
      WHERE NOT EXISTS (
        SELECT 1 FROM ${SCHEMA}.semana_control WHERE semana = 3 AND anio = 2026
      )
    `);

    logger.info("pg", "Base de datos inicializada: auditoria, semana_control, snapshots_semanales, sistema_estado");
  } catch (err) {
    logger.error("pg", `Error en inicializarDB: ${err.message}`);
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  inicializarDB,
  listarTablas,
  columnasDe,
  SCHEMA,
};
