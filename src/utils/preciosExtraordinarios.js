/**
 * utils/preciosExtraordinarios.js — REQ-14.
 * Bitácora de solicitudes de precio extraordinario por obra: fecha de
 * ingreso, descripción, cantidad, monto, estatus de autorización (con
 * monto autorizado) y fecha de autorización. El objetivo explícito de la
 * minuta es medir cuántas ingresan y cuánto tardan en dictaminarse — por
 * eso `diasEnRevision` se calcula siempre, no se captura a mano.
 * Ajuste de reunión con el Secretario (12 de agosto, sesión DGCOP): esta
 * pareja de fechas es justo lo que pidió Anayeli para medir el tiempo de
 * dictaminación — ya existía, solo estaba nombrada "fecha de liberación"
 * en vez de "fecha de autorización".
 * Persistencia MOCK en localStorage, namespaced por obra.
 */
const PREFIX = "precios_extraordinarios::";

export const ESTATUS_AUTORIZACION = {
  PENDIENTE: "pendiente",
  AUTORIZADO: "autorizado",
  RECHAZADO: "rechazado",
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function getSolicitudes(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardar(obraKey, solicitudes) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(solicitudes));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return solicitudes;
}

export function agregarSolicitud(obraKey, datos) {
  const solicitudes = getSolicitudes(obraKey);
  const nueva = {
    id: `precio-${Date.now()}`,
    fechaIngreso: datos.fechaIngreso || hoyISO(),
    descripcion: datos.descripcion || "",
    cantidad: datos.cantidad || "",
    monto: Number(datos.monto) || 0,
    estatus: ESTATUS_AUTORIZACION.PENDIENTE,
    montoAutorizado: null,
    fechaAutorizacion: null,
  };
  return guardar(obraKey, [nueva, ...solicitudes]);
}

export function actualizarSolicitud(obraKey, id, cambios) {
  const solicitudes = getSolicitudes(obraKey).map((s) => (s.id === id ? { ...s, ...cambios } : s));
  return guardar(obraKey, solicitudes);
}

export function eliminarSolicitud(obraKey, id) {
  return guardar(obraKey, getSolicitudes(obraKey).filter((s) => s.id !== id));
}

/** Días entre el ingreso y la liberación (o hoy, si sigue pendiente) */
export function diasEnRevision(solicitud) {
  const desde = new Date(solicitud.fechaIngreso + "T00:00:00");
  const hasta = new Date((solicitud.fechaAutorizacion || hoyISO()) + "T00:00:00");
  return Math.max(0, Math.round((hasta - desde) / 86400000));
}
