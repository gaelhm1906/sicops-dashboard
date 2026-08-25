/**
 * utils/estudioAutorizacion.js — REQ-04 (estudio ambiental) y REQ-05
 * (estudio de impacto urbano). Mismo manejo por etapas para los dos:
 * estatus (sin iniciar / en proceso / concluido) + acuse en PDF cuando
 * concluye. Un mismo componente de captura sirve para ambos REQ, solo
 * cambia la etiqueta según `reqId`. Persistencia MOCK en localStorage,
 * namespaced por obra + requerimiento.
 */
const PREFIX = "estudio_autorizacion::";

export const ETAPA_ESTUDIO = {
  SIN_INICIAR: "sin_iniciar",
  EN_PROCESO: "en_proceso",
  CONCLUIDO: "concluido",
};

export const ETAPA_INFO = {
  [ETAPA_ESTUDIO.SIN_INICIAR]: { label: "Sin iniciar", color: "var(--rojo)" },
  [ETAPA_ESTUDIO.EN_PROCESO]: { label: "En proceso", color: "var(--naranja)" },
  [ETAPA_ESTUDIO.CONCLUIDO]: { label: "Concluido", color: "var(--verde)" },
};

export const NOMBRE_ESTUDIO = {
  "REQ-04": "Estudio ambiental",
  "REQ-05": "Estudio de impacto urbano",
};

/* Ajuste de minuta (sesión de revisión #6): un solo "acuse" ya no alcanza
   — durante "En proceso" puede haber oficio de observaciones y su acuse
   de subsanación, además del acuse original. */
export const DOCUMENTOS_ESTUDIO = {
  acuse: "Acuse",
  oficioObservaciones: "Oficio de observaciones",
  acuseSubsanacion: "Acuse de subsanación",
};

function clave(obraKey, reqId) {
  return `${PREFIX}${obraKey}::${reqId}`;
}

const DOCUMENTOS_VACIO = { acuse: null, oficioObservaciones: null, acuseSubsanacion: null };
const ESTADO_VACIO = { etapa: ETAPA_ESTUDIO.SIN_INICIAR, fechaActualizacion: null, documentos: { ...DOCUMENTOS_VACIO }, notas: "" };

export function getEstudio(obraKey, reqId) {
  try {
    const raw = localStorage.getItem(clave(obraKey, reqId));
    const data = raw ? JSON.parse(raw) : null;
    return {
      ...ESTADO_VACIO,
      ...data,
      documentos: { ...DOCUMENTOS_VACIO, ...(data?.documentos || {}) },
    };
  } catch {
    return { ...ESTADO_VACIO };
  }
}

export function guardarEstudio(obraKey, reqId, datos) {
  try {
    localStorage.setItem(clave(obraKey, reqId), JSON.stringify(datos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return datos;
}
