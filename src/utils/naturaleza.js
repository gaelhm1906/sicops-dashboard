/**
 * utils/naturaleza.js
 * Taxonomía de "naturaleza" de actividad — capa de UX sobre el catálogo de
 * 20 requerimientos, para que la cola de trabajo se lea por TIPO de tarea
 * (Design System v2). No sustituye `categoria`/`tipoCaptura` del catálogo
 * oficial; es una vista derivada para agrupar visualmente.
 *
 * Dos ajustes deliberados respecto a `categoria`:
 *  - REQ-15 (avance físico) se lee como Verificación (trabajo de campo),
 *    no como Financiero.
 *  - REQ-18 (informe de visitas de asesores) se lee como Visita.
 */

export const NATURALEZA = {
  VISITA: "visita",
  REPORTE: "reporte",
  EVIDENCIA: "evidencia",
  VERIFICACION: "verificacion",
  FINANCIERO: "financiero",
};

export const NATURALEZA_INFO = {
  [NATURALEZA.VISITA]:       { label: "Visitas",        orden: 0 },
  [NATURALEZA.VERIFICACION]: { label: "Verificaciones",  orden: 1 },
  [NATURALEZA.EVIDENCIA]:    { label: "Evidencias",      orden: 2 },
  [NATURALEZA.FINANCIERO]:   { label: "Financiero",      orden: 3 },
  [NATURALEZA.REPORTE]:      { label: "Reportes",        orden: 4 },
};

const NATURALEZA_POR_REQ = {
  "REQ-07": NATURALEZA.EVIDENCIA,
  "REQ-08": NATURALEZA.EVIDENCIA,
  "REQ-20": NATURALEZA.EVIDENCIA,
  "REQ-09": NATURALEZA.VERIFICACION,
  "REQ-10": NATURALEZA.VERIFICACION,
  "REQ-11": NATURALEZA.VERIFICACION,
  "REQ-12": NATURALEZA.VERIFICACION,
  "REQ-15": NATURALEZA.VERIFICACION,
  "REQ-13": NATURALEZA.FINANCIERO,
  "REQ-14": NATURALEZA.FINANCIERO,
  "REQ-16": NATURALEZA.FINANCIERO,
  "REQ-18": NATURALEZA.VISITA,
};

/** Naturaleza de un requerimiento del catálogo — Reporte es el default. */
export function getNaturaleza(reqId) {
  return NATURALEZA_POR_REQ[reqId] || NATURALEZA.REPORTE;
}
