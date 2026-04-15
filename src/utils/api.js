/**
 * utils/api.js
 * Cliente HTTP con JWT automático.
 * Conecta el frontend con el backend en http://localhost:3001/api
 */

const BASE_URL = "http://localhost:3001/api";

// ── Token helpers ──────────────────────────────────────────────────
export const getToken   = () => localStorage.getItem("token");
export const setToken   = (t) => localStorage.setItem("token", t);
export const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("sicops_user");
};

// ── Normaliza obra backend → frontend ─────────────────────────────
// Backend: porcentaje_avance, fecha_actualizacion, usuario_responsable, confirmado_por
// Frontend: porcentaje, ultimaActualizacion, usuario
export function normalizeObra(o) {
  if (!o) return null;
  return {
    id:                  o.id,
    direccion_general:   o.direccion_general ?? null,
    nombre:              o.nombre,
    programa:            o.programa,
    porcentaje:          o.porcentaje_avance ?? o.porcentaje ?? 0,
    estado:              o.estado,
    ultimaActualizacion: o.fecha_actualizacion ?? o.ultimaActualizacion ?? null,
    usuario:             o.confirmado_por ?? o.usuario_responsable ?? o.usuario ?? null,
    // Campos extra del backend (para auditoría)
    usuario_responsable: o.usuario_responsable ?? null,
    confirmado_por:      o.confirmado_por ?? null,
  };
}

// ── Wrapper fetch central ──────────────────────────────────────────
async function apiCall(method, endpoint, body = null) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const config = {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (networkErr) {
    const err = new Error("No se pudo conectar con el servidor. Verifique que el backend esté corriendo.");
    err.code = "NETWORK_ERROR";
    throw err;
  }

  // 401 → limpiar sesión y redirigir
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || "Error en la solicitud");
    err.code   = data.code   || data.codigo || null;
    err.codigo = data.codigo || data.code   || null;
    err.status = response.status;
    err.data   = data;
    throw err;
  }

  return data;
}

// ── Wrapper para endpoints PG/Dashboard/Geo ───────────────────────
// Igual que apiCall pero NO redirige en 401: lanza error y deja que
// el llamador active el fallback local.
async function pgApiCall(method, endpoint, body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const config = {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (networkErr) {
    const err = new Error("No se pudo conectar con el servidor.");
    err.code = "NETWORK_ERROR";
    throw err;
  }

  // 401 → NO redirigir, solo loggear y lanzar para activar fallback
  if (response.status === 401) {
    console.warn("[SICOPS] Token inválido o no presente — activando fallback local");
    const err = new Error("Token inválido o no presente");
    err.code   = "TOKEN_MISSING";
    err.status = 401;
    throw err;
  }

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || "Error en la solicitud");
    err.code   = data.code   || null;
    err.status = response.status;
    throw err;
  }

  return data;
}

// ── Descarga de archivo (CSV / JSON) desde el backend ─────────────
async function downloadFromAPI(endpoint, filename) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor al descargar.");
  }
  if (!response.ok) throw new Error("Error al descargar el archivo");
  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Auth API ───────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password) => {
    const data = await apiCall("POST", "/auth/login", { email, password });
    if (data.token) setToken(data.token);
    return data; // { success, token, user: { id, email, nombre, rol } }
  },
  logout: async () => {
    try { await apiCall("POST", "/auth/logout", {}); } catch { /* ignorar */ }
    clearToken();
    window.location.href = "/login";
  },
  me: () => apiCall("GET", "/auth/me"),
};

// ── Obras API ──────────────────────────────────────────────────────
export const obrasAPI = {
  getAll: async (filtros = {}) => {
    const clean  = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "")
    );
    const params = new URLSearchParams(clean);
    const res    = await apiCall("GET", `/obras?${params}`);
    return { ...res, data: (res.data || []).map(normalizeObra) };
  },

  getById: async (id) => {
    const res = await apiCall("GET", `/obras/${id}`);
    return { ...res, data: normalizeObra(res.data) };
  },

  editar: (id, porcentaje_nuevo, motivo = "") =>
    apiCall("POST", `/obras/${id}/editar`, { porcentaje_nuevo, motivo }),

  confirmarStep1: (id, cambio_id) =>
    apiCall("POST", `/obras/${id}/confirmar/step1`, { cambio_id }),

  confirmarStep2: (id, cambio_id, codigo_verbal) =>
    apiCall("POST", `/obras/${id}/confirmar/step2`, { cambio_id, codigo_verbal }),

  actualizarAvance: (id, avance, motivo = "") =>
    apiCall("PUT", `/obras/${id}/avance`, { avance, motivo }),

  getHistorico: (periodo) => {
    const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";
    return apiCall("GET", `/obras/historico${qs}`);
  },
};

// ── Control API ────────────────────────────────────────────────────
export const controlAPI = {
  getEstado: () => apiCall("GET", "/control/estado"),
  abrir:     () => apiCall("POST", "/control/abrir", {}),
  cerrar:    () => apiCall("POST", "/control/cerrar", {}),
};

export const sistemaAPI = {
  getEstado: () => apiCall("GET", "/sistema/estado"),
  toggle:    () => apiCall("POST", "/sistema/toggle", {}),
};

// ── Reportes API ───────────────────────────────────────────────────
export const reportesAPI = {
  getPeriodos: () => apiCall("GET", "/reportes/periodos"),

  getCorte: (periodo) =>
    apiCall("GET", `/reportes/corte?periodo=${encodeURIComponent(periodo)}`),

  descargar: (periodo, formato = "csv") =>
    downloadFromAPI(
      `/reportes/descargar?periodo=${encodeURIComponent(periodo)}&formato=${formato}`,
      `corte-${periodo}.${formato}`
    ),
};

// ── PostgreSQL obras API ───────────────────────────────────────────
export const pgObrasAPI = {
  getAll: async (filtros = {}) => {
    const clean  = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "")
    );
    const params = new URLSearchParams(clean);
    const res    = await pgApiCall("GET", `/pg/obras?${params}`);
    return { ...res, data: (res.data || []).map(normalizeObra) };
  },
};

// ── Dashboard / stats API ──────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => pgApiCall("GET", "/dashboard"),
};

// ── GeoJSON API ────────────────────────────────────────────────────
export const geoAPI = {
  getFeatures: async (filtros = {}) => {
    const clean  = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "")
    );
    const params = new URLSearchParams(clean);
    return pgApiCall("GET", `/geo?${params}`);
  },
};

// ── Compatibilidad con código anterior ────────────────────────────
// ListadoObras llama getProgramas() sincrónicamente a nivel de módulo
export function getProgramas() {
  return [
    "Programa de Bienestar Social",
    "Programa de Infraestructura Vial",
    "Programa de Senderos y Espacios Públicos",
    "Programa de Equipamiento Comunitario",
    "Programa de Conectividad Rural",
  ];
}

// Vacíos — mantenidos para no romper imports existentes
export function getCortes()  { return []; }
export function getObras()   { return []; }
export function getObraById() { return null; }
