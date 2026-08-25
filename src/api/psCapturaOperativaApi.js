/**
 * api/psCapturaOperativaApi.js
 * Cliente para el grupo 1 de captura real (Etapa 1): Fuerza de trabajo
 * (REQ-09), Turnos (REQ-10), Verificación de insumos (REQ-11),
 * Generadores de obra (REQ-12). Mismo `psFetch` que el resto.
 */
import { psFetch } from "./psContratosApi";

export async function getFuerzaTrabajoServidor(obraId, fecha) {
  return psFetch(`/api/captura/fuerza-trabajo/${obraId}${fecha ? `?fecha=${fecha}` : ""}`);
}
export async function putFuerzaTrabajoServidor(obraId, frentes, fecha) {
  return psFetch(`/api/captura/fuerza-trabajo/${obraId}${fecha ? `?fecha=${fecha}` : ""}`, { method: "PUT", body: JSON.stringify({ frentes }) });
}

export async function getTurnosServidor(obraId, fecha) {
  return psFetch(`/api/captura/turnos/${obraId}${fecha ? `?fecha=${fecha}` : ""}`);
}
export async function postTurnoServidor(obraId, { turno, reporteNombre }) {
  return psFetch(`/api/captura/turnos/${obraId}`, { method: "POST", body: JSON.stringify({ turno, reporteNombre }) });
}

export async function getInsumosServidor(obraId) {
  return psFetch(`/api/captura/insumos/${obraId}`);
}
export async function putInsumosServidor(obraId, insumos) {
  return psFetch(`/api/captura/insumos/${obraId}`, { method: "PUT", body: JSON.stringify({ insumos }) });
}

export async function getGeneradoresServidor(obraId) {
  return psFetch(`/api/captura/generadores/${obraId}`);
}
export async function putGeneradoresServidor(obraId, frentes) {
  return psFetch(`/api/captura/generadores/${obraId}`, { method: "PUT", body: JSON.stringify({ frentes }) });
}

export async function getAvanceFisicoServidor(obraId) {
  return psFetch(`/api/captura/avance-fisico/${obraId}`);
}
export async function putEjecucionServidor(obraId, ejecucion) {
  return psFetch(`/api/captura/avance-fisico/${obraId}/ejecucion`, { method: "PUT", body: JSON.stringify(ejecucion) });
}
export async function putAvanceSemanaServidor(obraId, numero, avanceReal, fuente) {
  return psFetch(`/api/captura/avance-fisico/${obraId}/semana/${numero}`, { method: "PUT", body: JSON.stringify({ avanceReal, fuente }) });
}

export async function getQuincenasServidor(obraId) {
  return psFetch(`/api/captura/programa-quincenas/${obraId}`);
}
export async function putQuincenasServidor(obraId, quincenas) {
  return psFetch(`/api/captura/programa-quincenas/${obraId}`, { method: "PUT", body: JSON.stringify({ quincenas }) });
}

export async function getEstimacionesServidor(obraId) {
  return psFetch(`/api/captura/avance-financiero/${obraId}`);
}
export async function putEstimacionesServidor(obraId, estimaciones) {
  return psFetch(`/api/captura/avance-financiero/${obraId}/estimaciones`, { method: "PUT", body: JSON.stringify({ estimaciones }) });
}

export async function getCatalogoConceptosServidor(obraId) {
  return psFetch(`/api/captura/catalogo-conceptos/${obraId}`);
}
export async function putPartidasServidor(obraId, partidas) {
  return psFetch(`/api/captura/catalogo-conceptos/${obraId}/partidas`, { method: "PUT", body: JSON.stringify({ partidas }) });
}
export async function putCatalogoConceptosServidor(obraId, estado) {
  return psFetch(`/api/captura/catalogo-conceptos/${obraId}/catalogo`, { method: "PUT", body: JSON.stringify(estado) });
}
