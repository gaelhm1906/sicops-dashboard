/**
 * utils/evaluaciones.js
 * Evaluaciones del secretario sobre un requerimiento específico de una
 * obra — capa "offline" en localStorage, misma convención que el resto
 * del seguimiento (utils/seguimiento.js). Una evaluación por combinación
 * (obra, requerimiento): estado + observación técnica.
 *
 * La observación "se envía como notificación al responsable" — por ahora
 * el canal real (correo/push) no existe, así que guardarEvaluacion solo
 * marca `notificado: true` para que la UI lo refleje; el envío real se
 * conecta cuando exista ese mecanismo.
 *
 * Ajuste de minuta (sesión de revisión #13): toda observación del
 * Secretario se copia automáticamente al Director General de la obra —
 * por eso `guardarEvaluacion` ahora guarda también el `dg` de la obra, y
 * `resumenPendientesPorObra` deja construir la vista de "pendientes por
 * obra y proyecto" que la minuta pide generar automáticamente.
 *
 * "Muestra la observación en su bandeja de entrada" (minuta original):
 * `listarBandejaPara` arma esa bandeja — para el responsable operativo
 * filtra por su rol contra `REQUERIMIENTOS.responsables`; para
 * ADMIN/SECRETARIO/Director General filtra por Dirección General (o
 * todas, si no tiene una fija). `leida` es un estado de lectura propio
 * del destinatario, independiente del `estado` que asigna el Secretario.
 */
import { REQUERIMIENTOS } from "../data/seguimientoCatalogo";
import { esVistaEjecutiva, dgFijaPara } from "./roles";
import { getObraKey } from "./seguimiento";

const PREFIX = "evaluacion::";
const PREFIX_HISTORIAL = "evaluacion_historial::";

export const ESTADO_EVALUACION = {
  NO_ATENDIDO: "no_atendido",
  ATENDIDO_PARCIAL: "atendido_parcial",
  ATENDIDO: "atendido",
};

export const ESTADO_EVALUACION_INFO = {
  [ESTADO_EVALUACION.NO_ATENDIDO]: { label: "No atendido", color: "var(--rojo)" },
  [ESTADO_EVALUACION.ATENDIDO_PARCIAL]: { label: "Atendido parcial", color: "var(--naranja)" },
  [ESTADO_EVALUACION.ATENDIDO]: { label: "Atendido", color: "var(--verde)" },
};

function clave(obraKey, reqId) {
  return `${PREFIX}${obraKey}::${reqId}`;
}

function claveHistorial(obraKey, reqId) {
  return `${PREFIX_HISTORIAL}${obraKey}::${reqId}`;
}

export function getEvaluacion(obraKey, reqId) {
  try {
    const raw = localStorage.getItem(clave(obraKey, reqId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Historial completo de observaciones sobre este (obra, requerimiento),
 * más reciente primero. Ajuste de reunión con el Secretario (12 de
 * agosto, sesión DGCOP, propuesta de Rey): la observación actual
 * (`getEvaluacion`) seguía siendo la única que existía — cada nueva
 * pisaba la anterior, así que no había "histórico" real, solo el último
 * estado. El historial vive en una clave aparte para no tocar el
 * contrato de `getEvaluacion`/`listarTodas`/`listarBandejaPara`, que
 * varias pantallas ya asumen como "un objeto por (obra, requerimiento)".
 */
export function getHistorial(obraKey, reqId) {
  try {
    const raw = localStorage.getItem(claveHistorial(obraKey, reqId));
    const historial = raw ? JSON.parse(raw) : [];
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

export function guardarEvaluacion(obraKey, reqId, { estado, observacion, evaluadoPor, dg, obraNombre }) {
  const evaluacion = {
    estado,
    observacion: observacion || "",
    evaluadoPor: evaluadoPor || "sistema",
    fecha: new Date().toISOString(),
    notificado: true,
    /* copia automática al Director General de la obra (ajuste #13) */
    dg: dg || null,
    obraNombre: obraNombre || null,
    obraKey,
    reqId,
    /* nueva observación = no leída para el destinatario (bandeja de entrada) */
    leida: false,
  };
  try {
    localStorage.setItem(clave(obraKey, reqId), JSON.stringify(evaluacion));
    const historialPrevio = getHistorial(obraKey, reqId);
    localStorage.setItem(claveHistorial(obraKey, reqId), JSON.stringify([evaluacion, ...historialPrevio]));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return evaluacion;
}

export function marcarLeida(obraKey, reqId) {
  const evaluacion = getEvaluacion(obraKey, reqId);
  if (!evaluacion || evaluacion.leida) return evaluacion;
  const next = { ...evaluacion, leida: true };
  try {
    localStorage.setItem(clave(obraKey, reqId), JSON.stringify(next));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return next;
}

/** Todas las evaluaciones guardadas, sin filtrar por estado. */
export function listarTodas() {
  const todas = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      todas.push(JSON.parse(raw));
    }
  } catch {
    // localStorage no disponible o corrupto: no bloquea la UI
  }
  return todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/**
 * Bandeja de entrada del usuario actual — "muestra la observación en su
 * bandeja de entrada" (minuta original). Un responsable operativo ve las
 * observaciones de los requerimientos que le corresponden por rol; un
 * Director General ve las de su Dirección General; ADMIN/SECRETARIO ven
 * todas (ya tienen su propio resumen agregado en Revisión Integral, pero
 * aquí pueden revisar el detalle uno por uno).
 */
export function listarBandejaPara(user) {
  const rol = String(user?.rol || "").toUpperCase();
  const todas = listarTodas();

  if (esVistaEjecutiva(rol)) {
    const dgFija = dgFijaPara(user);
    return dgFija ? todas.filter((e) => e.dg === dgFija) : todas;
  }

  return todas.filter((e) => {
    const requerimiento = REQUERIMIENTOS.find((r) => r.id === e.reqId);
    return requerimiento?.responsables?.includes(rol);
  });
}

export function contarNoLeidas(user) {
  return listarBandejaPara(user).filter((e) => !e.leida).length;
}

/* ── DEMO TEMPORAL — no es información oficial ──────────────────────────
   Observaciones de ejemplo para que cada rol responsable (y el Director
   General/Secretario/Admin) tengan algo que ver en su Bandeja de entrada
   sin depender de que alguien capture una evaluación real primero. Se
   siembra UNA vez por navegador (misma convención que
   OBRAS_DEMO_DGPEST en Dashboard.jsx), un ejemplo por rol responsable,
   sobre una obra real cualquiera — no inventa obras ni datos de avance,
   solo la observación. Se marca explícitamente como "(ejemplo)" para no
   confundirse con retroalimentación real del Secretario. */
const OBSERVACIONES_EJEMPLO_TEXTO = [
  "Falta actualizar la evidencia de esta semana — no se ha registrado avance.",
  "Se detectó inconsistencia entre lo reportado y la visita de campo realizada. Favor de revisar.",
  "Buen avance. Solo falta adjuntar el documento de respaldo correspondiente.",
  "Este requerimiento lleva dos semanas sin captura. Se solicita atención inmediata.",
  "La información capturada no coincide con el expediente físico. Verificar antes de la próxima revisión.",
];

const ESTADOS_EJEMPLO = [ESTADO_EVALUACION.NO_ATENDIDO, ESTADO_EVALUACION.ATENDIDO_PARCIAL, ESTADO_EVALUACION.ATENDIDO];

export function sembrarObservacionesDemo(base) {
  const FLAG = "demo_observaciones_seeded_v1";
  try {
    if (localStorage.getItem(FLAG)) return;
  } catch {
    return;
  }
  if (!Array.isArray(base) || base.length === 0) return;

  const rolesVistos = new Set();
  let i = 0;

  for (const requerimiento of REQUERIMIENTOS) {
    for (const rol of requerimiento.responsables || []) {
      if (rolesVistos.has(rol)) continue;
      rolesVistos.add(rol);

      const obra = base[i % base.length];
      const obraKey = getObraKey(obra);
      const dg = (obra.dg || obra.direccion_general || "").trim() || null;

      guardarEvaluacion(obraKey, requerimiento.id, {
        estado: ESTADOS_EJEMPLO[i % ESTADOS_EJEMPLO.length],
        observacion: `${OBSERVACIONES_EJEMPLO_TEXTO[i % OBSERVACIONES_EJEMPLO_TEXTO.length]} (ejemplo)`,
        evaluadoPor: "Secretario (ejemplo)",
        dg,
        obraNombre: obra.nombre_obra || obra.nombre,
      });

      i += 1;
    }
  }

  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

/** Todas las evaluaciones guardadas cuyo estado aún no es "Atendido". */
export function listarPendientes() {
  const pendientes = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const evaluacion = JSON.parse(raw);
      if (evaluacion.estado !== ESTADO_EVALUACION.ATENDIDO) pendientes.push(evaluacion);
    }
  } catch {
    // localStorage no disponible o corrupto: no bloquea la UI
  }
  return pendientes;
}

/**
 * Resumen automático de pendientes por Dirección General → obra
 * (ajuste #13). Independiente de `base` (no requiere recorrer todas las
 * obras, solo agrupa lo que ya está guardado como evaluación pendiente).
 */
export function resumenPendientesPorObra() {
  const pendientes = listarPendientes();
  const porDg = {};
  for (const p of pendientes) {
    const dg = p.dg || "Sin Dirección General";
    if (!porDg[dg]) porDg[dg] = { dg, total: 0, obras: {} };
    porDg[dg].total += 1;
    const nombreObra = p.obraNombre || p.obraKey;
    if (!porDg[dg].obras[nombreObra]) porDg[dg].obras[nombreObra] = { obraKey: p.obraKey, nombre: nombreObra, count: 0 };
    porDg[dg].obras[nombreObra].count += 1;
  }
  return Object.values(porDg)
    .map((d) => ({ ...d, obras: Object.values(d.obras).sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.total - a.total);
}
