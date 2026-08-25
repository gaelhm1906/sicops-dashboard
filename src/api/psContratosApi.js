/**
 * api/psContratosApi.js
 * Cliente para la API de PS_SICOPS_FINAL (contratos/obras) — sistema nuevo,
 * base de datos y autenticación separadas del backend actual de SICOPS.
 * Ver backend/DISENO_BD_PS_SICOPS_FINAL.md para el contexto completo.
 */

function resolveBaseUrl() {
  return (typeof window !== "undefined" && window.__CONFIG__?.PS_API_URL) || "http://localhost:3004";
}

export const PS_BASE_URL = resolveBaseUrl();
const TOKEN_KEY = "ps_sicops_token";
const USER_KEY = "ps_sicops_user";

export function getPsToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getPsUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}
export function psLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function psFetch(path, options = {}) {
  const token = getPsToken();
  const res = await fetch(`${PS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Error ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function psLogin(usuario, password) {
  const data = await psFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ usuario, password }) });
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function listarPendientes() {
  return psFetch("/api/contratos/pendientes");
}

/* Obras que YA tiene vinculadas un contrato — se usa para precargar el
   picker de Paso 2 marcadas cuando se reabre un contrato multi-obra
   (Obra/Supervisión/Servicios) que ya tenía algunas, y así poder
   agregarle más sin tener que adivinar cuáles ya estaban. */
export async function obtenerObrasVinculadasDeContrato(contratoId) {
  return psFetch(`/api/contratos/${contratoId}/obras-vinculadas`);
}

export async function buscarObras(q, programaId) {
  const params = new URLSearchParams({ q: q || "" });
  if (programaId) params.set("programaId", programaId);
  return psFetch(`/api/obras/buscar?${params.toString()}`);
}

/* Universo completo de obras de la DG en sesión — alimenta la bandeja de
   "Mis pendientes" (utils/misPendientes.js), no un autocompletar. */
export async function listarTodasMisObras() {
  return psFetch("/api/obras/mias");
}

/* "Etapa 2": familia completa de contratos por obra (contrato de obra +
   supervisión + servicios + adquisiciones ya conectados) y el monto total
   combinado — no solo el checklist de vinculación, sino ver cómo quedó. */
export async function obtenerVinculados() {
  return psFetch("/api/obras/vinculados");
}

/* Marca (o quita, con `interna: false`) que una obra no tiene contrato de
   supervisión externa — la supervisa personal de SOBSE directamente. */
export async function marcarSupervisionInterna(obraId, interna = true) {
  return psFetch(`/api/obras/${obraId}/supervision-interna`, {
    method: "POST",
    body: JSON.stringify({ interna }),
  });
}

/* Nombre del Residente de Obra — texto libre, se sabe muchas veces desde
   antes de que exista una cuenta real de esa persona en el sistema. Se
   captura por obra en la pestaña "Vinculaciones", para vincularlo más
   adelante con el seguimiento. Enviar vacío/omitido lo borra. */
export async function guardarResidenteObra(obraId, residenteObra) {
  return psFetch(`/api/obras/${obraId}/residente-obra`, {
    method: "POST",
    body: JSON.stringify({ residenteObra }),
  });
}

/* Paso 1 — solo clasifica (elige o corrige el tipo). Se guarda de inmediato
   en BD, independiente de si ya hay obra elegida o no. */
export async function clasificarContrato(contratoId, tipoContrato) {
  return psFetch(`/api/contratos/${contratoId}/clasificar`, {
    method: "POST",
    body: JSON.stringify({ tipoContrato }),
  });
}

/* Paso 2 — vincula a obra(s). Requiere que el contrato ya tenga tipo
   guardado (Paso 1 hecho antes, en esta sesión o en una anterior). */
export async function vincularContrato(contratoId, { obraIds, direccionInterna }) {
  return psFetch(`/api/contratos/${contratoId}/vincular`, {
    method: "POST",
    body: JSON.stringify({ obraIds, direccionInterna }),
  });
}

/* Corrige un error de vinculación: quita el vínculo de una obra específica
   (no toca el tipo ya clasificado). El contrato vuelve a "Por clasificar"
   con el Paso 2 pendiente. */
export async function desvincularContrato(contratoId, obraId) {
  return psFetch(`/api/contratos/${contratoId}/desvincular`, {
    method: "POST",
    body: JSON.stringify({ obraId }),
  });
}
