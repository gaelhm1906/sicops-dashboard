/**
 * utils/api.js
 * Capa de acceso a la API SICOPS desplegada en Render.
 * Toda la información proviene de https://sicops-backend.onrender.com
 */

const DEFAULT_API_URL = "https://sigsobse-backend.onrender.com";

function stripTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const env = typeof process !== "undefined" ? process.env || {} : {};
  const envUrl =
    env.REACT_APP_API_URL ||
    env.REACT_APP_GIS_API_URL ||
    env.VITE_GIS_API_URL ||
    "";
  const runtimeUrl =
    typeof window !== "undefined"
      ? window.__CONFIG__?.API_URL || window.__GIS_CONFIG__?.API_BASE_URL
      : "";
  return stripTrailingSlash(envUrl || runtimeUrl || DEFAULT_API_URL);
}

export const BASE_URL = resolveApiBaseUrl();
export const API_BASE = BASE_URL;

/* ── Helpers de texto ── */
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeStatus(value, avance) {
  const status = normalizeText(value);
  if (status.includes("CANCELAD")) return "CANCELADO";
  if (status.includes("ENTREGAD") || status.includes("INAUGUR")) return "ENTREGADO";
  if (status.includes("TERMINAD") || status === "ACTUALIZADA") return "TERMINADO";
  if (status.includes("PROCESO") || status === "EN PROGRESO") return "EN PROCESO";
  if (status.includes("PENDIENT") || status.includes("SIN INICIAR")) return "SIN INICIAR";
  const n = Number(avance);
  if (Number.isFinite(n)) {
    if (n >= 100) return "TERMINADO";
    if (n > 0)   return "EN PROCESO";
  }
  return "SIN INICIAR";
}

function normalizePercent(value) {
  if (value === null || value === undefined || value === "") return 0;
  const clean = String(value).replace("%", "").replace(",", ".").trim();
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function getSafe(row, keys) {
  if (!row) return null;
  const normalizedIndex = Object.keys(row).reduce((acc, key) => {
    acc[normalizeText(key)] = key;
    return acc;
  }, {});
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
    const realKey = normalizedIndex[normalizeText(key)];
    if (realKey && row[realKey] !== undefined && row[realKey] !== null) return row[realKey];
  }
  return null;
}

function getGeometry(row, geometry) {
  if (geometry) return geometry;
  const lat = getSafe(row, ["lat", "latitud", "latitude", "y"]);
  const lng = getSafe(row, ["lng", "lon", "longitud", "longitude", "x"]);
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
    return { type: "Point", coordinates: [nLng, nLat] };
  }
  return null;
}

function getFeatureParts(feature) {
  const properties = feature?.properties || feature || {};
  const geometry = feature?.geometry || properties.geometry || null;
  return { properties, geometry };
}

export function normalizeObra(o, table = null) {
  if (!o) return null;
  const { properties, geometry } = getFeatureParts(o);
  const source = properties || {};
  const sourceTable =
    table ||
    getSafe(source, ["table", "tabla", "table_name", "layer", "capa"]) ||
    null;
  const rawId = getSafe(source, ["id", "gid", "objectid", "fid", "id_obra", "ID", "OBJECTID"]);
  const id = rawId ?? `${sourceTable || "gis"}-${Math.random().toString(36).slice(2)}`;
  const nombre =
    getSafe(source, [
      "NOMBRE DEL SITIO INTERVENIDO",
      "nombre",
      "nombre_obra",
      "nombre_proyecto",
      "descripcion",
      "proyecto",
      "obra",
    ]) || "SIN NOMBRE";
  const programa =
    getSafe(source, ["PROGRAMA", "programa", "nombre_programa"]) || sourceTable || "SIN PROGRAMA";
  const direccionGeneral = getSafe(source, [
    "DIRECCION GENERAL",
    "DIRECCIÓN GENERAL",
    "direccion_general",
    "dg",
  ]);
  const avance = normalizePercent(
    getSafe(source, [
      "AVANCE REAL",
      "avance_real",
      "avance",
      "AVANCE",
      "porcentaje_avance",
      "porcentaje",
      "avance_fisico",
    ])
  );
  const estatus = normalizeStatus(
    getSafe(source, ["ESTATUS", "estatus", "estado", "STATUS", "status"]),
    avance
  );
  const alcaldia         = getSafe(source, ["ALCALDIA", "ALCALDÍA", "alcaldia"]);
  const fechaActualizacion = getSafe(source, [
    "FECHA ACTUALIZACION",
    "fecha_actualizacion",
    "ultimaActualizacion",
    "updated_at",
  ]);
  const usuarioActualizacion = getSafe(source, [
    "USUARIO ACTUALIZACION",
    "usuario_actualizacion",
    "responsable",
    "usuario",
  ]);
  const motivoCancelacion = getSafe(source, ["MOTIVO CANCELACION", "motivo_cancelacion"]);
  const finalGeometry = getGeometry(source, geometry);

  return {
    ...source,
    id,
    id_obra: getSafe(source, ["id_obra"]) || id,
    uid: `${sourceTable || "GIS"}::${id}`,
    nombre,
    programa,
    direccion_general: direccionGeneral || null,
    estatus,
    estado: estatus,
    avance,
    avance_real: avance,
    porcentaje: avance,
    porcentaje_avance: avance,
    alcaldia: alcaldia || null,
    fecha_inicio: null,
    fecha_fin: null,
    fecha_actualizacion: fechaActualizacion || null,
    ultimaActualizacion: fechaActualizacion || null,
    usuario_actualizacion: usuarioActualizacion || null,
    motivo_cancelacion: motivoCancelacion || null,
    properties: source,
    geometry: finalGeometry,
    table: sourceTable,
    tabla: sourceTable,
  };
}

export const TABLAS_VALIDAS = [
  "123 POR MI ESCUELA DGCOP",
  "123 POR MI ESCUELA ILIFE",
  "ALBERGUES",
  "BALIZAMIENTO DE VIALIDADES",
  "BICIESTACIONAMIENTO DGCOP",
  "BICIESTACIONAMIENTOS DGOIV",
  "CAMINOS SEGUROS",
  "CANCHAS",
  "CAPTACION DE AGUA EN MERCADOS",
  "CASA DE LAS 3RS",
  "CETRAM",
  "CICLOVIA",
  "CLINICA CONDESA",
  "COMUNIDAD SEGURA",
  "CONSTRUCCION DE UTOPIAS",
  "ERUM Y DGIT",
  "ILUMINACION DE CALLES DEL CENTRO HISTORICO",
  "ILUMINACION DE EDIFICIOS DEL CENTRO HISTORICO",
  "LINEA DEL CABLEBUS",
  "MANTENIMIENTO A MERCADOS PUBLICOS",
  "MANTENIMIENTO A PUENTES PEATONALES",
  "MANTENIMIENTO A PUENTES VEHICULARES",
  "MANTENIMIENTO DE UTOPIAS",
  "MODERNIZACION DEL TREN LIGERO",
  "MODULOS DE POLICIA",
  "OBRAS ADICIONALES DGCOP",
  "OBRAS ADICIONANLES DGOIV",
  "PARQUE ELEVADO",
  "PARQUES ALEGRIA",
  "PASOS A DESNIVEL DGCOP",
  "PASOS A DESNIVEL DGOT",
  "REPAVIMENTACION DGOIV",
  "REPAVIMENTACION DGOT",
  "SENALIZACION HORIZONTAL MUNDIALISTA",
  "TROLEBUS RUTA 14",
  "UNIVERSIDAD DE LAS ARTES",
  "YOLOTL ANAHUAC",
];

const TABLAS_VALIDAS_NORMALIZADAS = new Set(TABLAS_VALIDAS.map(normalizeText));

export function esTablaValida(name) {
  return TABLAS_VALIDAS_NORMALIZADAS.has(normalizeText(name));
}

/* ── Token helpers ── */
export const getToken  = () => localStorage.getItem("token");
export const setToken  = (t) => localStorage.setItem("token", t);
export const clearToken = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("sicops_user");
  localStorage.removeItem("usuario");
};

function buildAuthHeaders() {
  const token = getToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/* ── Fetch nativo (sin interceptar) ── */
const nativeFetch =
  typeof window !== "undefined" && window.fetch
    ? window.fetch.bind(window)
    : (...args) => fetch(...args);

/* ── Cliente HTTP central ── */
async function apiCall(method, endpoint, body = null) {
  const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
  const response = await nativeFetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || `Error en API ${response.status}`);
    err.status = response.status;
    err.data   = data;
    throw err;
  }
  return data;
}

function colorPorEstatus(estatus, avance) {
  const n = Number(avance);
  if (String(estatus || "").toUpperCase().includes("ENTREGAD")) return "#2196f3";
  if (String(estatus || "").toUpperCase().includes("CANCELAD")) return "#6b7280";
  if (n > 70)  return "#4caf50";
  if (n >= 30) return "#ff9800";
  return "#f44336";
}

/* ─────────────────────────────────────────────────────────────
   CARGA DE OBRAS DESDE POSTGRESQL
   Llama GET /api/obras?tabla=X para cada tabla del schema,
   convierte cada fila al modelo normalizado.
───────────────────────────────────────────────────────────── */
export async function getObrasDesdeGIS() {
  const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };

  const results = await Promise.allSettled(
    TABLAS_VALIDAS.map(async (tabla) => {
      const res = await nativeFetch(
        `${API_BASE}/api/obras?tabla=${encodeURIComponent(tabla)}`,
        { headers }
      );
      if (!res.ok) return [];
      const json = await res.json().catch(() => ({}));
      if (!json.success) return [];
      return (json.data || [])
        .map((row) => normalizeObra({ ...row, tabla }, tabla))
        .filter(Boolean);
    })
  );

  const obras = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter(Boolean);

  if (obras.length === 0) {
    console.warn("[SICOPS] No se cargaron obras desde PostgreSQL. Verifique la configuración de la API.");
  }

  return obras;
}

/* ─────────────────────────────────────────────────────────────
   GEOJSON DESDE POSTGRESQL
   GET /api/geojson/obras?dg=X
   Fallback: construye FeatureCollection desde las obras cargadas.
───────────────────────────────────────────────────────────── */
export async function getGeoJsonDesdeGIS(filtros = {}) {
  try {
    const dg = filtros.dg ? encodeURIComponent(filtros.dg) : "";
    const qs = dg ? `?dg=${dg}` : "";
    const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
    const res = await nativeFetch(`${API_BASE}/api/geojson/obras${qs}`, { headers });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return await res.json();
  } catch {
    // Fallback: construir desde obras normalizadas
    const obras = await getObrasDesdeGIS();
    const dgNorm = filtros.dg ? normalizeText(filtros.dg) : "";
    const filtradas = dgNorm
      ? obras.filter((o) => normalizeText(o.direccion_general) === dgNorm)
      : obras;
    return {
      type: "FeatureCollection",
      features: filtradas
        .filter((o) => o.geometry)
        .map((o) => ({
          type: "Feature",
          geometry: o.geometry,
          properties: { ...o.properties, ...o },
        })),
    };
  }
}

/* ── apiFetch (uso público en componentes que lo importen directamente) ── */
export async function apiFetch(path) {
  const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
  const res = await nativeFetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error en API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/* ─────────────────────────────────────────────────────────────
   AUTENTICACIÓN
   POST /api/auth/login  → JWT real
   Fallback local cuando el backend no está disponible (desarrollo).
───────────────────────────────────────────────────────────── */
const USUARIOS_LOCALES = [
  { id: 1, nombre: "DGCOP",         usuario: "actualizacion_dgcop",  email: "actualizacion_dgcop",  password: "DGCOP_ACT_2026!",  rol: "ACTUALIZACION", activo: true, dg: "DGCOP"  },
  { id: 2, nombre: "DGOIV",         usuario: "actualizacion_dgoiv",  email: "actualizacion_dgoiv",  password: "DGOIV_ACT_2026!",  rol: "ACTUALIZACION", activo: true, dg: "DGOIV"  },
  { id: 3, nombre: "DGOT",          usuario: "actualizacion_dgot",   email: "actualizacion_dgot",   password: "DGOT_ACT_2026!",   rol: "ACTUALIZACION", activo: true, dg: "DGOT"   },
  { id: 4, nombre: "DGPEST",        usuario: "actualizacion_dgpest", email: "actualizacion_dgpest", password: "DGPEST_ACT_2026!", rol: "ACTUALIZACION", activo: true, dg: "DGPEST" },
  { id: 5, nombre: "DGAF",          usuario: "actualizacion_dgaf",   email: "actualizacion_dgaf",   password: "DGAF_ACT_2026!",   rol: "ACTUALIZACION", activo: true, dg: "DGAF"   },
  { id: 6, nombre: "DGSUS",         usuario: "actualizacion_dgsus",  email: "actualizacion_dgsus",  password: "DGSUS_ACT_2026!",  rol: "ACTUALIZACION", activo: true, dg: "DGSUS"  },
  { id: 7, nombre: "DGUS",          usuario: "actualizacion_dgus",   email: "actualizacion_dgus",   password: "DGUS_ACT_2026!",   rol: "ACTUALIZACION", activo: true, dg: "DGUS"   },
  { id: 8, nombre: "ILIFE",         usuario: "actualizacion_ilife",  email: "actualizacion_ilife",  password: "ILIFE_ACT_2026!",  rol: "ACTUALIZACION", activo: true, dg: "ILIFE"  },
  { id: 9, nombre: "Administrador", usuario: "admin",                email: "admin",                password: "2025tablero!",     rol: "ADMIN",         activo: true, dg: null     },
];

function crearSesionLocal(usuario) {
  const { password, ...user } = usuario;
  const token = `local-${user.usuario}-${Date.now()}`;
  setToken(token);
  localStorage.setItem("usuario", JSON.stringify(user));
  localStorage.setItem("sicops_user", JSON.stringify(user));
  return { success: true, token, user };
}

export const authAPI = {
  login: async (usuarioIngresado, passwordIngresado) => {
    /* Intentar autenticación real con el backend */
    try {
      const res = await nativeFetch(`${API_BASE}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario: usuarioIngresado, password: passwordIngresado }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.token) {
        setToken(data.token);
        const user = data.user || { usuario: usuarioIngresado, rol: "ACTUALIZACION" };
        localStorage.setItem("sicops_user", JSON.stringify(user));
        localStorage.setItem("usuario",     JSON.stringify(user));
        return { success: true, token: data.token, user };
      }

      /* Backend rechazó credenciales — mostrar error real */
      if (res.status === 401 || res.status === 400) {
        const err = new Error(data.message || "Usuario o contraseña incorrectos");
        err.code = "INVALID_CREDENTIALS";
        throw err;
      }
    } catch (apiErr) {
      /* Re-lanzar errores de credenciales inválidas sin intentar fallback local */
      if (apiErr.code === "INVALID_CREDENTIALS") throw apiErr;
      /* Error de red / backend caído → fallback local (solo desarrollo) */
      console.warn("[SICOPS] Backend no disponible, usando credenciales locales:", apiErr.message);
    }

    /* Fallback local (útil en desarrollo sin backend activo) */
    const usuario = USUARIOS_LOCALES.find(
      (item) => item.activo && item.usuario === usuarioIngresado && item.password === passwordIngresado
    );
    if (!usuario) {
      const err = new Error("Usuario o contraseña incorrectos");
      err.code = "INVALID_LOCAL_CREDENTIALS";
      throw err;
    }
    return crearSesionLocal(usuario);
  },

  logout: async () => { clearToken(); },

  me: async () => {
    const savedUser = localStorage.getItem("sicops_user") || localStorage.getItem("usuario");
    return { success: true, user: savedUser ? JSON.parse(savedUser) : null };
  },
};

/* ─────────────────────────────────────────────────────────────
   OBRAS — API PostgreSQL
───────────────────────────────────────────────────────────── */
export const obrasAPI = {
  getAll: async () => {
    const data = await getObrasDesdeGIS();
    return { success: true, data };
  },
  getById: async (id) => {
    const data = await getObrasDesdeGIS();
    return { success: true, data: data.find((o) => String(o.id) === String(id)) || null };
  },
  /* Flujo de 3 pasos — rutas PG */
  editar: (id, porcentaje_nuevo, motivo = "", tabla = null, permitirRepetido = false) =>
    apiCall("POST", `/api/obras/${id}/editar`, { porcentaje_nuevo, motivo, tabla, permitirRepetido }),
  confirmarStep1: (id, cambio_id) =>
    apiCall("POST", `/api/obras/${id}/confirmar/step1`, { cambio_id }),
  confirmarStep2: (id, cambio_id, codigo_verbal) =>
    apiCall("POST", `/api/obras/${id}/confirmar/step2`, { cambio_id, codigo_verbal }),
  actualizarAvance: (id, avance, motivo = "") =>
    apiCall("PUT", `/api/obras/${id}/avance`, { avance, motivo }),
  getHistorico: (periodo) => {
    const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";
    return apiCall("GET", `/api/obras/historico${qs}`);
  },
};

export const obrasNuevoAPI = {
  getAll: async (dg = null) => {
    try {
      const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
      const res = await nativeFetch(`${API_BASE}/api/pg/obras?limite=10000`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.message || `Error en API ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      const json = await res.json().catch(() => ({}));
      const obras = (json.data || []).map((row) => normalizeObra(row, row.tabla || row.table || null));
      const data = dg
        ? obras.filter((o) => normalizeText(o.direccion_general) === normalizeText(dg))
        : obras;

      return { success: true, data };
    } catch {
      const obras = await getObrasDesdeGIS();
      const data = dg
        ? obras.filter((o) => normalizeText(o.direccion_general) === normalizeText(dg))
        : obras;
      return { success: true, data };
    }
  },

  getObra: async (id_obra) => {
    const { data: obras } = await obrasNuevoAPI.getAll();
    return {
      success: true,
      data: obras.find((o) => String(o.id_obra || o.id) === String(id_obra)) || null,
    };
  },

  /**
   * Actualiza el avance de una obra en PostgreSQL.
   * Normal:            → PUT /api/obras/update
   * marcar_entregada:  → PUT /api/obras/inaugurar
   * marcar_cancelada:  → PUT /api/obras/cancelar
   */
  updateAvance: async (id_obra, avance, responsable, options = {}) => {
    const {
      tabla,
      nombre_obra,
      permitirRepetido,
      marcar_entregada,
      fecha_inauguracion,
      marcar_cancelada,
      motivo_cancelacion,
    } = options;

    if (marcar_entregada) {
      const respuesta = await apiCall("PUT", "/api/obras/inaugurar", {
        tabla: tabla || "",
        id: id_obra,
        fecha_inauguracion,
        usuario: responsable || "sistema",
      });

      const avanceNuevo = respuesta.porcentaje_nuevo ?? Number(avance);
      const estatusFinal = respuesta.estatus_nuevo || "ENTREGADO";
      return {
        success: true,
        avance_nuevo: avanceNuevo,
        estatus: estatusFinal,
        color: colorPorEstatus(estatusFinal, avanceNuevo),
        fecha_inauguracion: respuesta.fecha_inauguracion || fecha_inauguracion || null,
      };
    }

    if (marcar_cancelada) {
      const respuesta = await apiCall("PUT", "/api/obras/cancelar", {
        tabla: tabla || "",
        id: id_obra,
        motivo_cancelacion,
        usuario: responsable || "sistema",
      });

      const avanceNuevo = respuesta.porcentaje_nuevo ?? Number(avance);
      const estatusFinal = respuesta.estatus_nuevo || "CANCELADO";
      return {
        success: true,
        avance_nuevo: avanceNuevo,
        estatus: estatusFinal,
        color: colorPorEstatus(estatusFinal, avanceNuevo),
        motivo_cancelacion: respuesta.motivo_cancelacion || motivo_cancelacion || null,
      };
    }

    const body = {
      tabla:   tabla || "",
      id:      id_obra,
      nombre:  nombre_obra || String(id_obra),
      avance:  Number(avance),
      usuario: responsable || "sistema",
      motivo:  options.motivo || "",
      permitirRepetido: !!permitirRepetido,
      accion: permitirRepetido ? "repetir" : "actualizar",
    };

    const respuesta = await apiCall("PUT", "/api/obras/update", body);
    if (!respuesta.success) throw new Error(respuesta.message || "Error al actualizar");

    const avanceNuevo = respuesta.porcentaje_nuevo ?? Number(avance);
    const estatusFinal = respuesta.estatus_nuevo || normalizeStatus("", avanceNuevo);

    return {
      success:      true,
      avance_nuevo: avanceNuevo,
      estatus:      estatusFinal,
      color:        colorPorEstatus(estatusFinal, avanceNuevo),
    };
  },

  getHistorial: async () => ({ success: true, data: [] }),
};

/* ─────────────────────────────────────────────────────────────
   ESTADO DEL SISTEMA
   GET /api/sistema/estado  → { estado: "abierto"|"cerrado", ... }
───────────────────────────────────────────────────────────── */
export async function getEstadoSistema() {
  try {
    const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
    const res = await nativeFetch(`${API_BASE}/api/sistema/estado`, { headers });
    if (!res.ok) return true;
    const data = await res.json().catch(() => ({}));
    return data.estado === "abierto" || !!data.abierto;
  } catch {
    return true; // sistema abierto por defecto ante error de red
  }
}

async function fetchSistemaConfig() {
  const abierto = await getEstadoSistema();
  return { abierto, estado: abierto ? "abierto" : "cerrado" };
}

export const controlAPI = {
  getEstado: fetchSistemaConfig,
  abrir:     () => apiCall("POST", "/api/control/abrir"),
  cerrar:    () => apiCall("POST", "/api/control/cerrar"),
};

export const sistemaAPI = {
  getEstado: fetchSistemaConfig,
  toggle: async (activo) => {
    const body = typeof activo === "boolean" ? { activo } : null;
    const data = await apiCall("POST", "/api/sistema/toggle", body);
    const abierto = data.estado === "abierto" || !!data.abierto;
    return { abierto, estado: abierto ? "abierto" : "cerrado" };
  },
};

export const semanaAPI = {
  actual: () => apiCall("GET", "/api/semana/actual"),
  iniciar: () => apiCall("POST", "/api/semana/iniciar"),
};

/* ─────────────────────────────────────────────────────────────
   SEMANA / PERÍODO ACTIVO
   Derivado de GET /api/sistema/estado → periodo_actual (ej. "2026-W18")
───────────────────────────────────────────────────────────── */
let _semanaCache = null;

export async function getSemanaInfo() {
  if (_semanaCache) return _semanaCache;
  try {
    const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
    const res = await nativeFetch(`${API_BASE}/api/sistema/estado`, { headers });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const periodo    = data.periodo_actual || "";
    const weekMatch  = periodo.match(/W(\d+)/);
    const semanaNum  = weekMatch ? parseInt(weekMatch[1], 10) : 1;
    const result = {
      ok:            true,
      semana_activa: semanaNum,
      nombre:        `SEMANA ${semanaNum} DE ACTUALIZACIÓN`,
      semanas:       [{ numero: semanaNum, nombre: `SEMANA ${semanaNum} DE ACTUALIZACIÓN`, bloqueada: false }],
    };
    _semanaCache = result;
    return result;
  } catch {
    return {
      ok:            true,
      semana_activa: 1,
      nombre:        "SEMANA 1 DE ACTUALIZACIÓN",
      semanas:       [{ numero: 1, nombre: "SEMANA 1 DE ACTUALIZACIÓN", bloqueada: false }],
    };
  }
}

export function invalidarCacheSemana() {
  _semanaCache = null;
}

/* ─────────────────────────────────────────────────────────────
   REPORTES / HISTÓRICO
───────────────────────────────────────────────────────────── */
export const reportesAPI = {
  getPeriodos: async () => {
    try {
      return await apiCall("GET", "/api/reportes/periodos");
    } catch {
      return { success: true, data: [] };
    }
  },
  getCorte:    (periodo)         => apiCall("GET", `/api/reportes/corte?periodo=${encodeURIComponent(periodo)}`),
  descargar:   (periodo, formato = "csv") =>
    apiCall("GET", `/api/reportes/descargar?periodo=${encodeURIComponent(periodo)}&formato=${formato}`),
};

/* ─────────────────────────────────────────────────────────────
   DASHBOARD / KPIs
───────────────────────────────────────────────────────────── */
export const pgObrasAPI = {
  getAll: obrasNuevoAPI.getAll,
};

export const dashboardAPI = {
  getStats: async () => {
    const data = await getObrasDesdeGIS();
    return { success: true, data };
  },
};

export const geoAPI = {
  getFeatures: getGeoJsonDesdeGIS,
};

/* ── Helpers de compatibilidad (mantienen imports existentes) ── */
export function getProgramas() {
  return [];
}
export function getCortes() {
  return [];
}
export function getObras() {
  return [];
}
export function getObraById() {
  return null;
}
export function esTablaValidaFn(name) {
  return TABLAS_VALIDAS_NORMALIZADAS.has(normalizeText(name));
}
