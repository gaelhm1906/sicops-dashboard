/**
 * utils/generadoresObra.js — REQ-12.
 * Generadores organizados por FRENTE de trabajo y, dentro de cada frente,
 * por PARTIDA técnica. Los frentes ya reportados en semanas anteriores
 * quedan precargados — no se vuelven a crear cada semana, solo se
 * actualiza el estatus sí/no de sus partidas. Persistencia MOCK en
 * localStorage, namespaced por obra — el catálogo de frentes es continuo
 * entre semanas, solo se actualiza el estatus de sus partidas.
 */
import { esSesionReal } from "./seguimiento";
import { getGeneradoresServidor, putGeneradoresServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "generadores_obra::";

export const PARTIDAS_GENERADORES = ["Cimentación", "Estructura", "Albañilería", "Instalaciones", "Acabados"];

const obraIdsConocidos = new Map();

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function partidasVacias() {
  return Object.fromEntries(PARTIDAS_GENERADORES.map((p) => [p, { entregado: false, fecha: null }]));
}

export function getFrentes(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardar(obraKey, frentes) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(frentes));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putGeneradoresServidor(obraId, frentes).catch(() => {});
  }
  return frentes;
}

/* Sesión PS real: trae los frentes/partidas ya registrados en el servidor
   y registra el obraId para que guardar() sincronice de vuelta. No hace
   nada para el resto de sesiones. */
export async function hidratarGeneradoresDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidos.set(obraKey, obraId);
  try {
    const { frentes } = await getGeneradoresServidor(obraId);
    if (frentes?.length) {
      localStorage.setItem(PREFIX + obraKey, JSON.stringify(frentes));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

export function agregarFrente(obraKey, nombre) {
  const frentes = getFrentes(obraKey);
  const nuevo = { id: `frente-${Date.now()}`, nombre: nombre.trim(), partidas: partidasVacias() };
  return guardar(obraKey, [...frentes, nuevo]);
}

export function actualizarPartida(obraKey, frenteId, partida, entregado) {
  const frentes = getFrentes(obraKey).map((f) =>
    f.id === frenteId
      ? { ...f, partidas: { ...f.partidas, [partida]: { entregado, fecha: entregado ? hoyISO() : null } } }
      : f
  );
  return guardar(obraKey, frentes);
}

export function resumenFrente(frente) {
  const valores = Object.values(frente.partidas);
  const entregadas = valores.filter((p) => p.entregado).length;
  return { entregadas, total: valores.length };
}

export function resumenObra(frentes) {
  return frentes.reduce(
    (acc, f) => {
      const r = resumenFrente(f);
      return { entregadas: acc.entregadas + r.entregadas, total: acc.total + r.total };
    },
    { entregadas: 0, total: 0 }
  );
}
