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

/**
 * Modo standalone (sin backend) — activado por runtime-config.js en despliegues
 * de prueba que solo deben alimentarse del JSON estático en /data. Evita
 * intentos de red contra un backend que no existe ahí (login, obras, estado).
 */
export const OFFLINE_MODE = typeof window !== "undefined" && window.__CONFIG__?.OFFLINE === true;

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
  // Estatuses canónicos — pasan directo sin transformación
  if (status === "INAUGURADA")  return "INAUGURADA";
  if (status === "TERMINADA")   return "TERMINADA";
  if (status === "EN PROCESO")  return "EN PROCESO";
  if (status === "SIN INICIAR") return "SIN INICIAR";
  if (status === "CANCELADO")   return "CANCELADO";
  // Aliases heredados
  if (status.includes("CANCELAD")) return "CANCELADO";
  if (status.includes("INAUGUR") || status.includes("ENTREGAD")) return "INAUGURADA";
  if (status.includes("TERMINAD") || status === "ACTUALIZADA") return "TERMINADA";
  if (status.includes("PROCESO") || status === "EN PROGRESO") return "EN PROCESO";
  if (status.includes("PENDIENT") || status.includes("SIN INICIAR")) return "SIN INICIAR";
  const n = Number(avance);
  if (Number.isFinite(n)) {
    if (n >= 100) return "TERMINADA";
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

  // Nombres canónicos primero, luego aliases heredados
  const nombre =
    getSafe(source, [
      "nombre_obra",
      "nombre",
      "NOMBRE DEL SITIO INTERVENIDO",
      "nombre_proyecto",
      "descripcion",
      "proyecto",
      "obra",
    ]) || "SIN NOMBRE";

  const programa =
    getSafe(source, ["programa", "PROGRAMA", "nombre_programa"]) || "SIN PROGRAMA";

  // "dg" es la columna canónica en la nueva BD
  const direccionGeneral = getSafe(source, [
    "dg",
    "direccion_general",
    "DIRECCION GENERAL",
    "DIRECCIÓN GENERAL",
  ]);

  const avance = normalizePercent(
    getSafe(source, [
      "avance_real",
      "avance",
      "AVANCE REAL",
      "AVANCE",
      "porcentaje_avance",
      "porcentaje",
      "avance_fisico",
    ])
  );

  const estatus = normalizeStatus(
    getSafe(source, ["estatus", "ESTATUS", "estado", "STATUS", "status"]),
    avance
  );

  const alcaldia = getSafe(source, ["alcaldia", "ALCALDIA", "ALCALDÍA"]);

  const fechaActualizacion = getSafe(source, [
    "fecha_actualizacion",
    "ultima_actualizacion",
    "FECHA ACTUALIZACION",
    "ultimaActualizacion",
    "updated_at",
  ]);

  const usuarioActualizacion = getSafe(source, [
    "usuario_actualizacion",
    "USUARIO ACTUALIZACION",
    "responsable",
    "usuario",
  ]);

  const motivoCancelacion = getSafe(source, ["motivo_cancelacion", "MOTIVO CANCELACION"]);
  const finalGeometry = getGeometry(source, geometry);

  return {
    ...source,
    id,
    id_obra: getSafe(source, ["id_obra"]) || id,
    uid: `${sourceTable || source.tipo || "GIS"}::${id}`,
    nombre,
    nombre_obra: source.nombre_obra || nombre,
    programa,
    dg: source.dg || direccionGeneral || null,
    direccion_general: direccionGeneral || null,
    dg_responsable: source.dg_responsable || null,
    estatus,
    estado: estatus,
    avance,
    avance_real: source.avance_real !== undefined ? normalizePercent(source.avance_real) : avance,
    porcentaje: avance,
    porcentaje_avance: avance,
    alcaldia: alcaldia || null,
    colonia: source.colonia || null,
    calle_domicilio: source.calle_domicilio || null,
    clave_unica: source.clave_unica || null,
    bloque_mundial: source.bloque_mundial || null,
    origen_del_compromiso: source.origen_del_compromiso || null,
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
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("sicops:session-expired"));
    }
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
   CARGA DE OBRAS — endpoint unificado GET /api/obras
   Retorna GeoJSON FeatureCollection con obras_puntos,
   obras_lineas y obras_poligonos unificadas.
───────────────────────────────────────────────────────────── */
async function getObrasDesdeArchivoEstatico() {
  try {
    const res = await nativeFetch(`${process.env.PUBLIC_URL}/data/obras.json`);
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    return (json.features || []).map((f) => normalizeObra(f)).filter(Boolean);
  } catch (err) {
    console.warn("[SICOPS] Error al cargar /data/obras.json:", err.message);
    return [];
  }
}

export async function getObrasDesdeGIS() {
  if (OFFLINE_MODE) return getObrasDesdeArchivoEstatico();

  const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
  try {
    const res = await nativeFetch(`${API_BASE}/api/geojson/obras`, { headers });
    if (!res.ok) {
      console.warn("[SICOPS] Error al cargar /api/geojson/obras:", res.status, "— usando snapshot estático de /data/obras.json");
      return getObrasDesdeArchivoEstatico();
    }
    const json = await res.json().catch(() => ({}));
    const features = json.features || [];
    const obras = features.map((f) => normalizeObra(f)).filter(Boolean);
    if (obras.length === 0) {
      console.warn("[SICOPS] /api/geojson/obras devolvió 0 features. Verifique la API.");
    }
    return obras;
  } catch (err) {
    /* Backend inalcanzable (caído, sin conexión a su base de datos, etc.)
       — en vez de dejar la app sin obras, se degrada al snapshot estático
       de /data/obras.json (mismo archivo que usa el modo offline). Nunca
       sustituye a datos reales del backend cuando éste sí responde. */
    console.warn("[SICOPS] Error de red al cargar obras:", err.message, "— usando snapshot estático de /data/obras.json");
    return getObrasDesdeArchivoEstatico();
  }
}

/* ─────────────────────────────────────────────────────────────
   GEOJSON — GET /api/obras (ya es GeoJSON FeatureCollection)
   Filtra por dg en cliente si se especifica.
───────────────────────────────────────────────────────────── */
export async function getGeoJsonDesdeGIS(filtros = {}) {
  const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
  const res = await nativeFetch(`${API_BASE}/api/geojson/obras`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const geoJson = await res.json();
  if (filtros.dg) {
    const dgNorm = normalizeText(filtros.dg);
    geoJson.features = (geoJson.features || []).filter((f) => {
      const dg = normalizeText(f.properties?.direccion_general || f.properties?.dg || "");
      return dg === dgNorm;
    });
  }
  return geoJson;
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
  { id: 14, nombre: "Secretario",                                        usuario: "secretario",                     email: "secretario",                     password: "SECRETARIO_2026!",             rol: "SECRETARIO",                   activo: true },
  { id: 15, nombre: "Director General",                                  usuario: "director_general",               email: "director_general",               password: "DIRECTOR_GENERAL_2026!",       rol: "DIRECTOR_GENERAL",             activo: true, dg: "DGSUS" },
  { id: 16, nombre: "Director de Proyecto",                              usuario: "director_proyecto",              email: "director_proyecto",              password: "DIRECTOR_PROYECTO_2026!",      rol: "DIRECTOR_PROYECTO",            activo: true },
  { id: 17, nombre: "Subdirector de Proyectos",                          usuario: "subdirector_proyectos",          email: "subdirector_proyectos",          password: "SUBDIRECTOR_PROYECTOS_2026!",  rol: "SUBDIRECTOR_PROYECTOS",        activo: true },
  { id: 18, nombre: "Director de Obras Inducidas",                       usuario: "director_obras_inducidas",       email: "director_obras_inducidas",       password: "DIRECTOR_OBRAS_INDUCIDAS_2026!", rol: "DIRECTOR_OBRAS_INDUCIDAS",   activo: true },
  { id: 19, nombre: "Supervisión Externa",                               usuario: "supervision_externa",            email: "supervision_externa",            password: "SUPERVISION_EXTERNA_2026!",    rol: "SUPERVISION_EXTERNA",          activo: true },
  { id: 20, nombre: "Jefe de Unidad Departamental de Obra",              usuario: "jefe_unidad_obra",                email: "jefe_unidad_obra",               password: "JEFE_UNIDAD_OBRA_2026!",       rol: "JEFE_UNIDAD_OBRA",             activo: true },
  { id: 21, nombre: "Director de Obra",                                  usuario: "director_obra",                  email: "director_obra",                  password: "DIRECTOR_OBRA_2026!",          rol: "DIRECTOR_OBRA",                activo: true },
  { id: 22, nombre: "Residente de Obra",                                 usuario: "residente_obra",                 email: "residente_obra",                 password: "RESIDENTE_OBRA_2026!",         rol: "RESIDENTE_OBRA",               activo: true },
  { id: 23, nombre: "Director de Concurso, Contratos y Estimaciones",    usuario: "director_concursos_contratos",   email: "director_concursos_contratos",   password: "DIRECTOR_CONCURSOS_2026!",     rol: "DIRECTOR_CONCURSOS_CONTRATOS", activo: true },
  { id: 24, nombre: "Subdirección de Concertación",                      usuario: "subdireccion_concertacion",      email: "subdireccion_concertacion",      password: "SUBDIRECCION_CONCERTACION_2026!", rol: "SUBDIRECCION_CONCERTACION", activo: true },
  { id: 25, nombre: "Equipo Asesor Técnico de la Secretaría",            usuario: "asesores_estructuristas",        email: "asesores_estructuristas",        password: "ASESORES_ESTRUCTURISTAS_2026!", rol: "ASESORES_ESTRUCTURISTAS",     activo: true },
  { id: 26, nombre: "Subdirección de Comunicación",                      usuario: "subdireccion_comunicacion",      email: "subdireccion_comunicacion",      password: "SUBDIRECCION_COMUNICACION_2026!", rol: "SUBDIRECCION_COMUNICACION", activo: true },
  { id: 27, nombre: "Director de Área",                                  usuario: "director_area",                  email: "director_area",                  password: "DIRECTOR_AREA_2026!",          rol: "DIRECTOR_AREA",                activo: true },
  { id: 28, nombre: "Subdirector",                                       usuario: "subdirector",                    email: "subdirector",                    password: "SUBDIRECTOR_2026!",            rol: "SUBDIRECTOR",                  activo: true },
  /* ── Funcionarios por Dirección General — Revisión Integral acotada a su propia DG ── */
  { id: 29, nombre: "Funcionario DGCOP",  usuario: "funcionario_dgcop",  email: "funcionario_dgcop",  password: "FUNCIONARIO_DGCOP_2026!",  rol: "FUNCIONARIO_DG", activo: true, dg: "DGCOP"  },
  { id: 30, nombre: "Funcionario DGSUS",  usuario: "funcionario_dgsus",  email: "funcionario_dgsus",  password: "FUNCIONARIO_DGSUS_2026!",  rol: "FUNCIONARIO_DG", activo: true, dg: "DGSUS"  },
  { id: 31, nombre: "Funcionario DGOIV",  usuario: "funcionario_dgoiv",  email: "funcionario_dgoiv",  password: "FUNCIONARIO_DGOIV_2026!",  rol: "FUNCIONARIO_DG", activo: true, dg: "DGOIV"  },
  { id: 32, nombre: "Funcionario DGOT",   usuario: "funcionario_dgot",   email: "funcionario_dgot",   password: "FUNCIONARIO_DGOT_2026!",   rol: "FUNCIONARIO_DG", activo: true, dg: "DGOT"   },
  { id: 33, nombre: "Funcionario DGPEST", usuario: "funcionario_dgpest", email: "funcionario_dgpest", password: "FUNCIONARIO_DGPEST_2026!", rol: "FUNCIONARIO_DG", activo: true, dg: "DGPEST" },
];

function crearSesionLocal(usuario) {
  const { password, ...user } = usuario;
  const token = `local-${user.usuario}-${Date.now()}`;
  setToken(token);
  localStorage.setItem("usuario", JSON.stringify(user));
  localStorage.setItem("sicops_user", JSON.stringify(user));
  return { success: true, token, user };
}

/* PS_SICOPS_FINAL — sistema nuevo (contratos, motor financiero), backend y
   tabla de usuarios completamente separados del sicops-api de siempre.
   El login principal intenta AMBOS backends con las mismas credenciales
   que escriba la persona, sin mostrar un segundo formulario — quien tenga
   cuenta ahí (hoy: Director de Concursos y Contratos / Directores de Obras
   Públicas por DG) simplemente entra por la misma puerta. */
function resolvePsApiUrl() {
  return typeof window !== "undefined" ? window.__CONFIG__?.PS_API_URL : null;
}

async function intentarLoginPS(usuarioIngresado, passwordIngresado) {
  const psUrl = resolvePsApiUrl();
  if (!psUrl) return null;
  try {
    const res = await nativeFetch(`${psUrl}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ usuario: usuarioIngresado, password: passwordIngresado }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.token) return null;

    /* Token y usuario del sistema nuevo — claves propias, las mismas que
       ya lee src/api/psContratosApi.js, para que /contratos-ps no vuelva
       a pedir credenciales. */
    localStorage.setItem("ps_sicops_token", data.token);
    localStorage.setItem("ps_sicops_user",  JSON.stringify(data.user));

    const user = { ...data.user, sistema: "ps_sicops_final" };
    /* También se guarda como sesión "principal" — habilita el paso por
       ProtectedLayout. Las llamadas GET al backend viejo toleran un token
       que no reconocen (ver middleware/auth.js), así que no rompe nada
       fuera del módulo nuevo. */
    setToken(data.token);
    localStorage.setItem("sicops_user", JSON.stringify(user));
    localStorage.setItem("usuario",     JSON.stringify(user));
    return { success: true, token: data.token, user };
  } catch {
    return null;
  }
}

export const authAPI = {
  login: async (usuarioIngresado, passwordIngresado) => {
    /* Modo standalone: sin backend, ni se intenta la red */
    if (!OFFLINE_MODE) {
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

        /* Backend viejo rechazó — antes de darlo por inválido, probar si
           es una cuenta del sistema nuevo (PS_SICOPS_FINAL). */
        if (res.status === 401 || res.status === 400) {
          const psResult = await intentarLoginPS(usuarioIngresado, passwordIngresado);
          if (psResult) return psResult;

          const err = new Error(data.message || "Usuario o contraseña incorrectos");
          err.code = "INVALID_CREDENTIALS";
          throw err;
        }
      } catch (apiErr) {
        /* Re-lanzar errores de credenciales inválidas sin intentar fallback local */
        if (apiErr.code === "INVALID_CREDENTIALS") throw apiErr;
        /* Error de red / backend caído — probar el sistema nuevo antes del
           fallback local, luego caer al mock si tampoco responde. */
        const psResult = await intentarLoginPS(usuarioIngresado, passwordIngresado);
        if (psResult) return psResult;
        console.warn("[SICOPS] Backend no disponible, usando credenciales locales:", apiErr.message);
      }
    }

    /* Fallback local (standalone, o desarrollo sin backend activo) */
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
  setModoCalculo: (clave_unica, modo) =>
    apiCall("PATCH", `/api/obras/${encodeURIComponent(clave_unica)}/modo-avance`, { modo }),
};

export const frentesAPI = {
  obtener: (clave_unica) =>
    apiCall("GET", `/api/frentes/${encodeURIComponent(clave_unica)}`),
  batchAvance: (clave_unica, updates) =>
    apiCall("PATCH", "/api/frentes/batch-avance", { clave_unica, updates }),
};

export const obrasNuevoAPI = {
  getAll: async (dg = null) => {
    try {
      const obras = await getObrasDesdeGIS();
      const data = dg
        ? obras.filter((o) => normalizeText(o.dg || o.direccion_general) === normalizeText(dg))
        : obras;
      return { success: true, data };
    } catch (err) {
      console.warn("[SICOPS] obrasNuevoAPI.getAll error:", err.message);
      return { success: true, data: [] };
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
      solo_fecha_inauguracion,
    } = options;

    if (solo_fecha_inauguracion) {
      const respuesta = await apiCall("PUT", "/api/obras/fecha-inauguracion", {
        tabla: tabla || "",
        id: id_obra,
        fecha_inauguracion,
        usuario: responsable || "sistema",
      });
      return {
        success: true,
        avance_nuevo: Number(avance),
        estatus: respuesta.estatus_actual || "",
        color: colorPorEstatus(respuesta.estatus_actual || "", Number(avance)),
        fecha_inauguracion: respuesta.fecha_inauguracion || fecha_inauguracion || null,
      };
    }

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
  if (OFFLINE_MODE) return true;
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
   La semana operativa no coincide con la semana ISO del calendario.
   Se calcula a partir de una fecha base y avanza automáticamente cada lunes.
───────────────────────────────────────────────────────────── */
let _semanaCache = null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UPDATE_WEEK_START = {
  year: 2026,
  monthIndex: 3, // abril
  day: 20,       // lunes de la semana 1 operativa
  week: 1,
};

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getIsoWeekStartDate(year, week) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const isoWeek1Monday = new Date(jan4);
  isoWeek1Monday.setDate(jan4.getDate() - jan4Day + 1);

  const target = new Date(isoWeek1Monday);
  target.setDate(isoWeek1Monday.getDate() + (week - 1) * 7);
  return startOfLocalDay(target);
}

function getUpdateWeekNumber(referenceDate = new Date()) {
  const anchorDate = new Date(
    UPDATE_WEEK_START.year,
    UPDATE_WEEK_START.monthIndex,
    UPDATE_WEEK_START.day
  );
  const currentDate = startOfLocalDay(referenceDate);
  const diffDays = Math.floor((currentDate.getTime() - anchorDate.getTime()) / MS_PER_DAY);
  const elapsedWeeks = Math.floor(diffDays / 7);
  return Math.max(UPDATE_WEEK_START.week, UPDATE_WEEK_START.week + elapsedWeeks);
}

function buildSemanaInfo(semanaNum) {
  return {
    ok: true,
    semana_activa: semanaNum,
    nombre: `SEMANA ${semanaNum} DE ACTUALIZACIÓN`,
    semanas: [{ numero: semanaNum, nombre: `SEMANA ${semanaNum} DE ACTUALIZACIÓN`, bloqueada: false }],
  };
}

export async function getSemanaInfo() {
  if (_semanaCache) return _semanaCache;
  try {
    const headers = { "Content-Type": "application/json", ...buildAuthHeaders() };
    const res = await nativeFetch(`${API_BASE}/api/sistema/estado`, { headers });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const periodo = data.periodo_actual || "";
    const periodMatch = periodo.match(/(\d{4})-W(\d{1,2})/i);
    const referenceDate = periodMatch
      ? getIsoWeekStartDate(parseInt(periodMatch[1], 10), parseInt(periodMatch[2], 10))
      : new Date();
    const result = buildSemanaInfo(getUpdateWeekNumber(referenceDate));
    _semanaCache = result;
    return result;
  } catch {
    return buildSemanaInfo(getUpdateWeekNumber());
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

/* ─────────────────────────────────────────────────────────────
   ALCANCES — bitácora narrativa por obra
   GET  /api/alcances?id_obra=&tabla=
   POST /api/alcances  → { id_obra, tabla, texto, usuario }
───────────────────────────────────────────────────────────── */
export const alcancesAPI = {
  /* ── Catálogo dinámico ── */
  getProgramas: () =>
    apiCall("GET", "/api/alcances/programas"),

  getConceptos: (programa, area) => {
    const qs = area ? `&area=${encodeURIComponent(area)}` : "";
    return apiCall("GET", `/api/alcances/conceptos?programa=${encodeURIComponent(programa)}${qs}`);
  },

  getDetalle: (programa, concepto, area) => {
    const qs = area ? `&area=${encodeURIComponent(area)}` : "";
    return apiCall("GET", `/api/alcances/detalle?programa=${encodeURIComponent(programa)}&concepto=${encodeURIComponent(concepto)}${qs}`);
  },

  guardar: (body) =>
    apiCall("POST", "/api/alcances/guardar", body),

  getHistorial: (clave_unica) =>
    apiCall("GET", `/api/alcances/historial?clave_unica=${encodeURIComponent(clave_unica)}`),

  /* ── Configuración de edición (FUNCIÓN 4) ── */
  getConfig: () =>
    apiCall("GET", "/api/alcances/config"),

  updateConfig: (body) =>
    apiCall("POST", "/api/alcances/config", body),

  /* ── Edición / eliminación de registros ── */
  editarAlcance: (id, body) =>
    apiCall("PUT", `/api/alcances/editar/${encodeURIComponent(id)}`, body),

  eliminarAlcance: (id) =>
    apiCall("DELETE", `/api/alcances/eliminar/${encodeURIComponent(id)}`),

  /* ── Unidades para modo libre (OBRAS ADICIONALES) ── */
  getUnidades: () =>
    apiCall("GET", "/api/alcances/unidades"),

  /* ── Sugerencias de concepto para autocompletado libre ── */
  getSugerencias: (q) =>
    apiCall("GET", `/api/alcances/sugerencias?q=${encodeURIComponent(q || "")}`),

  /* ── Clasificación PROYECTADO/EJECUTADO a nivel de obra ── */
  getTipoObra: (clave_unica) =>
    apiCall("GET", `/api/alcances/tipo/${encodeURIComponent(clave_unica)}`),

  updateTipoObra: (clave_unica, body) =>
    apiCall("PUT", `/api/alcances/tipo/${encodeURIComponent(clave_unica)}`, body),

  updateTipoIndividual: (id, body) =>
    apiCall("PATCH", `/api/alcances/tipo-individual/${encodeURIComponent(id)}`, body),
};

/* ─────────────────────────────────────────────────────────────
   MÓDULOS — control operativo de módulos SICOPS
   GET  /api/modulos/estado                → estado de todos los módulos
   POST /api/modulos/:modulo/toggle        → habilitar/deshabilitar (ADMIN)
   PUT  /api/modulos/:modulo               → actualizar config (ADMIN)
───────────────────────────────────────────────────────────── */
export const modulosAPI = {
  getEstado: async () => {
    if (OFFLINE_MODE) return { success: true, modulos: {}, fallback: true };
    try {
      return await apiCall("GET", "/api/modulos/estado");
    } catch {
      return { success: true, modulos: {}, fallback: true };
    }
  },
  toggle: (modulo, habilitado) =>
    apiCall("POST", `/api/modulos/${encodeURIComponent(modulo)}/toggle`, { habilitado }),
  actualizar: (modulo, config) =>
    apiCall("PUT", `/api/modulos/${encodeURIComponent(modulo)}`, config),
};

/* ─────────────────────────────────────────────────────────────
   UTOPÍAS — subsistema especializado
   GET  /api/utopias                       → lista agrupada por obra
   GET  /api/utopias/resumen               → KPIs globales
   GET  /api/utopias/frentes               → tabla plana con filtros
   GET  /api/utopias/:clave                → detalle + frentes de una utopía
   PUT  /api/utopias/frentes/update        → actualizar un frente
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   COBERTURA — control administrativo de alcances por obra
   GET /api/cobertura/alcances?programa=&dg=&alcaldia=&anio=
   Solo accesible para ADMIN.
───────────────────────────────────────────────────────────── */
export const coberturaAPI = {
  getAlcances: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null)
      )
    ).toString();
    return apiCall("GET", `/api/cobertura/alcances${qs ? `?${qs}` : ""}`);
  },

  /* Mapa ligero para el panel principal — obras vienen de useObras() */
  getAlcancesMapa: () => apiCall("GET", "/api/cobertura/alcances-mapa"),

  getReporte: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null)
      )
    ).toString();
    return apiCall("GET", `/api/cobertura/reporte${qs ? `?${qs}` : ""}`);
  },

  downloadExcel: async (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null)
      )
    ).toString();
    const token = getToken();
    const res = await nativeFetch(`${API_BASE}/api/cobertura/excel${qs ? `?${qs}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status} al descargar Excel`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Cobertura_Alcances_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const utopiasAPI = {
  listar: () =>
    apiCall("GET", "/api/utopias"),

  resumen: () =>
    apiCall("GET", "/api/utopias/resumen"),

  frentes: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ""))
    ).toString();
    return apiCall("GET", `/api/utopias/frentes${qs ? `?${qs}` : ""}`);
  },

  detalle: (clave) =>
    apiCall("GET", `/api/utopias/${encodeURIComponent(clave)}`),

  actualizarFrente: (id, campos) =>
    apiCall("PUT", "/api/utopias/frentes/update", { id, ...campos }),
};

/* ─────────────────────────────────────────────────────────────
   INFO GENERAL DE OBRAS — ficha técnica por programa
   Cada indicador tiene UN SOLO valor vigente por obra (UPSERT).
───────────────────────────────────────────────────────────── */
export const infoGeneralAPI = {
  /* Catálogo de indicadores activos para un programa.
     Para OBRAS ADICIONALES pasar area = nombre_obra */
  getCatalogo: (programa, area) => {
    const qs = area ? `&area=${encodeURIComponent(area)}` : "";
    return apiCall("GET", `/api/info-general/catalogo?programa=${encodeURIComponent(programa)}${qs}`);
  },

  /* Valores ya capturados para una obra */
  getObra: (clave_unica) =>
    apiCall("GET", `/api/info-general/obra?clave_unica=${encodeURIComponent(clave_unica)}`),

  /* Conteo batch: { claves: [...] } → { data: { [clave]: capturados } }
     Reemplaza N llamadas a getObra por 1 sola petición */
  conteos: (claves) =>
    apiCall("POST", "/api/info-general/conteos", { claves }),

  /* Guardar/actualizar ficha completa (transaccional)
     Body: { clave_unica, nombre_obra, programa, area, dg,
             usuario_actualizacion, indicadores: [...] } */
  guardarFicha: (body) =>
    apiCall("POST", "/api/info-general/guardar-ficha", body),

  /* Limpiar (nullificar) un valor — solo ADMIN */
  limpiarValor: (id, body) =>
    apiCall("PUT", `/api/info-general/limpiar/${encodeURIComponent(id)}`, body),
};

/* ─────────────────────────────────────────────────────────────
   GESTIÓN CONTROLADA DE OBRAS — ROL_GEOESTADISTICA
   Altas, modificaciones, bajas lógicas, corrección de claves
   y consulta de auditoría. Solo accesible para GEOESTADISTICA
   y ADMIN.
───────────────────────────────────────────────────────────── */
export const geoestadisticaAPI = {
  /* Listar obras con filtros opcionales */
  getObras: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null))
    ).toString();
    return apiCall("GET", `/api/geoestadistica/obras${qs ? `?${qs}` : ""}`);
  },

  /* Detalle de una obra + dependencias */
  getObraDetalle: (clave) =>
    apiCall("GET", `/api/geoestadistica/obras/${encodeURIComponent(clave)}`),

  /* Verificar dependencias antes de corrección de clave */
  verificarDependencias: (clave_unica) =>
    apiCall("POST", "/api/geoestadistica/obras/verificar-dependencias", { clave_unica }),

  /* Alta de nueva obra */
  altaObra: (body) =>
    apiCall("POST", "/api/geoestadistica/obras/alta", body),

  /* Modificar atributos de una obra */
  modificarAtributos: (clave, body) =>
    apiCall("PUT", `/api/geoestadistica/obras/${encodeURIComponent(clave)}/atributos`, body),

  /* Baja lógica con motivo */
  bajaLogica: (clave, body) =>
    apiCall("PUT", `/api/geoestadistica/obras/${encodeURIComponent(clave)}/baja`, body),

  /* Reactivar obra dada de baja */
  reactivarObra: (clave, body) =>
    apiCall("PUT", `/api/geoestadistica/obras/${encodeURIComponent(clave)}/reactivar`, body),

  /* Corrección en cascada de clave_unica */
  corregirClaveUnica: (clave, body) =>
    apiCall("PUT", `/api/geoestadistica/obras/${encodeURIComponent(clave)}/corregir-clave`, body),

  /* Catálogo maestro de claves */
  getCatalogo: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null))
    ).toString();
    return apiCall("GET", `/api/geoestadistica/catalogo${qs ? `?${qs}` : ""}`);
  },

  /* Registro de auditoría con filtros */
  getAuditoria: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "" && v !== null))
    ).toString();
    return apiCall("GET", `/api/geoestadistica/auditoria${qs ? `?${qs}` : ""}`);
  },

  /* Catálogo de motivos de baja */
  getMotivosBaja: () =>
    apiCall("GET", "/api/geoestadistica/motivos-baja"),

  /* Lookup EJE + BLOQUE_MUNDIAL por programa */
  getCatalogoPrograma: (programa) =>
    apiCall("GET", `/api/geoestadistica/catalogo-programa?programa=${encodeURIComponent(programa)}`),

  /* Verifica si una clave_unica está disponible (no existe en catalogo_obras) */
  verificarClave: (clave) =>
    apiCall("GET", `/api/geoestadistica/verificar-clave?clave=${encodeURIComponent(clave)}`),
};

/* ─────────────────────────────────────────────────────────────
   ESTADO OPERATIVO — diagnóstico consolidado del ecosistema
   Solo ADMIN. Incluye módulos, sistema e integridad de datos.
───────────────────────────────────────────────────────────── */
export const estadoOperativoAPI = {
  getEstado:       () => apiCall("GET", "/api/admin/estado"),
  getProgramasModo: () => apiCall("GET", "/api/admin/estado/programas-modo"),
  setProgramaModo:  (programa, modo) =>
    apiCall("PATCH", "/api/admin/estado/programa-modo", { programa, modo }),
};

/* ─────────────────────────────────────────────────────────────
   INTELIGENCIA OPERATIVA — Fase 1 (resumen, transiciones, alertas)
   Solo ADMIN. Explota la tabla auditoria.
───────────────────────────────────────────────────────────── */
export const inteligenciaAPI = {
  getResumen: () => apiCall("GET", "/api/inteligencia"),
};

/* ─────────────────────────────────────────────────────────────
   EVOLUCIÓN DE OBRAS — Nivel 5 (detalle histórico de una obra)
───────────────────────────────────────────────────────────── */
export const evolucionAPI = {
  getObra: (tabla, id) =>
    apiCall("GET", `/api/evolucion/obra?tabla=${encodeURIComponent(tabla)}&id=${encodeURIComponent(id)}`),
  getResumen: (nivel, clave) =>
    apiCall("GET", `/api/evolucion/resumen?nivel=${encodeURIComponent(nivel)}&clave=${encodeURIComponent(clave)}`),
};

/* ─────────────────────────────────────────────────────────────
   IMPORTACIÓN MASIVA — ROL_GEOESTADISTICA
───────────────────────────────────────────────────────────── */
export const importacionAPI = {
  /** Valida las filas del CSV sin insertar nada */
  preview: (filas) =>
    apiCall("POST", "/api/geoestadistica/importacion/preview", { filas }),

  /** Inserta las filas válidas en una transacción + verifica integridad */
  ejecutar: (filas, nombre_archivo) =>
    apiCall("POST", "/api/geoestadistica/importacion/ejecutar", { filas, nombre_archivo }),

  /** Descarga la plantilla CSV oficial */
  descargarPlantilla: async () => {
    const token = getToken();
    const res = await nativeFetch(`${API_BASE}/api/geoestadistica/importacion/plantilla`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "plantilla_importacion_obras.csv"; a.click();
    URL.revokeObjectURL(url);
  },
};
