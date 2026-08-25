/**
 * Backfill de historico curado de FRENTES (UTOPIAS) hacia la tabla hija
 * dedicada sig_sobse.snapshots_frentes_utopias (migración 008) — NUNCA hacia
 * snapshots_semanales, que es compartida con obras normales.
 *
 * REQUIERE que la migración 008_snapshots_frentes_utopias.sql ya se haya
 * aplicado en el servidor antes de correr --execute.
 *
 * Cada fila insertada queda marcada con origen='backfill' y curacion_run_id
 * (la corrida de la herramienta de curación de la que vino) — a diferencia
 * del diseño anterior, esto SÍ distingue qué insertó el backfill de lo que
 * capture el cron en vivo (origen='cron'), y permite revertir con precisión:
 *   DELETE FROM snapshots_frentes_utopias WHERE origen = 'backfill';
 *
 * NO SE EJECUTA SOLO. Por defecto corre en modo --dry-run (solo imprime qué
 * insertaría, sin tocar la base de datos). Requiere --execute explícito para
 * escribir, y --execute solo debe usarse después de:
 *   1. Aplicar la migración 008 (CREATE TABLE snapshots_frentes_utopias).
 *   2. Llenar scripts/utopias_clave_mapping.json (ver --discover abajo).
 *   3. Revisar la salida en modo dry-run.
 *
 * Fuente de datos curados: data/historico_curado_export.json (export plano
 * generado en LOCAL con `node src/exportar_historico.js` dentro de
 * utopias_curacion — ese export sí usa node:sqlite, pero corre en una
 * máquina con Node 24, nunca en el servidor). El servidor de producción
 * corre Node 18, que no tiene node:sqlite — este script nunca abre el .db
 * directamente, solo lee el JSON ya resuelto (la corrida MÁS RECIENTE por
 * utopía, ya extraída por el export).
 *
 * IMPORTANTE — escala de avance: uto_2025.avance_real se guarda en decimal
 * 0-1 (toDecimal() en utopiasController.js). La captura semanal dedicada
 * (generarSnapshotFrentesUtopias en semanaService.js) NO escala nada (graba
 * el valor crudo de la columna). El histórico curado, en cambio, está
 * normalizado a 0-100 (ver utopias_curacion/src/parser.js). Por eso aquí se
 * divide /100 antes de insertar — si no se hiciera, habría un salto de
 * escala falso exactamente en la frontera entre el backfill y las semanas
 * capturadas en vivo.
 *
 * Modo --discover: SOLO LECTURA, lista clave_unica/nombre_obra distintos en
 * uto_2025 para ayudar a llenar utopias_clave_mapping.json. Es seguro de
 * correr en cualquier momento (no escribe nada), pero igual requiere que el
 * usuario decida cuándo conectarse a producción.
 *
 * Uso:
 *   node scripts/backfill_frentes_utopias.js --discover
 *   node scripts/backfill_frentes_utopias.js --dry-run
 *   node scripts/backfill_frentes_utopias.js --execute
 */
const path = require("path");
const fs = require("fs");
// config/pg.js no carga dotenv por si solo (solo server.js lo hace) — este
// script corre standalone, fuera del ciclo normal de la app, asi que tiene
// que cargarlo el mismo antes de requerir config/pg, o el Pool de pg arranca
// con DB_PASSWORD undefined (falla SASL al autenticar).
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { query, SCHEMA } = require("../config/pg");

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

// Misma fórmula ISO-8601 que semanaService.js getSemanaISO() — duplicada
// aquí a propósito (este script vive fuera del ciclo normal de request/cron,
// no se justifica importar semanaService solo por esto).
function getSemanaISO(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return { semana: week, anio: temp.getUTCFullYear() };
}

const MAPPING_PATH = path.join(__dirname, "utopias_clave_mapping.json");
// JSON plano exportado desde la herramienta de curacion (node src/exportar_historico.js
// en utopias_curacion, que sí corre en Node 24 con node:sqlite). El servidor de
// produccion tiene Node 18 — sin node:sqlite — por eso este script NUNCA abre
// el .db directamente, solo lee este export ya resuelto.
const HISTORICO_EXPORT_PATH =
  process.env.HISTORICO_EXPORT_PATH || path.join(__dirname, "historico_curado_export.json");

function normName(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

async function discover() {
  const res = await query(
    `SELECT DISTINCT clave_unica, nombre_obra, COUNT(*) AS n_frentes
     FROM ${qid(SCHEMA)}.uto_2025
     GROUP BY clave_unica, nombre_obra
     ORDER BY nombre_obra`
  );
  console.log("clave_unica\tnombre_obra\tn_frentes");
  for (const r of res.rows) console.log(`${r.clave_unica}\t${r.nombre_obra}\t${r.n_frentes}`);
  console.log(`\nCopiar los clave_unica correctos a ${MAPPING_PATH}`);
}

function cargarMapping() {
  if (!fs.existsSync(MAPPING_PATH)) {
    console.error(`Falta ${MAPPING_PATH}. Correr primero --discover y llenarlo.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
}

function cargarHistoricoCurado() {
  if (!fs.existsSync(HISTORICO_EXPORT_PATH)) {
    console.error(`No se encontró ${HISTORICO_EXPORT_PATH}. Generarlo en local con:\n  cd utopias_curacion && node src/exportar_historico.js\ny subir data/historico_curado_export.json aquí (o ajustar con env HISTORICO_EXPORT_PATH).`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(HISTORICO_EXPORT_PATH, "utf8"));
}

// El catalogo de homologacion con criterio_desambiguacion produce nombres
// canonicos compuestos "NombreBase — CONTRATO" (ver resolverCanonico() en
// utopias_curacion/src/homologacion.js, mismo separador " — "). Esos nombres
// nunca van a aparecer asi en uto_2025.frente (que solo tiene el nombre base)
// — hay que partirlos y matchear por (frente, contrato) en vez de por frente
// solo, o el backfill los reporta como sinMatch permanentemente.
function partirCanonicoCompuesto(frenteCanonico) {
  const i = frenteCanonico.indexOf(" — ");
  if (i === -1) return null;
  return { base: frenteCanonico.slice(0, i), valor: frenteCanonico.slice(i + 3) };
}

async function construirPlan() {
  const mapping = cargarMapping();
  const curado = cargarHistoricoCurado();
  const plan = []; // { utopia_id, clave_unica, frente_canonico, frente_id_real, semana, anio, fecha, avance }
  const sinClave = [];
  const sinMatch = new Map(); // "utopia::frente_canonico" -> count

  for (const [utopiaId, frenteFilas] of Object.entries(curado)) {
    const claveUnica = mapping[utopiaId];
    if (!claveUnica) { sinClave.push(utopiaId); continue; }

    const liveRes = await query(
      `SELECT id, frente, contrato, empresa FROM ${qid(SCHEMA)}.uto_2025 WHERE clave_unica = $1`,
      [claveUnica]
    );
    const liveIdPorNombre = new Map(liveRes.rows.map((r) => [normName(r.frente), r.id]));
    const liveIdPorNombreYContrato = new Map(
      liveRes.rows.map((r) => [`${normName(r.frente)}::${normName(r.contrato)}`, r.id]),
    );
    const liveIdPorNombreYEmpresa = new Map(
      liveRes.rows.map((r) => [`${normName(r.frente)}::${normName(r.empresa)}`, r.id]),
    );

    for (const fila of frenteFilas.filas) {
      const compuesto = partirCanonicoCompuesto(fila.frente_canonico);
      const liveId = compuesto
        ? (liveIdPorNombreYContrato.get(`${normName(compuesto.base)}::${normName(compuesto.valor)}`)
           ?? liveIdPorNombreYEmpresa.get(`${normName(compuesto.base)}::${normName(compuesto.valor)}`))
        : liveIdPorNombre.get(normName(fila.frente_canonico));
      if (liveId == null) {
        const k = `${utopiaId}::${fila.frente_canonico}`;
        sinMatch.set(k, (sinMatch.get(k) || 0) + 1);
        continue;
      }
      const fecha = new Date(fila.semana + "T12:00:00Z");
      const { semana, anio } = getSemanaISO(fecha);
      plan.push({
        utopia_id: utopiaId,
        clave_unica: claveUnica,
        frente_canonico: fila.frente_canonico,
        frente_id_real: liveId,
        curacion_run_id: frenteFilas.curacion_run_id,
        semana, anio,
        fecha: fila.semana,
        avance: fila.avance_real / 100, // 0-100 curado -> 0-1 decimal (ver comentario de cabecera)
      });
    }
  }
  return { plan, sinClave, sinMatch };
}

async function dryRun() {
  const { plan, sinClave, sinMatch } = await construirPlan();
  console.log(`Filas a insertar: ${plan.length}`);
  const porUtopia = {};
  for (const p of plan) porUtopia[p.utopia_id] = (porUtopia[p.utopia_id] || 0) + 1;
  console.table(porUtopia);

  if (sinClave.length) {
    console.warn("\nUtopías SIN clave_unica en el mapping (no se procesaron):", sinClave);
  }
  if (sinMatch.size) {
    console.warn("\nFrentes curados que NO encontraron coincidencia exacta en la tabla viva (no se insertan, requieren revisión manual):");
    for (const [k, n] of sinMatch) console.warn(`  ${k} (${n} semanas omitidas)`);
  }
  console.log("\nDry-run completo. Nada se escribió en la base de datos.");
}

async function ejecutar() {
  const { plan, sinClave, sinMatch } = await construirPlan();
  const forzar = process.argv.includes("--skip-unmatched");
  if (sinClave.length) {
    console.error("Hay utopías sin clave_unica en el mapping. Resolver antes de --execute. Abortando.");
    process.exit(1);
  }
  if (sinMatch.size && !forzar) {
    console.error(`Hay ${sinMatch.size} series sin coincidencia en la tabla viva (ver --dry-run para el detalle). Si ya se revisaron y se acepta omitirlas, correr de nuevo con --execute --skip-unmatched. Abortando.`);
    process.exit(1);
  }
  if (sinMatch.size) {
    console.warn(`Omitiendo ${sinMatch.size} series sin coincidencia en la tabla viva (--skip-unmatched activo) — no se insertan, no se pierden datos ya existentes, solo no se backfillea esa serie especifica.`);
  }

  let insertados = 0;
  for (const p of plan) {
    const res = await query(
      `INSERT INTO ${qid(SCHEMA)}.snapshots_frentes_utopias
         (clave_unica, frente_id, frente_nombre, avance, estatus, semana, anio, fecha, origen, curacion_run_id)
       VALUES ($1, $2, $3, $4, 'EN PROCESO', $5, $6, $7, 'backfill', $8)
       ON CONFLICT (frente_id, semana, anio) DO NOTHING
       RETURNING frente_id`,
      [p.clave_unica, p.frente_id_real, p.frente_canonico, p.avance, String(p.semana), p.anio, p.fecha, p.curacion_run_id]
    );
    if (res.rows.length > 0) insertados++;
  }
  console.log(`Backfill ejecutado. ${insertados} filas insertadas de ${plan.length} planeadas (las demás ya existían — ON CONFLICT DO NOTHING).`);
  console.log(`Para revertir SOLO este backfill: DELETE FROM ${qid(SCHEMA)}.snapshots_frentes_utopias WHERE origen = 'backfill';`);
}

async function main() {
  const mode = process.argv[2] || "--dry-run";
  if (mode === "--discover") return discover();
  if (mode === "--dry-run") return dryRun();
  if (mode === "--execute") return ejecutar();
  console.error("Uso: node backfill_frentes_utopias.js [--discover|--dry-run|--execute]");
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
