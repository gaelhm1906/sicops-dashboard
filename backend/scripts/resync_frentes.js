/**
 * Re-sincroniza los frentes de las utopias afectadas por el bug de indice
 * unico (clave_unica, frente) sin contrato (corregido en migracion 009).
 * Llama importarDesdeExcel() directo (sin pasar por HTTP/auth), con los
 * datos actuales exportados desde los Excel del tablero (ver
 * utopias_curacion/scripts/exportar_resync.js).
 *
 * Uso: node scripts/resync_frentes.js
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { query, SCHEMA } = require("../config/pg");
const { importarDesdeExcel } = require("../controllers/utopiasController");

const EXPORT_PATH = path.join(__dirname, "resync_export.json");

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function contarFrentes(clave) {
  const r = await query(`SELECT COUNT(*) AS n FROM ${qid(SCHEMA)}.uto_2025 WHERE clave_unica = $1`, [clave]);
  return Number(r.rows[0].n);
}

function fakeRes() {
  const res = {};
  res.status = () => res;
  res.json = (body) => { res.body = body; };
  return res;
}

async function main() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error(`No se encontró ${EXPORT_PATH}. Generarlo en local con utopias_curacion/scripts/exportar_resync.js y subirlo aquí.`);
    process.exit(1);
  }
  const porUtopia = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));

  for (const [clave, frentes] of Object.entries(porUtopia)) {
    const antes = await contarFrentes(clave);
    const res = fakeRes();
    await importarDesdeExcel({ body: { utopia_id: clave, nombre_obra: clave, semana: "", usuario: "resync_manual", frentes } }, res);
    const despues = await contarFrentes(clave);
    console.log(
      `${clave}: insertados=${res.body?.insertados ?? "?"} actualizados=${res.body?.actualizados ?? "?"} omitidos=${res.body?.omitidos ?? "?"} | filas en BD antes=${antes} despues=${despues} (+${despues - antes})`
    );
    if (res.body?.errores?.length) console.warn("  errores:", res.body.errores);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
