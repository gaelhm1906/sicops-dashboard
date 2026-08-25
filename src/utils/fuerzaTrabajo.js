/**
 * utils/fuerzaTrabajo.js — REQ-09.
 * Captura diaria de trabajadores por frente. Ajuste de minuta (sesión de
 * revisión #7, corregido): el detalle no es un total suelto por frente
 * — dentro de cada frente se registra por OFICIO (albañiles, herreros,
 * electricistas...), en texto libre para no encasillar el oficio en un
 * catálogo cerrado. El total del frente y el total del día son la suma
 * automática de sus oficios. Persistencia MOCK en localStorage,
 * namespaced por obra + día (como las visitas).
 *
 * Ajuste de reunión con el Secretario (12 de agosto, sesión Cablebús):
 * un frente completo puede tener personal asignado sin que sea obra
 * física — el caso citado fue una estación con 56 personas, todas
 * haciendo estudios, no construcción. Ese personal no debe contarse
 * como fuerza de trabajo de obra ni inflar el avance físico. Cada
 * frente ahora lleva un `tipo` ("obra" | "estudios"); por defecto
 * "obra" para no romper los frentes ya capturados antes de este ajuste.
 */
import { esSesionReal } from "./seguimiento";
import { getFuerzaTrabajoServidor, putFuerzaTrabajoServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "fuerza_trabajo::";

/* obraKey (string) -> obraId (numérico, ps_sicops_final) — se registra una
   vez al abrir la pantalla (ver hidratarFuerzaTrabajoDesdeServidor) para
   que guardarFrentes() sepa a qué obra real sincronizar sin que cada una
   de las 6 funciones de mutación tenga que recibir/pasar el id. */
const obraIdsConocidos = new Map();

export const TIPO_FRENTE = {
  OBRA: "obra",
  ESTUDIOS: "estudios",
};

export const TIPO_FRENTE_INFO = {
  [TIPO_FRENTE.OBRA]: { label: "Obra" },
  [TIPO_FRENTE.ESTUDIOS]: { label: "Estudios" },
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function clave(obraKey) {
  return `${PREFIX}${obraKey}::${hoyISO()}`;
}

function normalizarFrente(f) {
  return {
    ...f,
    oficios: Array.isArray(f.oficios) ? f.oficios : [],
    tipo: f.tipo === TIPO_FRENTE.ESTUDIOS ? TIPO_FRENTE.ESTUDIOS : TIPO_FRENTE.OBRA,
  };
}

export function getFrentesHoy(obraKey) {
  try {
    const raw = localStorage.getItem(clave(obraKey));
    const frentes = raw ? JSON.parse(raw) : [];
    return frentes.map(normalizarFrente);
  } catch {
    return [];
  }
}

function guardarFrentes(obraKey, frentes) {
  try {
    localStorage.setItem(clave(obraKey), JSON.stringify(frentes));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putFuerzaTrabajoServidor(obraId, frentes).catch(() => {});
  }
  return frentes;
}

/* Sesión PS real: trae el estado real del servidor (del día de hoy) y lo
   escribe en localStorage antes de que la pantalla lea nada — y registra
   el obraId para que guardarFrentes() sincronice de vuelta en cada
   cambio. No hace nada para el resto de sesiones. */
export async function hidratarFuerzaTrabajoDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidos.set(obraKey, obraId);
  try {
    const { frentes } = await getFuerzaTrabajoServidor(obraId);
    if (frentes?.length) {
      localStorage.setItem(clave(obraKey), JSON.stringify(frentes));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

export function agregarFrente(obraKey, nombre, tipo = TIPO_FRENTE.OBRA) {
  const frentes = getFrentesHoy(obraKey);
  const nuevo = {
    id: `frente-${Date.now()}`,
    nombre: nombre.trim(),
    tipo: tipo === TIPO_FRENTE.ESTUDIOS ? TIPO_FRENTE.ESTUDIOS : TIPO_FRENTE.OBRA,
    oficios: [],
  };
  return guardarFrentes(obraKey, [...frentes, nuevo]);
}

export function eliminarFrente(obraKey, frenteId) {
  return guardarFrentes(obraKey, getFrentesHoy(obraKey).filter((f) => f.id !== frenteId));
}

export function cambiarTipoFrente(obraKey, frenteId, tipo) {
  const frentes = getFrentesHoy(obraKey).map((f) =>
    f.id === frenteId ? { ...f, tipo: tipo === TIPO_FRENTE.ESTUDIOS ? TIPO_FRENTE.ESTUDIOS : TIPO_FRENTE.OBRA } : f
  );
  return guardarFrentes(obraKey, frentes);
}

export function agregarOficio(obraKey, frenteId, nombreOficio, trabajadores) {
  const limpio = (nombreOficio || "").trim();
  if (!limpio) return getFrentesHoy(obraKey);
  const frentes = getFrentesHoy(obraKey).map((f) =>
    f.id === frenteId
      ? { ...f, oficios: [...f.oficios, { id: `oficio-${Date.now()}`, nombre: limpio, trabajadores: Number(trabajadores) || 0 }] }
      : f
  );
  return guardarFrentes(obraKey, frentes);
}

export function actualizarOficio(obraKey, frenteId, oficioId, trabajadores) {
  const frentes = getFrentesHoy(obraKey).map((f) =>
    f.id === frenteId
      ? { ...f, oficios: f.oficios.map((o) => (o.id === oficioId ? { ...o, trabajadores: Number(trabajadores) || 0 } : o)) }
      : f
  );
  return guardarFrentes(obraKey, frentes);
}

export function eliminarOficio(obraKey, frenteId, oficioId) {
  const frentes = getFrentesHoy(obraKey).map((f) =>
    f.id === frenteId ? { ...f, oficios: f.oficios.filter((o) => o.id !== oficioId) } : f
  );
  return guardarFrentes(obraKey, frentes);
}

export function totalFrente(frente) {
  return frente.oficios.reduce((acc, o) => acc + (Number(o.trabajadores) || 0), 0);
}

export function totalTrabajadores(frentes) {
  return frentes.reduce((acc, f) => acc + totalFrente(f), 0);
}

/** Total de trabajadores, pero solo de los frentes de un `tipo` dado —
 * así "estudios" nunca se suma al avance físico de obra. */
export function totalTrabajadoresPorTipo(frentes, tipo) {
  return frentes.filter((f) => f.tipo === tipo).reduce((acc, f) => acc + totalFrente(f), 0);
}
