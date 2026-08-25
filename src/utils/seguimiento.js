/**
 * utils/seguimiento.js
 * Capa de datos MOCK para la bandeja de tareas de SEGUIMIENTO_PS 2.0.
 * No toca backend: todo el estado vive en localStorage, namespaced por obra,
 * para que la demo se sienta interactiva entre recargas mientras se valida
 * el diseño visual.
 */

import { REQUERIMIENTOS, CATEGORIAS, getRequerimientosPorRol } from "../data/seguimientoCatalogo";
import { listarCapturaObra, guardarCapturaObra } from "../api/psSeguimientoApi";

export const ESTATUS_REGISTRO = {
  CUMPLIDO: "cumplido",
  PENDIENTE: "pendiente",
  ATRASADO: "atrasado",
  NO_APLICA: "no_aplica",
};

const REGISTROS_PREFIX = "seguimiento_registros::";
const VISITAS_PREFIX = "seguimiento_visitas::";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días naturales entre hoy y una fecha ISO (negativo = ya pasó) */
export function diasHastaFecha(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date(hoyISO() + "T00:00:00");
  const fecha = new Date(fechaISO + "T00:00:00");
  return Math.round((fecha - hoy) / 86400000);
}

/** Llave única de obra — misma convención usada en toda la bandeja de seguimiento */
export function getObraKey(obra) {
  return obra.clave_unica || `${obra.tabla || "obra"}::${obra.id_obra ?? obra.id ?? "sin-id"}`;
}

/* Hash determinista simple para generar semillas estables por obra+req */
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/* Cuentas de PS_SICOPS_FINAL trabajan sobre obras reales — no tiene caso
   "inventarles" cumplidos/atrasados de fábrica como en el resto de la app
   (pensado para que el demo se viera poblado). Todo arranca en blanco. */
export function esSesionReal() {
  try {
    return JSON.parse(localStorage.getItem("sicops_user") || "null")?.sistema === "ps_sicops_final";
  } catch {
    return false;
  }
}

/* Genera el estado inicial "de fábrica" para una obra, determinista por clave_unica.
   La fecha de compromiso de los pendientes se reparte en una ventana de 0-6 días
   (también determinista) para que "por vencer" sea distinguible de "pendiente"
   en los indicadores del inicio — ver utils/misPendientes.js. */
function generarEstadoInicial(obraKey, requerimientos) {
  if (esSesionReal()) {
    return requerimientos.map((req) => ({
      reqId: req.id,
      estatus: ESTATUS_REGISTRO.PENDIENTE,
      fechaCompromiso: null,
      fechaReal: null,
      motivo: "",
      evidenciaNombre: null,
      actualizadoPor: null,
    }));
  }

  return requerimientos.map((req) => {
    const seed = hashSeed(`${obraKey}::${req.id}`) % 100;
    let estatus = ESTATUS_REGISTRO.PENDIENTE;
    if (seed < 45) estatus = ESTATUS_REGISTRO.CUMPLIDO;
    else if (seed < 70) estatus = ESTATUS_REGISTRO.PENDIENTE;
    else if (seed < 90) estatus = ESTATUS_REGISTRO.ATRASADO;
    else estatus = ESTATUS_REGISTRO.NO_APLICA;

    const diasSeed = hashSeed(`${obraKey}::${req.id}::fecha`) % 7;

    return {
      reqId: req.id,
      estatus,
      fechaCompromiso: estatus === ESTATUS_REGISTRO.PENDIENTE ? addDaysISO(diasSeed) : hoyISO(),
      fechaReal: estatus === ESTATUS_REGISTRO.CUMPLIDO ? hoyISO() : null,
      motivo: "",
      evidenciaNombre: estatus === ESTATUS_REGISTRO.CUMPLIDO ? "evidencia_ejemplo.pdf" : null,
      actualizadoPor: null,
    };
  });
}

function loadOverrides(obraKey) {
  try {
    const raw = localStorage.getItem(REGISTROS_PREFIX + obraKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(obraKey, overrides) {
  try {
    localStorage.setItem(REGISTROS_PREFIX + obraKey, JSON.stringify(overrides));
  } catch {
    // localStorage no disponible (modo privado, cuota, etc.) — no bloquea la UI
  }
}

/**
 * Devuelve los registros de seguimiento de una obra, filtrados por el rol
 * que consulta, combinando la semilla determinista con overrides guardados.
 */
export function getRegistrosObra(obraKey, rol) {
  const requerimientosVisibles = getRequerimientosPorRol(rol);
  const base = generarEstadoInicial(obraKey, requerimientosVisibles);
  const overrides = loadOverrides(obraKey);

  return base.map((registro) => ({
    ...registro,
    ...(overrides[registro.reqId] || {}),
  }));
}

/** Todos los registros (sin filtrar por rol) — usado para el indicador agregado */
export function getRegistrosObraCompleto(obraKey) {
  const base = generarEstadoInicial(obraKey, REQUERIMIENTOS);
  const overrides = loadOverrides(obraKey);
  return base.map((registro) => ({
    ...registro,
    ...(overrides[registro.reqId] || {}),
  }));
}

/* Mapea el registro local (nombres en español, `evidenciaNombre`) al shape
   que espera el backend real (`evidenciaUrl`, sin acentos en las llaves) —
   los dos lados evolucionaron por separado y no hay razón para forzarlos a
   verse igual. */
function aFormatoServidor(registro) {
  return {
    estatus: registro.estatus,
    fechaCompromiso: registro.fechaCompromiso || null,
    fechaReal: registro.fechaReal || null,
    motivo: registro.motivo || null,
    evidenciaUrl: registro.evidenciaNombre || null,
  };
}

function deFormatoServidor(fila) {
  return {
    estatus: fila.estatus,
    fechaCompromiso: fila.fecha_compromiso ? String(fila.fecha_compromiso).slice(0, 10) : null,
    fechaReal: fila.fecha_real ? String(fila.fecha_real).slice(0, 10) : null,
    motivo: fila.motivo || "",
    evidenciaNombre: fila.evidencia_url || null,
    actualizadoPor: fila.actualizado_por || null,
  };
}

/* Trae el estado real de captura de una obra (Postgres, `ps_sicops_final`)
   y lo escribe como overrides locales — así `getRegistrosObra` sigue
   siendo síncrono para todos los componentes que ya lo usan (Dashboard,
   ListadoObras, Bandeja, misPendientes...) sin tener que volverlos
   asíncronos uno por uno. El servidor es la fuente de verdad para sesiones
   PS reales: sus filas reemplazan cualquier override local que hubiera
   para ese requerimiento. No hace nada si la sesión no es PS real o no
   hay `obraId` (obra no migrada a ps_sicops_final todavía). */
export async function hidratarCapturaDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  try {
    const { registros } = await listarCapturaObra(obraId);
    if (!registros?.length) return;
    const overrides = loadOverrides(obraKey);
    for (const fila of registros) {
      overrides[fila.req_id] = { ...(overrides[fila.req_id] || {}), ...deFormatoServidor(fila) };
    }
    saveOverrides(obraKey, overrides);
  } catch {
    // sin conexión o error del servidor: se queda con lo que ya había en
    // localStorage, no bloquea la pantalla por esto
  }
}

export function actualizarRegistro(obraKey, reqId, cambios, obraId) {
  const overrides = loadOverrides(obraKey);
  overrides[reqId] = { ...(overrides[reqId] || {}), ...cambios };
  saveOverrides(obraKey, overrides);

  // Sesión PS real con obra ya migrada: además de guardar local, se manda
  // en segundo plano al backend real — no bloquea la UI ni hace que
  // `actualizarRegistro` deje de ser síncrono para quien ya lo llama así.
  if (esSesionReal() && obraId) {
    guardarCapturaObra(obraId, reqId, aFormatoServidor(overrides[reqId])).catch(() => {
      // si falla la sincronización, el registro sigue disponible en
      // localStorage — se reintentará solo la próxima vez que se edite
      // este mismo requerimiento (no hay cola de reintentos todavía)
    });
  }

  return overrides[reqId];
}

/**
 * Indicador de avance calculado: % de requerimientos cumplidos sobre el
 * total aplicable (excluye "no aplica"). Cálculo exacto pendiente de
 * definición oficial — este es el sustituto visual del % capturado a mano.
 */
export function calcularIndicadorAvance(registros) {
  const aplicables = registros.filter((r) => r.estatus !== ESTATUS_REGISTRO.NO_APLICA);
  if (aplicables.length === 0) return 0;
  const cumplidos = aplicables.filter((r) => r.estatus === ESTATUS_REGISTRO.CUMPLIDO).length;
  return Math.round((cumplidos / aplicables.length) * 100);
}

export function contarPorEstatus(registros) {
  return registros.reduce(
    (acc, r) => {
      acc[r.estatus] = (acc[r.estatus] || 0) + 1;
      return acc;
    },
    { cumplido: 0, pendiente: 0, atrasado: 0, no_aplica: 0 }
  );
}

/* ── Visitas obligadas (check-in) ── */

function loadVisitasDia(obraKey) {
  try {
    const raw = localStorage.getItem(VISITAS_PREFIX + obraKey + "::" + hoyISO());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVisitasDia(obraKey, visitas) {
  try {
    localStorage.setItem(VISITAS_PREFIX + obraKey + "::" + hoyISO(), JSON.stringify(visitas));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

export function getVisitasHoy(obraKey, rol) {
  const todas = loadVisitasDia(obraKey);
  const key = String(rol || "").toUpperCase();
  return todas.filter((v) => v.rol === key);
}

export function registrarVisita(obraKey, rol, usuario, datos) {
  const todas = loadVisitasDia(obraKey);
  const { observaciones, avanceObservado, fotos, horaEntrada } =
    typeof datos === "string" ? { observaciones: datos } : (datos || {});
  const visita = {
    rol: String(rol || "").toUpperCase(),
    usuario: usuario || "sistema",
    hora: new Date().toISOString(),
    horaEntrada: horaEntrada || null,
    observaciones: observaciones || "",
    avanceObservado: typeof avanceObservado === "number" ? avanceObservado : null,
    fotos: Array.isArray(fotos) ? fotos : [],
  };
  todas.push(visita);
  saveVisitasDia(obraKey, todas);
  return visita;
}

/* ── Borrador de visita — guarda en progreso mientras el funcionario no
   confirma; se limpia al finalizar. Un borrador por (obra, rol). ── */
const VISITA_BORRADOR_PREFIX = "seguimiento_visita_borrador::";

function claveBorradorVisita(obraKey, rol) {
  return `${VISITA_BORRADOR_PREFIX}${obraKey}::${String(rol || "").toUpperCase()}`;
}

export function getBorradorVisita(obraKey, rol) {
  try {
    const raw = localStorage.getItem(claveBorradorVisita(obraKey, rol));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function guardarBorradorVisita(obraKey, rol, datos) {
  try {
    localStorage.setItem(claveBorradorVisita(obraKey, rol), JSON.stringify(datos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

export function limpiarBorradorVisita(obraKey, rol) {
  try {
    localStorage.removeItem(claveBorradorVisita(obraKey, rol));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

/**
 * Todas las visitas de hoy de un rol, en cualquier obra — recorre las
 * bitácoras diarias en localStorage para armar "a qué obra fue" en el
 * panel de inicio (no requiere estar dentro de una obra específica).
 */
export function getVisitasHoyPorRolGlobal(rol) {
  const key = String(rol || "").toUpperCase();
  const sufijo = "::" + hoyISO();
  const resultado = [];
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey || !storageKey.startsWith(VISITAS_PREFIX) || !storageKey.endsWith(sufijo)) continue;
    const obraKey = storageKey.slice(VISITAS_PREFIX.length, storageKey.length - sufijo.length);
    try {
      const visitas = JSON.parse(localStorage.getItem(storageKey) || "[]");
      for (const v of visitas) {
        if (v.rol === key) resultado.push({ obraKey, ...v });
      }
    } catch {
      // registro corrupto — se ignora
    }
  }
  return resultado.sort((a, b) => new Date(a.hora) - new Date(b.hora));
}

/**
 * Estadística global por requerimiento — cuenta cumplido/aplicable a lo
 * largo de todas las obras dadas. Usado en el panel de inicio de ADMIN.
 */
export function getEstadisticasGlobalesPorRequerimiento(obraKeys) {
  const conteos = {};
  for (const req of REQUERIMIENTOS) {
    conteos[req.id] = { cumplido: 0, aplicable: 0, total: 0 };
  }
  for (const obraKey of obraKeys) {
    const registros = getRegistrosObraCompleto(obraKey);
    for (const r of registros) {
      const c = conteos[r.reqId];
      if (!c) continue;
      c.total += 1;
      if (r.estatus === ESTATUS_REGISTRO.NO_APLICA) continue;
      c.aplicable += 1;
      if (r.estatus === ESTATUS_REGISTRO.CUMPLIDO) c.cumplido += 1;
    }
  }
  return conteos;
}

/**
 * Cumplimiento por categoría — para el panel "Cumplimiento por categoría"
 * del inicio: agrupa los requerimientos visibles para el rol a través de
 * todas las obras del usuario.
 */
export function getCumplimientoPorCategoria(obraKeys, rol) {
  const requerimientosRol = getRequerimientosPorRol(rol);
  const categoriaPorReq = Object.fromEntries(requerimientosRol.map((r) => [r.id, r.categoria]));

  const conteos = {};
  for (const categoria of CATEGORIAS) conteos[categoria] = { cumplido: 0, aplicable: 0 };

  for (const obraKey of obraKeys) {
    const registros = getRegistrosObra(obraKey, rol);
    for (const r of registros) {
      const categoria = categoriaPorReq[r.reqId];
      if (!categoria || !conteos[categoria]) continue;
      if (r.estatus === ESTATUS_REGISTRO.NO_APLICA) continue;
      conteos[categoria].aplicable += 1;
      if (r.estatus === ESTATUS_REGISTRO.CUMPLIDO) conteos[categoria].cumplido += 1;
    }
  }

  return Object.entries(conteos)
    .filter(([, v]) => v.aplicable > 0)
    .map(([categoria, v]) => ({
      categoria,
      ...v,
      pct: Math.round((v.cumplido / v.aplicable) * 100),
    }));
}
