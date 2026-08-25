/**
 * utils/expedienteUnico.js — REQ-19.
 * Checklist homologado (minuta 2026-08-12, reemplaza la primera versión
 * de la sesión #12): un solo formato documental para los tres
 * procedimientos de contratación (adjudicación directa, invitación
 * restringida, licitación pública) — ya no cambia según el tipo elegido.
 * Fuente: "CACSA 2026 - PLATAFORMA Expedientes Unicos de Contratos (4).xlsx
 * - Hoja 1.csv" (ARCHIVOS_TRABAJO). Se excluyeron del listado original los
 * dos oficios de aviso de inicio dirigidos a Territorial y a Seguridad
 * Pública (III.10 y III.11 en el CSV) — aplicaban solo cuando la
 * dependencia era una alcaldía, pedido explícito del área.
 * Persistencia MOCK en localStorage, namespaced por obra.
 */
const PREFIX = "expediente_unico::";

/* Tipo de procedimiento: se sigue capturando como dato del contrato (no se
   usa en ningún otro módulo hoy, ver grep previo a este cambio), pero ya
   NO determina el checklist — los tres comparten el mismo formato. */
export const TIPO_PROCEDIMIENTO = {
  ADJUDICACION_DIRECTA: "adjudicacion_directa",
  INVITACION_RESTRINGIDA: "invitacion_restringida",
  LICITACION_PUBLICA: "licitacion_publica",
};

export const TIPO_PROCEDIMIENTO_INFO = {
  [TIPO_PROCEDIMIENTO.ADJUDICACION_DIRECTA]: { label: "Adjudicación directa" },
  [TIPO_PROCEDIMIENTO.INVITACION_RESTRINGIDA]: { label: "Invitación restringida" },
  [TIPO_PROCEDIMIENTO.LICITACION_PUBLICA]: { label: "Licitación pública" },
};

/* Estatus por documento — reemplaza el booleano hecho/no-hecho de la
   primera versión.
   Ajuste de UX/UI (separar estado de "Sí" de la acción de cargar): "Sí"
   ya es un estado seleccionable por sí solo (setEstatusDocumento lo
   acepta), pero eso NO basta para contar como completado — ver
   progresoExpediente/progresoSeccion, que exigen además archivoNombre.
   La regla "todo sí debe sostenerse con documento" se sigue cumpliendo,
   solo que ahora vive en el cálculo de avance en vez de en qué botón
   existe. */
export const ESTATUS_DOCUMENTO = {
  SI: "si",
  NO: "no",
  EN_PROCESO: "en_proceso",
  NO_APLICA: "no_aplica",
};

export const ESTATUS_DOCUMENTO_INFO = {
  [ESTATUS_DOCUMENTO.SI]: { label: "Sí", bg: "#ecfdf5", color: "#16a34a", border: "#bbf7d0" },
  [ESTATUS_DOCUMENTO.NO]: { label: "No", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  [ESTATUS_DOCUMENTO.EN_PROCESO]: { label: "En proceso", bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  [ESTATUS_DOCUMENTO.NO_APLICA]: { label: "No aplica", bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
};

/* Documentos cuya ÁREA RESPONSABLE venía marcada "NO APLICA" directo en el
   CSV de origen — arrancan en No aplica por default (el área puede
   cambiarlo si en un contrato concreto sí aplica; no queda bloqueado). */
const IDS_NO_APLICA_DEFAULT = new Set(["III.4", "III.6", "III.35"]);

/* Checklist homologado — transcrito 1:1 del CSV (numeración y nombres
   originales), agrupado por sección (columna "No." con número romano).
   Los IDs (ej. "III.9") son estables entre sesiones: si el área vuelve a
   ajustar el listado, agregar/quitar aquí no revuelve el progreso ya
   capturado de los demás documentos (las claves de `checklist` son estos
   IDs, no el índice de la lista). */
export const CHECKLIST_HOMOLOGADO = [
  {
    seccion: "I",
    titulo: "Etapa de contratación",
    documentos: [
      { id: "I.1", nombre: "Propuesta Técnica", area: "Por la Dependencia" },
      { id: "I.2", nombre: "Propuesta Económica", area: "Por la Dependencia" },
    ],
  },
  {
    seccion: "II",
    titulo: "Documentos para licitación",
    documentos: [
      { id: "II.1", nombre: "Oficio de entrega de documentación de licitación", area: "Por la Dependencia" },
      { id: "II.2", nombre: "Términos de referencia", area: "Por la Dependencia" },
      { id: "II.3", nombre: "Catálogo de conceptos de referencia", area: "Por la Dependencia" },
      { id: "II.4", nombre: "Presupuesto de referencia", area: "Por la Dependencia" },
    ],
  },
  {
    seccion: "III",
    titulo: "Documentación contrato",
    documentos: [
      { id: "III.1", nombre: "Contrato firmado y rubricado", area: null },
      { id: "III.2", nombre: "Catálogo autorizado", area: null },
      { id: "III.3", nombre: "Programa de ejecución de los servicios (Montos y porcentajes)", area: null },
      { id: "III.4", nombre: "Fianza de anticipo", area: "NO APLICA" },
      { id: "III.5", nombre: "Fianza de cumplimiento", area: "Por la Contratista" },
      { id: "III.6", nombre: "Póliza de Responsabilidad civil", area: "NO APLICA" },
      { id: "III.7", nombre: 'Oficio de aviso de inicio de los servicios por "LA CONTRATISTA"', area: "Por la Contratista" },
      { id: "III.8", nombre: 'Oficio de aviso de inicio de los servicios por "LA ALCALDÍA"', area: "Por la Dependencia" },
      { id: "III.9", nombre: 'Oficio de aviso de inicio de los trabajos dirigido a "CONTRALORÍA"', area: "Por la Dependencia" },
      // III.10 (Seguridad Pública) y III.11 (Territorial) eliminados —
      // aplicaban solo en alcaldía, pedido del área 2026-08-12.
      { id: "III.12", nombre: 'Oficio de Designación de Residente "ADMINISTRACIÓN PÚBLICA"', area: "Por la Dependencia" },
      { id: "III.13", nombre: 'Oficio de Designación de "SUPERVISIÓN EXTERNA" (COORDINADORA)', area: "Por la Dependencia" },
      { id: "III.14", nombre: "Oficio de Disposición de Inmueble", area: "Por la Dependencia" },
      { id: "III.15", nombre: 'Representante Técnico por "LA CONTRATISTA"', area: "Por la Contratista" },
      { id: "III.16", nombre: 'Plantilla de Personal por "LA CONTRATISTA"', area: "Por la Contratista" },
      { id: "III.17", nombre: "Oficio de entrega Nota de apertura de bitácora", area: "Por la Dependencia" },
      { id: "III.18", nombre: "Bitácora concluida (Con las firmas correspondientes)", area: "Alcaldía y Contratista" },
      { id: "III.19", nombre: "Informes y reportes de avances físicos y financieros SEMANALES y MENSUALES", area: "Por la Contratista" },
      { id: "III.20", nombre: "Álbum fotográfico", area: "Por la Contratista" },
      { id: "III.21", nombre: "Estimaciones (Carátula, Factura)", area: "Por la Contratista" },
      { id: "III.22", nombre: "Estimaciones (Soportes)", area: "Por la Contratista" },
      { id: "III.23", nombre: "Normas de Calidad de los Materiales", area: "Por la Contratista" },
      { id: "III.24", nombre: "Normas de Construcción", area: "Por la Contratista" },
      { id: "III.25", nombre: "Prueba de Laboratorio (Aplicables)", area: "Por la Contratista" },
      { id: "III.26", nombre: "Fichas Técnicas y Garantías de los Trabajos (Aplicables)", area: "Por la Contratista" },
      { id: "III.27", nombre: "Actualización de Planos (Aplicables)", area: "Por la Contratista" },
      { id: "III.28", nombre: "Oficio de entrega de Estado contable", area: "Por la Contratista" },
      { id: "III.29", nombre: "Oficio de entrega de Sábana Finiquito", area: "Por la Contratista" },
      { id: "III.30", nombre: "Fianza de Vicios Ocultos", area: "Por la Contratista" },
      { id: "III.32", nombre: 'Oficio de Terminación de los Trabajos 10 días antes "CONTRATISTA"', area: "Por la Contratista" },
      { id: "III.33", nombre: 'Oficio de Terminación de los Trabajos "CONTRATISTA"', area: "Por la Contratista" },
      { id: "III.34", nombre: "Entrega de minutas del contrato", area: "Alcaldía y Contratista" },
      { id: "III.35", nombre: "Autorización de Precios Excedentes y Extraordinarios", area: "NO APLICA" },
      { id: "III.36", nombre: "Oficios de comunicación y varios", area: "Alcaldía y Contratista" },
    ],
  },
  {
    seccion: "IV",
    titulo: "En caso de convenios, suspensiones, rescisiones (aplicables)",
    documentos: [
      { id: "IV.1", nombre: "Oficios de suspensión y/u otros avisos", area: "Por la Dependencia" },
      { id: "IV.2", nombre: "Actas Circunstanciadas (Aplicables)", area: "Por la Dependencia" },
      { id: "IV.3", nombre: "Dictámenes Técnicos para la justificación (Aplicables)", area: "Por la Dependencia" },
      { id: "IV.4", nombre: "Reprogramaciones debidamente justificadas (Aplicables)", area: "Por la Dependencia" },
      { id: "IV.5", nombre: "Convenios Modificatorios (Aplicables)", area: "Por la Dependencia" },
      { id: "IV.6", nombre: "Fianzas de cumplimiento por convenios ampliatorios (Aplicables)", area: "Por la Dependencia" },
    ],
  },
  {
    seccion: "V",
    titulo: "Entrega-recepción",
    documentos: [
      { id: "V.1", nombre: "Oficio de Obras Recepcionadas al Área Responsable", area: "Por la Dependencia" },
      { id: "V.2", nombre: 'Aviso de la recepción del contrato dirigido a "LA CONTRALORÍA"', area: "Por la Dependencia" },
      { id: "V.3", nombre: 'Aviso de la recepción del contrato dirigido a "LA CONTRATISTA"', area: "Por la Dependencia" },
      { id: "V.4", nombre: "Minuta de Recepción Física de los Trabajos", area: "Por la Dependencia" },
      { id: "V.5", nombre: "Acta de Recepción Parcial del contrato", area: "Por la Dependencia" },
      { id: "V.6", nombre: "Acta de Constatación y Verificación de Término de los trabajos", area: "Por la Dependencia" },
      { id: "V.7", nombre: "Acta de Entrega recepción de los trabajos", area: "Por la Dependencia" },
      { id: "V.8", nombre: "Acta Finiquito del contrato", area: "Por la Dependencia" },
      { id: "V.9", nombre: "Acta Liquidación del contrato", area: "Por la Dependencia" },
    ],
  },
  {
    seccion: "VI",
    titulo: "Otros",
    documentos: [{ id: "VI.1", nombre: "Otros Documentos", area: null }],
  },
];

/* Lista plana de {id, nombre, area, seccion, titulo} — evita recorrer
   CHECKLIST_HOMOLOGADO cada vez que se necesita un documento por id. */
const DOCUMENTOS_FLAT = CHECKLIST_HOMOLOGADO.flatMap((s) =>
  s.documentos.map((d) => ({ ...d, seccion: s.seccion, tituloSeccion: s.titulo }))
);

function clave(obraKey) {
  return `${PREFIX}${obraKey}`;
}

function checklistInicial() {
  return Object.fromEntries(
    DOCUMENTOS_FLAT.map((d) => [
      d.id,
      { estatus: IDS_NO_APLICA_DEFAULT.has(d.id) ? ESTATUS_DOCUMENTO.NO_APLICA : ESTATUS_DOCUMENTO.NO, archivoNombre: null },
    ])
  );
}

const ESTADO_VACIO = () => ({ tipoProcedimiento: null, checklist: checklistInicial(), observaciones: "" });

/* El checklist ya no depende de elegir un tipo de procedimiento primero —
   "por default" está disponible desde que se abre el expediente (pedido
   del área 2026-08-12). Si el estado guardado es de la versión anterior
   (checklist plano doc->boolean, o vacío) se reconstruye con el formato
   homologado sin perder tipoProcedimiento/observaciones ya capturados. */
export function getExpediente(obraKey) {
  let guardado = null;
  try {
    const raw = localStorage.getItem(clave(obraKey));
    guardado = raw ? JSON.parse(raw) : null;
  } catch {
    guardado = null;
  }
  if (!guardado) return ESTADO_VACIO();

  const checklistValido =
    guardado.checklist &&
    DOCUMENTOS_FLAT.every((d) => guardado.checklist[d.id] && typeof guardado.checklist[d.id] === "object");

  return {
    ...ESTADO_VACIO(),
    ...guardado,
    checklist: checklistValido ? guardado.checklist : checklistInicial(),
  };
}

export function guardarExpediente(obraKey, estado) {
  try {
    localStorage.setItem(clave(obraKey), JSON.stringify(estado));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return estado;
}

/** Solo registra el tipo de procedimiento — ya no reconstruye el checklist. */
export function setTipoProcedimiento(obraKey, tipoProcedimiento) {
  return guardarExpediente(obraKey, { ...getExpediente(obraKey), tipoProcedimiento });
}

/* Cambia el estatus de un documento a mano. Cambiar a "No"/"En
   proceso"/"No aplica" limpia la evidencia cargada: esos estatus no
   deben seguir cargando con un archivo de un estatus anterior, quedaría
   contradictorio en el acuse. Cambiar a "Sí" es distinto: es un estado
   que se puede seleccionar SIN archivo todavía (queda pendiente de
   carga — ver progresoExpediente, no cuenta como completado hasta que
   haya evidencia), así que conserva el archivo si ya había uno (re-
   seleccionar "Sí" no debe borrar un documento ya cargado). */
export function setEstatusDocumento(obraKey, docId, estatus) {
  const actual = getExpediente(obraKey);
  const archivoNombre = estatus === ESTATUS_DOCUMENTO.SI
    ? actual.checklist[docId]?.archivoNombre ?? null
    : null;
  const next = {
    ...actual,
    checklist: { ...actual.checklist, [docId]: { estatus, archivoNombre } },
  };
  return guardarExpediente(obraKey, next);
}

/** Cargar evidencia — deja el estatus en "Sí" (si no lo estaba ya) con el archivo adjunto. */
export function cargarDocumento(obraKey, docId, archivoNombre) {
  const actual = getExpediente(obraKey);
  const next = {
    ...actual,
    checklist: { ...actual.checklist, [docId]: { estatus: ESTATUS_DOCUMENTO.SI, archivoNombre } },
  };
  return guardarExpediente(obraKey, next);
}

/* Quitar la evidencia deja el documento en "Sí" pero sin archivo — vuelve
   a "pendiente de carga" (reaparece el bloque para subirlo), no salta a
   "No": quitar un archivo no es lo mismo que declarar que el requisito
   no se cumple, son dos decisiones distintas (justo la separación que
   pidió este ajuste). */
export function quitarDocumento(obraKey, docId) {
  const actual = getExpediente(obraKey);
  const next = {
    ...actual,
    checklist: { ...actual.checklist, [docId]: { estatus: ESTATUS_DOCUMENTO.SI, archivoNombre: null } },
  };
  return guardarExpediente(obraKey, next);
}

export function cambiarObservaciones(obraKey, observaciones) {
  return guardarExpediente(obraKey, { ...getExpediente(obraKey), observaciones });
}

/* Un documento cuenta como "hecho" solo con "Sí" Y archivo cargado —
   "Sí" por sí solo (ajuste de UX/UI: separar el estado de la acción de
   cargar) es un estado válido pero significa "pendiente de carga", no
   completado. Evita que el contador reporte un documento como
   entregado cuando todavía no hay evidencia. */
function estaCompleto(doc) {
  return doc.estatus === ESTATUS_DOCUMENTO.SI && !!doc.archivoNombre;
}

/* Documentos marcados "Sí" sin archivo todavía — el llamador los usa
   para BLOQUEAR el guardado del requerimiento completo (no basta con
   que el % ya no los cuente; se le debe avisar al usuario y no dejarlo
   guardar con un "Sí" sin comprobante real, pedido explícito). */
export function documentosPendientesDeCarga(estado) {
  return DOCUMENTOS_FLAT.filter((d) => {
    const v = (estado.checklist || {})[d.id];
    return v?.estatus === ESTATUS_DOCUMENTO.SI && !v.archivoNombre;
  });
}

/* Progreso — "No aplica" no cuenta como negativo: el porcentaje se calcula
   solo sobre lo que sí aplica (pedido explícito del área 2026-08-12), no
   sobre el total del listado. Mismo criterio que ya usa el resto del
   sistema para requerimientos completos (ver utils/seguimiento.js). */
export function progresoExpediente(estado) {
  const todos = Object.values(estado.checklist || {});
  const aplicables = todos.filter((d) => d.estatus !== ESTATUS_DOCUMENTO.NO_APLICA);
  const hechos = aplicables.filter(estaCompleto).length;
  return {
    hechos,
    total: aplicables.length,
    totalConNoAplica: todos.length,
    noAplica: todos.length - aplicables.length,
    pct: aplicables.length > 0 ? Math.round((hechos / aplicables.length) * 100) : 0,
  };
}

/** Igual que progresoExpediente pero acotado a los documentos de una sección — para el contador de cada acordeón. */
export function progresoSeccion(estado, seccion) {
  const ids = DOCUMENTOS_FLAT.filter((d) => d.seccion === seccion).map((d) => d.id);
  const docs = ids.map((id) => (estado.checklist || {})[id]).filter(Boolean);
  const aplicables = docs.filter((d) => d.estatus !== ESTATUS_DOCUMENTO.NO_APLICA);
  const hechos = aplicables.filter(estaCompleto).length;
  return { hechos, total: aplicables.length };
}
