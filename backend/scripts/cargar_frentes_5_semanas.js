/**
 * Carga de las ultimas semanas verificadas de UTOPIAS hacia
 * sig_sobse.snapshots_frentes_utopias, reemplazando el backfill completo
 * anterior (origen='backfill') para las 11 utopias activas (no inauguradas).
 * Ceylan, Magdalena Mixihuca y Eduardo Molina quedan fuera a proposito
 * (inauguradas, fuera de alcance de seguimiento por ahora).
 *
 * Fuente: data/carga_5_semanas_export.json (generado en LOCAL por
 * utopias_curacion/scripts/cargar_5_semanas.js, solo lectura de Excel,
 * ya filtrado de duplicados exactos y archivos contaminados — ver analisis
 * 2026-06-25). Sube ese JSON a backend/scripts/ antes de correr esto.
 *
 * Uso:
 *   node scripts/cargar_frentes_5_semanas.js --dry-run
 *   node scripts/cargar_frentes_5_semanas.js --execute --delete-previo
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { query, pool, SCHEMA } = require("../config/pg");

const EXPORT_PATH = path.join(__dirname, "carga_5_semanas_export.json");

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}
function stripAccents(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function normName(s) { return stripAccents(s).toUpperCase().replace(/\s+/g, " ").trim(); }
function claveFrente(frente, contrato) {
  const c = String(contrato || "").trim();
  return c ? `${normName(frente)}::${c}` : normName(frente);
}

function cargarExport() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error(`No se encontró ${EXPORT_PATH}. Generarlo en local con:\n  cd utopias_curacion && node scripts/cargar_5_semanas.js\ny subir data/carga_5_semanas_export.json aquí.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
}

async function construirPlan() {
  const porUtopia = cargarExport();
  const claves = Object.keys(porUtopia);
  const plan = [];
  const sinMatch = new Map();
  const resumen = [];

  for (const clave of claves) {
    const liveRes = await query(
      `SELECT id, frente, contrato FROM ${qid(SCHEMA)}.uto_2025 WHERE clave_unica = $1`,
      [clave]
    );
    const liveIdPorClave = new Map(liveRes.rows.map((r) => [claveFrente(r.frente, r.contrato), r.id]));

    let nFilas = 0;
    for (const f of porUtopia[clave]) {
      const k = claveFrente(f.frente, f.contrato);
      const frenteId = liveIdPorClave.get(k);
      if (!frenteId) {
        const key = `${clave}::${k}`;
        sinMatch.set(key, (sinMatch.get(key) || 0) + 1);
        continue;
      }
      plan.push({
        clave_unica: clave,
        frente_id: frenteId,
        frente_nombre: f.frente,
        avance: f.avance_real,
        estatus: f.estatus,
        semana: f.semana,
        anio: f.anio,
        fecha: f.fecha,
      });
      nFilas++;
    }
    resumen.push({ clave, planeadas: nFilas, en_export: porUtopia[clave].length });
  }
  return { plan, sinMatch, resumen, claves };
}

async function dryRun() {
  const { plan, sinMatch, resumen } = await construirPlan();
  console.log("Filas a insertar:", plan.length);
  console.table(resumen);
  if (sinMatch.size) {
    console.log("\nSin coincidencia en uto_2025 vivo (no se insertan):");
    for (const [k, n] of sinMatch) console.log(" ", k, `(${n}x)`);
  }
  console.log("\nDry-run completo. Nada se escribió en la base de datos.");
}

async function ejecutar() {
  const { plan, sinMatch, claves } = await construirPlan();
  const eliminarPrevio = process.argv.includes("--delete-previo");
  if (plan.length === 0) {
    console.error("Plan vacío. Abortando.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (eliminarPrevio) {
      const del = await client.query(
        `DELETE FROM ${qid(SCHEMA)}.snapshots_frentes_utopias WHERE origen = 'backfill' AND clave_unica = ANY($1::text[])`,
        [claves]
      );
      console.log(`Eliminadas ${del.rowCount} filas previas (origen='backfill') de las utopías en el export.`);
    }

    let insertados = 0;
    for (const p of plan) {
      const res = await client.query(
        `INSERT INTO ${qid(SCHEMA)}.snapshots_frentes_utopias
           (clave_unica, frente_id, frente_nombre, avance, estatus, semana, anio, fecha, origen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'backfill')
         ON CONFLICT (frente_id, semana, anio) DO NOTHING
         RETURNING id`,
        [p.clave_unica, p.frente_id, p.frente_nombre, p.avance, p.estatus, p.semana, p.anio, p.fecha]
      );
      if (res.rows.length) insertados++;
    }

    await client.query("COMMIT");
    console.log(`Insertadas ${insertados} de ${plan.length} filas planeadas.`);
    console.log(`Series omitidas por falta de match en uto_2025 vivo: ${sinMatch.size}`);
    console.log(
      "Revertir: DELETE FROM sig_sobse.snapshots_frentes_utopias WHERE origen = 'backfill' AND clave_unica = ANY(ARRAY[" +
        claves.map((c) => `'${c}'`).join(",") +
        "]);"
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const mode = process.argv[2] || "--dry-run";
  if (mode === "--dry-run") await dryRun();
  else if (mode === "--execute") await ejecutar();
  else {
    console.error("Uso: node cargar_frentes_5_semanas.js [--dry-run | --execute [--delete-previo]]");
    process.exit(1);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
