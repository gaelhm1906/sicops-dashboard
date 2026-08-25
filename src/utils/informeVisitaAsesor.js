/**
 * utils/informeVisitaAsesor.js — REQ-18.
 * Informe de visitas de obra de los Asesores Estructuristas: distinto del
 * módulo de Visitas (cuota diaria de check-ins por rol) — este es un
 * requerimiento normal más, semanal, con estatus sí/no de si la visita
 * se realizó y un reporte general adjunto. Persistencia MOCK en
 * localStorage, namespaced por obra.
 */
const PREFIX = "informe_visita_asesor::";

const ESTADO_VACIO = { visitaRealizada: null, reporteGeneral: "", archivoNombre: null, fecha: null };

export function getInforme(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? { ...ESTADO_VACIO, ...JSON.parse(raw) } : { ...ESTADO_VACIO };
  } catch {
    return { ...ESTADO_VACIO };
  }
}

export function guardarInforme(obraKey, datos) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(datos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return datos;
}
