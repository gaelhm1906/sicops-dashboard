/**
 * utils/cambiosProyecto.js — REQ-03.
 * Estatus sí/no de cambios de proyecto en la semana; cuando hay cambios,
 * cada uno se registra con descripción y categorización por especialidad
 * (mismo catálogo de 5 especialidades que Entrega de proyecto ejecutivo).
 * Persistencia MOCK en localStorage, namespaced por obra.
 */
import { ESPECIALIDADES_PROYECTO } from "./proyectoEjecutivo";

const PREFIX = "cambios_proyecto::";

export { ESPECIALIDADES_PROYECTO };

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function getCambios(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardar(obraKey, cambios) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(cambios));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return cambios;
}

export function agregarCambio(obraKey, { especialidadId, descripcion }) {
  const cambios = getCambios(obraKey);
  const nuevo = { id: `cambio-${Date.now()}`, fecha: hoyISO(), especialidadId, descripcion: descripcion.trim() };
  return guardar(obraKey, [nuevo, ...cambios]);
}

export function eliminarCambio(obraKey, id) {
  return guardar(obraKey, getCambios(obraKey).filter((c) => c.id !== id));
}
