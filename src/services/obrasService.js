/**
 * services/obrasService.js
 * Funciones de acceso directo a la API SICOPS desplegada en Render.
 * Usadas como alternativa tipada a la capa utils/api.js cuando se quiere
 * consumir los endpoints nuevos sin pasar por el adaptador GIS.
 */
import { API_BASE_URL } from "../config/api";

function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
}

function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token && !token.startsWith("local-")) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Verifica que el backend está disponible.
 * GET /health → { success: true, service: "SICOPS API", ... }
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check falló: ${res.status}`);
  return res.json();
}

/**
 * Obtiene todas las obras de una tabla específica del schema sig_sobse.
 * GET /api/obras?tabla=NOMBRE_TABLA
 * @param {string} tabla - Nombre exacto de la tabla en PostgreSQL
 */
export async function getObras(tabla) {
  const res = await fetch(
    `${API_BASE_URL}/api/obras?tabla=${encodeURIComponent(tabla)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} al cargar tabla ${tabla}`);
  }
  return res.json();
}

/**
 * Actualiza el avance de una obra directamente en PostgreSQL.
 * PUT /api/obras/update
 * @param {{ tabla: string, id: number|string, nombre: string, avance: number, usuario: string, motivo?: string }} payload
 */
export async function updateObra(payload) {
  const res = await fetch(`${API_BASE_URL}/api/obras/update`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al actualizar obra`);
  return data;
}

export async function inaugurarObra(payload) {
  const res = await fetch(`${API_BASE_URL}/api/obras/inaugurar`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al inaugurar obra`);
  return data;
}

export async function cancelarObra(payload) {
  const res = await fetch(`${API_BASE_URL}/api/obras/cancelar`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status} al cancelar obra`);
  return data;
}

/**
 * Inicia el flujo de edición de 3 pasos (genera cambio_id).
 * POST /api/obras/:id/editar
 */
export async function iniciarEdicion(id, porcentaje_nuevo, motivo = "", tabla = null, permitirRepetido = false) {
  const res = await fetch(`${API_BASE_URL}/api/obras/${id}/editar`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ porcentaje_nuevo, motivo, tabla, permitirRepetido }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Error al iniciar edición");
  return data;
}

/**
 * Paso 1 de confirmación: valida cambio_id.
 * POST /api/obras/:id/confirmar/step1
 */
export async function confirmarStep1(id, cambio_id) {
  const res = await fetch(`${API_BASE_URL}/api/obras/${id}/confirmar/step1`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ cambio_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Error en confirmación paso 1");
  return data;
}

/**
 * Paso 2 de confirmación: requiere código verbal "CONFIRMO".
 * POST /api/obras/:id/confirmar/step2
 */
export async function confirmarStep2(id, cambio_id, codigo_verbal) {
  const res = await fetch(`${API_BASE_URL}/api/obras/${id}/confirmar/step2`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ cambio_id, codigo_verbal }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Error en confirmación paso 2");
  return data;
}
