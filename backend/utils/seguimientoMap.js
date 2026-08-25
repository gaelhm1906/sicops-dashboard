/**
 * utils/seguimientoMap.js
 * Mapa programa → DG de seguimiento, derivado del nombre de las tablas en BD.
 * Misma lógica que obrasCtrl.js — garantiza consistencia entre módulos.
 *
 * "EL BALON VUELVE AL BARRIO DGPEST" → { "EL BALON VUELVE AL BARRIO": "DGPEST" }
 */

const { listarTablas } = require("../config/pg");

const CODIGOS_DG = [
  "DGCOP","DGOIV","DGOT","DGPEST","DGSUS",
  "ILIFE","IECM","FIDERE","SACMEX","DGODU",
];

const TABLA_DG_MAP = {
  "COMUNIDAD SEGURA":                           "DGSUS",
  "PARQUES ALEGRIA":                            "DGSUS",
  "YOLOTL ANAHUAC":                             "DGSUS",
  "ILUMINACION DE CALLES DEL CENTRO HISTORICO": "DGSUS",
};

function extraerDGDeTabla(nombre) {
  const up = nombre.trim().toUpperCase();
  if (TABLA_DG_MAP[up]) return TABLA_DG_MAP[up];
  const palabras = up.split(/\s+/);
  const ultima   = palabras[palabras.length - 1];
  if (CODIGOS_DG.includes(ultima)) return ultima;
  for (const c of CODIGOS_DG) { if (up.includes(c)) return c; }
  return null;
}

function limpiarNombrePrograma(nombre) {
  const up       = nombre.trim().toUpperCase();
  const palabras = up.split(/\s+/);
  const ultima   = palabras[palabras.length - 1];
  return CODIGOS_DG.includes(ultima) ? palabras.slice(0, -1).join(" ").trim() : up;
}

let _cache = null;

async function getProgSeguimientoMap() {
  if (_cache) return _cache;
  try {
    const tablas = await listarTablas();
    const map    = {};
    for (const t of tablas) {
      const dg   = extraerDGDeTabla(t);
      const prog = limpiarNombrePrograma(t);
      if (dg && prog) map[prog] = dg;
    }
    _cache = map;
  } catch {
    _cache = {};
  }
  return _cache;
}

/**
 * Aplica el mapa programa→seguimiento a un array de rows de obras.
 * Reemplaza row.dg con el seguimiento correcto según el programa.
 * Si se pasa dgFilter, retorna sólo las filas cuyo seguimiento coincida.
 */
function applySegMap(rows, segMap, dgFilter) {
  return rows
    .map((r) => {
      const progKey = (r.programa || "").trim().toUpperCase();
      const seg     = segMap[progKey] || r.dg || "SIN SEGUIMIENTO";
      return { ...r, dg: seg };
    })
    .filter((r) => !dgFilter || r.dg === dgFilter);
}

module.exports = { getProgSeguimientoMap, applySegMap };
