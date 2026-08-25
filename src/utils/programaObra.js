/**
 * utils/programaObra.js
 * Motor de conversión de avance programado quincenal → semanal (minuta de
 * definición técnica de Supervisión Externa, sección 8 — el punto de
 * mayor complejidad técnica y el que hoy genera más errores en Excel).
 *
 * Las empresas entregan su programa de obra por quincenas; la
 * Subsecretaría requiere el informe semanal. Captura del usuario, por
 * cada quincena: periodo (del/al) y % PROGRAMADO ACUMULADO que indica su
 * programa (ej. 8%, 25%, 49%, 100% — no incrementos, el acumulado tal
 * cual aparece en el programa de obra).
 *
 * Lógica de conversión:
 * 1. Incremento de cada quincena = %acumulado de esta quincena − el de
 *    la anterior (0 para la primera).
 * 2. Tasa diaria de la quincena = incremento ÷ días de esa quincena.
 * 3. Avance de cada semana = Σ, por cada quincena que la semana toca,
 *    (tasa diaria de esa quincena × días que la semana toma de ella).
 * 4. El acumulado corre semana a semana hasta llegar a 100%.
 *
 * Funciones puras para el cálculo; persistencia MOCK en localStorage
 * para la captura de quincenas.
 */
import { esSesionReal } from "./seguimiento";
import { getQuincenasServidor, putQuincenasServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "programa_obra::";

const obraIdsConocidos = new Map();

function toDate(str) {
  const d = new Date(`${str}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasEntre(delStr, alStr) {
  const del = toDate(delStr);
  const al = toDate(alStr);
  if (!del || !al || al < del) return 0;
  return Math.round((al - del) / 86400000) + 1;
}

function diasTraslapados(aDel, aAl, bDel, bAl) {
  const a1 = toDate(aDel), a2 = toDate(aAl), b1 = toDate(bDel), b2 = toDate(bAl);
  if (!a1 || !a2 || !b1 || !b2) return 0;
  const inicio = a1 > b1 ? a1 : b1;
  const fin = a2 < b2 ? a2 : b2;
  if (fin < inicio) return 0;
  return Math.round((fin - inicio) / 86400000) + 1;
}

/* ── Captura de quincenas por obra ─────────────────────────────────── */

export function getQuincenas(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* Sesión PS real: trae las quincenas ya registradas en el servidor y
   registra el obraId para que guardar() sincronice de vuelta. No hace
   nada para el resto de sesiones. */
export async function hidratarQuincenasDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidos.set(obraKey, obraId);
  try {
    const { quincenas } = await getQuincenasServidor(obraId);
    if (quincenas?.length) {
      localStorage.setItem(PREFIX + obraKey, JSON.stringify(quincenas));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

function guardar(obraKey, quincenas) {
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putQuincenasServidor(obraId, quincenas).catch(() => {});
  }
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(quincenas));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return quincenas;
}

/* `Date.now()` solo no basta como id: cuando se crean varias quincenas
   en el mismo ciclo síncrono (ver generarQuincenasAutomaticas llamado en
   bucle desde la UI), varias caen en el mismo milisegundo y terminan con
   el MISMO id — resultado: editar una edita todas las que colisionaron.
   El sufijo aleatorio elimina la colisión sin depender del reloj. */
function idUnico(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function agregarQuincena(obraKey, { del, al, pctAcumulado }) {
  const actuales = getQuincenas(obraKey);
  const nueva = { id: idUnico("quincena"), del, al, pctAcumulado: Number(pctAcumulado) || 0 };
  return guardar(obraKey, [...actuales, nueva].sort((a, b) => new Date(a.del) - new Date(b.del)));
}

export function eliminarQuincena(obraKey, id) {
  return guardar(obraKey, getQuincenas(obraKey).filter((q) => q.id !== id));
}

export function actualizarQuincena(obraKey, id, cambios) {
  const actuales = getQuincenas(obraKey).map((q) => (q.id === id ? { ...q, ...cambios } : q));
  return guardar(obraKey, actuales);
}

/**
 * Genera automáticamente los TRAMOS de quincena (fechas) a partir de la
 * fecha de inicio y los días naturales del contrato — tramos de 15 días,
 * el último absorbe el resto. Solo arma el esqueleto de fechas; el %
 * acumulado de cada quincena lo sigue capturando el usuario (es dato del
 * programa de obra real, no algo que el sistema pueda inventar). No
 * reemplaza la captura manual — es un punto de partida editable.
 */
export function generarQuincenasAutomaticas(fechaInicioISO, diasNaturales) {
  const inicio = toDate(fechaInicioISO);
  let restantes = Number(diasNaturales) || 0;
  if (!inicio || restantes <= 0) return [];

  const tramos = [];
  let cursor = new Date(inicio);
  while (restantes > 0) {
    const duracion = restantes > 15 ? 15 : restantes;
    const fin = new Date(cursor);
    fin.setDate(fin.getDate() + duracion - 1);
    tramos.push({ del: cursor.toISOString().slice(0, 10), al: fin.toISOString().slice(0, 10) });
    cursor = new Date(fin);
    cursor.setDate(cursor.getDate() + 1);
    restantes -= duracion;
  }
  return tramos;
}

/* ── Conversión quincenal → semanal ────────────────────────────────── */

/**
 * @param {Array<{numero, periodoDel, periodoAl}>} semanas — de generarSemanasAutomaticas()
 * @param {Array<{del, al, pctAcumulado}>} quincenasCrudas — captura del usuario
 * @returns semanas con `avanceProgramado` (acumulado, %) ya calculado
 */
export function calcularProgramadoPorSemana(semanas, quincenasCrudas) {
  const quincenas = [...quincenasCrudas].sort((a, b) => new Date(a.del) - new Date(b.del));

  let pctAnterior = 0;
  const quincenasConTasa = quincenas.map((q) => {
    const dias = diasEntre(q.del, q.al);
    const pct = Number(q.pctAcumulado) || 0;
    const incremento = Math.max(0, pct - pctAnterior);
    pctAnterior = pct;
    return { ...q, dias, tasaDiaria: dias > 0 ? incremento / dias : 0 };
  });

  let acumulado = 0;
  return semanas.map((semana) => {
    let incrementoSemana = 0;
    for (const q of quincenasConTasa) {
      const traslape = diasTraslapados(semana.periodoDel, semana.periodoAl, q.del, q.al);
      if (traslape > 0) incrementoSemana += q.tasaDiaria * traslape;
    }
    acumulado = Math.min(100, acumulado + incrementoSemana);
    return { ...semana, avanceProgramado: Math.round(acumulado * 100) / 100 };
  });
}
