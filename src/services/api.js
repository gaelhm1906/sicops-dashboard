const API_BASE =
  window.__GIS_CONFIG__?.API_BASE_URL ||
  process.env.REACT_APP_GIS_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "");

export const TABLAS_VALIDAS = [
  "123 POR MI ESCUELA DGCOP",
  "123 POR MI ESCUELA ILIFE",
  "ALBERGUES",
  "BICIESTACIONAMIENTO DGCOP",
  "BICIESTACIONAMIENTOS DGOIV",
  "CAMINOS SEGUROS",
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
  "TROLEBUS RUTA 14",
  "UNIVERSIDAD DE LAS ARTES",
  "YOLOTL ANAHUAC",
];

function normalizeTableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const TABLAS_VALIDAS_SET = new Set(TABLAS_VALIDAS.map(normalizeTableName));

function getLayerName(layer) {
  if (typeof layer === "string") return layer;
  return layer.table_name || layer.name || layer.table || layer.id || layer.layer || String(layer);
}

function isValidLayer(layer) {
  return TABLAS_VALIDAS_SET.has(normalizeTableName(getLayerName(layer)));
}

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error("Error en API");
  return res.json();
}

function pick(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return null;
}

function tableLabel(table) {
  return String(table || "GIS")
    .replace(/^tablas_|^obras_/i, "")
    .replace(/_/g, " ")
    .toUpperCase();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

export function normalizeGISFeature(raw, table) {
  const props = raw?.properties || raw || {};
  const id = pick(props, ["id", "id_obra", "gid", "objectid", "fid", "ogc_fid"]);
  const porcentaje = toNumber(pick(props, [
    "AVANCE REAL",
    "avance_real",
    "avance",
    "AVANCE",
    "porcentaje_avance",
    "porcentaje",
    "avance_fisico",
  ]));
  const estado = pick(props, ["ESTATUS", "estatus", "estado", "STATUS", "status"]) ||
    (porcentaje >= 100 ? "TERMINADO" : porcentaje > 0 ? "EN PROCESO" : "SIN INICIAR");
  const fallbackLabel = tableLabel(table);

  return {
    ...props,
    id,
    id_obra: id,
    uid: `${table || "layer"}::${id ?? Math.random().toString(36).slice(2)}`,
    tabla: table,
    nombre: pick(props, [
      "NOMBRE DEL SITIO INTERVENIDO",
      "nombre",
      "nombre_obra",
      "nombre_proyecto",
      "descripcion",
      "proyecto",
      "obra",
    ]) || fallbackLabel,
    programa: pick(props, ["PROGRAMA", "programa", "nombre_programa"]) || fallbackLabel,
    direccion_general: pick(props, [
      "DIRECCION GENERAL",
      "DIRECCIÓN GENERAL",
      "direccion_general",
      "dg",
    ]) || fallbackLabel,
    alcaldia: pick(props, ["ALCALDIA", "ALCALDÍA", "alcaldia"]),
    porcentaje,
    porcentaje_avance: porcentaje,
    avance: porcentaje,
    estatus: estado,
    estado,
    ultimaActualizacion: pick(props, [
      "ULTIMA ACTUALIZACION",
      "ultima_actualizacion",
      "fecha_actualizacion",
      "fecha_modificacion",
      "updated_at",
      "fecha",
    ]),
    usuario: pick(props, ["responsable", "usuario", "actualizador", "usuario_responsable"]),
    geom: raw?.geometry || props.geometry || null,
  };
}

export async function getLayers() {
  const data = await apiFetch("/layers");
  const layers = Array.isArray(data)
    ? data
    : Array.isArray(data.layers)
      ? data.layers
      : Array.isArray(data.tables)
        ? data.tables
        : [];

  const filtered = layers.filter(isValidLayer);
  console.info(`[GIS] Capas validas: ${filtered.length}/${layers.length}`);
  return filtered;
}

export async function getLayer(table) {
  return apiFetch(`/layer/${encodeURIComponent(table)}`);
}

export async function getObrasDesdeGIS() {
  const layers = await getLayers();
  const results = await Promise.allSettled(
    layers.map(async (layer) => {
      const table = getLayerName(layer);
      const data = await getLayer(table);
      const features = data.features || data.data || data.rows || (Array.isArray(data) ? data : []);
      return features.map((feature) => normalizeGISFeature(feature, table));
    })
  );

  results
    .filter((result) => result.status === "rejected")
    .forEach((result) => console.warn("[GIS] No se pudo cargar una capa:", result.reason?.message));

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

export async function searchGIS(q) {
  const data = await apiFetch(`/search?q=${encodeURIComponent(q || "")}`);
  const features = data.features || data.results || data.data || (Array.isArray(data) ? data : []);
  return features.map((feature) => normalizeGISFeature(feature, "search"));
}
