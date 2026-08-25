/**
 * utils/calculoSemanas.js
 * Desglose automático de un contrato en semanas naturales lunes-domingo,
 * respetando semanas parciales al inicio y al cierre — el usuario solo
 * captura días naturales (fecha inicio/término); el sistema hace el resto.
 * Funciones puras, sin dependencias de UI ni de storage.
 */

function toDateOnly(str) {
  if (!str) return null;
  const d = new Date(`${str}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/* Día ISO: lunes=1 … domingo=7 */
function isoDay(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Genera la curva de semanas de un contrato a partir de sus fechas.
 * Cada semana trae ya calculado el % programado (avance lineal esperado
 * a esa fecha) — el usuario solo necesita llenar el % real observado.
 */
export function generarSemanasAutomaticas(fechaInicioStr, fechaTerminoStr) {
  const inicio = toDateOnly(fechaInicioStr);
  const termino = toDateOnly(fechaTerminoStr);
  if (!inicio || !termino || termino < inicio) return [];

  const totalDias = Math.round((termino - inicio) / 86400000) + 1;
  const semanas = [];
  let cursor = new Date(inicio);
  let numero = 1;

  while (cursor <= termino) {
    const diasHastaDomingo = 7 - isoDay(cursor);
    let finSemana = addDays(cursor, diasHastaDomingo);
    if (finSemana > termino) finSemana = new Date(termino);

    const diasTranscurridos = Math.round((finSemana - inicio) / 86400000) + 1;
    const avanceProgramado = Math.min(100, Math.round((diasTranscurridos / totalDias) * 100));

    semanas.push({
      numero,
      periodoDel: toISO(cursor),
      periodoAl: toISO(finSemana),
      avanceProgramado,
    });

    cursor = addDays(finSemana, 1);
    numero++;
  }

  return semanas;
}

/** Días naturales totales entre dos fechas (inclusive) — dato único que pide la minuta */
export function diasNaturales(fechaInicioStr, fechaTerminoStr) {
  const inicio = toDateOnly(fechaInicioStr);
  const termino = toDateOnly(fechaTerminoStr);
  if (!inicio || !termino || termino < inicio) return 0;
  return Math.round((termino - inicio) / 86400000) + 1;
}

/**
 * Ubica en qué semana cae una fecha (avance financiero, sección 10.6: "a
 * partir de la fecha de entrega de cada estimación, el sistema ubica el
 * porcentaje acumulado en la semana correspondiente").
 */
export function ubicarSemana(semanas, fechaStr) {
  const fecha = toDateOnly(fechaStr);
  if (!fecha) return null;
  return semanas.find((s) => toDateOnly(s.periodoDel) <= fecha && fecha <= toDateOnly(s.periodoAl)) || null;
}

/**
 * Genera UNA semana adicional más allá del plazo contractual (minuta 3ª
 * reunión, "Presentación de avances", punto 3 — extensión automática por
 * desfase): sigue la misma cuadrícula lunes-domingo que
 * generarSemanasAutomaticas, arrancando en `fechaInicioStr` (el día
 * siguiente al cierre de la última semana conocida). El programado va
 * fijo en 100% — en estas semanas ya no hay nada programado que cumplir,
 * solo falta que el avance real las alcance.
 */
export function generarSemanaExtendida(numero, fechaInicioStr) {
  const inicio = toDateOnly(fechaInicioStr);
  if (!inicio) return null;
  const diasHastaDomingo = 7 - isoDay(inicio);
  const finSemana = addDays(inicio, diasHastaDomingo);
  return { numero, periodoDel: toISO(inicio), periodoAl: toISO(finSemana), avanceProgramado: 100 };
}
