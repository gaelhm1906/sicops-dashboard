/**
 * config/pg.js
 * Pool de conexiones PostgreSQL / PostGIS para sig_sobse.
 *
 * Expone:
 *   pool          → pool de conexiones listo para usar
 *   testConnection() → valida la conexión al iniciar el servidor
 *   query(sql, params) → helper para consultas directas
 */

const { Pool } = require("pg");
const logger   = require("../middleware/logger");

const SCHEMA = process.env.DB_SCHEMA || "sig_sobse";

/* ── Configuración del pool ── */
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME     || "sig_sobse",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl:      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,

  max:                     parseInt(process.env.DB_POOL_MAX   || "10", 10),
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT_MS || "8000", 10),

  // Establecer search_path para que las tablas sin esquema se resuelvan en sig_sobse
  options: `-c search_path=${SCHEMA},public`,
});

/* ── Errores inesperados del pool (cliente ya liberado) ── */
pool.on("error", (err) => {
  logger.error("pg-pool", `Error inesperado en cliente idle: ${err.message}`);
});

/* ── Helper query ── */
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Verifica la conexión al iniciar el servidor.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const res = await query(`
      SELECT
        NOW()              AS ahora,
        current_database() AS base_datos,
        current_schema()   AS esquema,
        version()          AS version_pg
    `);
    const { ahora, base_datos, esquema, version_pg } = res.rows[0];
    const pgVersion = version_pg.split(" ").slice(0, 2).join(" ");
    logger.info("pg", `✓ Conectado — ${base_datos}/${esquema} — ${pgVersion} — ${ahora}`);
    return true;
  } catch (err) {
    logger.error("pg", `✗ No se pudo conectar a PostgreSQL (${process.env.DB_HOST}:${process.env.DB_PORT}): ${err.message}`);
    return false;
  }
}

/**
 * Devuelve todas las tablas del schema sig_sobse.
 * @returns {Promise<string[]>}
 */
async function listarTablas() {
  const res = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type   = 'BASE TABLE'
      AND table_name NOT IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns')
    ORDER BY table_name
  `, [SCHEMA]);
  return res.rows.map((r) => r.table_name);
}

/**
 * Devuelve columnas de una tabla con su tipo de dato.
 * @param {string} tabla
 * @returns {Promise<{ column_name: string, data_type: string }[]>}
 */
async function columnasDe(tabla) {
  const res = await query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name   = $2
    ORDER BY ordinal_position
  `, [SCHEMA, tabla]);
  return res.rows;
}

module.exports = { pool, query, testConnection, listarTablas, columnasDe, SCHEMA };
