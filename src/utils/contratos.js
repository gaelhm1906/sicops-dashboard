/**
 * utils/contratos.js
 * Registro de contratos — INDEPENDIENTE de cualquier obra (ajuste de
 * flujo: "paso 1, el Director de Concursos y Contratos captura la
 * carátula del contrato" — sin necesitar una obra todavía).
 *
 * "Paso 2": estos contratos se VINCULAN a una o varias obras del
 * catálogo existente — la vinculación es la llave de datos duros para
 * saber cuántos contratos atienden qué obra y cuántas obras están bajo
 * qué contrato (minuta: "utilizar el número de contrato como llave de
 * vinculación; a partir de él, la información de la carátula se asocia
 * a la obra"). Es muchos-a-muchos: un contrato puede servir varias
 * obras, una obra puede tener varios contratos (ejecución, convenios).
 *
 * Persistencia MOCK en localStorage. El `id` interno es estable y
 * distinto del "número de contrato" (que es editable texto libre).
 */
const REGISTRO_PREFIX = "contrato_registro::";
const VINCULOS_KEY = "contrato_vinculos";

/* Ajuste de fondo (área técnica, 11 de agosto): cada obra tiene DOS
   contratos distintos, no una sola carátula con "supervisión" como
   campos sueltos. El contrato de obra (con la contratista) y el
   contrato de supervisión externa (5-6% del monto de la obra) son
   registros independientes, cada uno con su propia carátula, su propio
   avance y sus propias estimaciones — y "conviven en el mismo informe".
   `tipo_contrato` distingue el registro; `contrato_supervision_id` en
   un contrato de obra apunta al contrato de supervisión que lo
   atiende (una supervisión puede cubrir varias empresas de obra con un
   mismo contrato — relación muchos a uno, no uno a uno). */
export const TIPO_CONTRATO_OBRA = "obra";
export const TIPO_CONTRATO_SUPERVISION = "supervision";

export const CONTRATO_VACIO = {
  tipo_contrato: TIPO_CONTRATO_OBRA,
  /* Solo aplica cuando tipo_contrato === "obra": id del contrato de
     supervisión (otro registro independiente) que le da seguimiento. */
  contrato_supervision_id: "",

  numero_contrato: "",
  procedimiento: "",
  numero_concurso: "",
  fecha_contrato: "",
  dependencia: "SOBSE",
  direccion_general: "",
  programa: "",
  area_responsable: "",
  importe_sin_iva: "",
  iva: "",
  importe_total: "",
  anticipo: "",
  tipo_ejercicio: "Anual",
  oficio_autorizacion: "",
  numero_acuerdo: "",
  clave_programatica_presupuestal: "",
  fondo_aportacion: "",
  fecha_inicio: "",
  fecha_termino: "",
  plazo_ejecucion: "",
  dias_naturales: "",
  contratista: "",
  representante_legal: "",
  rfc: "",
  domicilio_fiscal: "",
  objeto_contrato: "",

  /* Captura del Director de Obra, no de Concursos y Contratos — los
     frentes con frecuencia no están definidos al momento de contratar. */
  numero_frentes: "",
  alcance_frentes: "",

  deducciones: [],
  sanciones: [],
  retencion_porcentaje: "",

  /* Solo aplica a tipo_contrato === "supervision" — todas las obras que
     atiende ESTE contrato (puede ser más de una que la que originó esta
     hidratación), para la sección "Frentes de trabajo supervisados" de la
     carátula. [{ obraId, nombreObra }] — se llena en la hidratación desde
     servidor (ver utils/caratulaContrato.js), nunca se captura a mano. */
  frentes_supervisados: [],

  observaciones: [],
};

/* `Date.now()` solo no basta como id cuando se crean varios registros en
   el mismo ciclo síncrono (ej. el botón de autollenado agregando varias
   deducciones/sanciones seguidas) — caen en el mismo milisegundo y
   terminan con el MISMO id. El sufijo aleatorio elimina la colisión. */
function idUnico(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizar(data) {
  return {
    ...CONTRATO_VACIO,
    ...data,
    deducciones: Array.isArray(data?.deducciones) ? data.deducciones : [],
    sanciones: Array.isArray(data?.sanciones) ? data.sanciones : [],
    observaciones: Array.isArray(data?.observaciones) ? data.observaciones : [],
    frentes_supervisados: Array.isArray(data?.frentes_supervisados) ? data.frentes_supervisados : [],
  };
}

/* ── Registro de contratos ──────────────────────────────────────── */

export function getContratos() {
  const contratos = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(REGISTRO_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      contratos.push(normalizar(JSON.parse(raw)));
    }
  } catch {
    // localStorage no disponible o corrupto: no bloquea la UI
  }
  return contratos.sort((a, b) => new Date(b.fechaActualizacion || 0) - new Date(a.fechaActualizacion || 0));
}

export function getContrato(contratoId) {
  if (!contratoId) return null;
  try {
    const raw = localStorage.getItem(REGISTRO_PREFIX + contratoId);
    return raw ? normalizar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function guardarRaw(contratoId, registro) {
  try {
    localStorage.setItem(REGISTRO_PREFIX + contratoId, JSON.stringify(registro));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return registro;
}

export function crearContrato(usuario) {
  const id = idUnico("contrato");
  const registro = { ...CONTRATO_VACIO, id, creadoPor: usuario || "sistema", fechaCreacion: new Date().toISOString(), fechaActualizacion: new Date().toISOString() };
  guardarRaw(id, registro);
  return registro;
}

export function guardarContrato(contratoId, datos, usuario) {
  const registro = { ...normalizar(datos), id: contratoId, actualizadoPor: usuario || "sistema", fechaActualizacion: new Date().toISOString() };
  return guardarRaw(contratoId, registro);
}

export function eliminarContrato(contratoId) {
  try {
    localStorage.removeItem(REGISTRO_PREFIX + contratoId);
    const vinculos = getVinculos();
    delete vinculos[contratoId];
    localStorage.setItem(VINCULOS_KEY, JSON.stringify(vinculos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

/* ── Deducciones y sanciones (listas dinámicas del contrato) ──────── */

export function agregarDeduccion(contratoId, usuario, { concepto, porcentaje }) {
  const actual = getContrato(contratoId) || CONTRATO_VACIO;
  const next = { ...actual, deducciones: [...actual.deducciones, { id: idUnico("deduccion"), concepto: concepto || "", porcentaje: Number(porcentaje) || 0 }] };
  return guardarContrato(contratoId, next, usuario);
}

export function eliminarDeduccion(contratoId, usuario, id) {
  const actual = getContrato(contratoId) || CONTRATO_VACIO;
  return guardarContrato(contratoId, { ...actual, deducciones: actual.deducciones.filter((d) => d.id !== id) }, usuario);
}

export function agregarSancion(contratoId, usuario, { concepto, porcentaje, diasPermitidos }) {
  const actual = getContrato(contratoId) || CONTRATO_VACIO;
  const next = {
    ...actual,
    sanciones: [...actual.sanciones, { id: idUnico("sancion"), concepto: concepto || "", porcentaje: Number(porcentaje) || 0, diasPermitidos: Number(diasPermitidos) || 0 }],
  };
  return guardarContrato(contratoId, next, usuario);
}

export function eliminarSancion(contratoId, usuario, id) {
  const actual = getContrato(contratoId) || CONTRATO_VACIO;
  return guardarContrato(contratoId, { ...actual, sanciones: actual.sanciones.filter((s) => s.id !== id) }, usuario);
}

/* ── Observaciones/correcciones (Supervisión Externa sobre el contrato) ── */

export function agregarObservacionContrato(contratoId, texto, autor) {
  const actual = getContrato(contratoId);
  if (!actual) return null;
  const entrada = { id: idUnico("obs"), texto: (texto || "").trim(), autor: autor || "sistema", fecha: new Date().toISOString() };
  return guardarContrato(contratoId, { ...actual, observaciones: [entrada, ...actual.observaciones] }, actual.actualizadoPor);
}

/* ── Vinculación obra ↔ contrato (muchos a muchos) ─────────────────── */

function getVinculos() {
  try {
    const raw = localStorage.getItem(VINCULOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function guardarVinculos(vinculos) {
  try {
    localStorage.setItem(VINCULOS_KEY, JSON.stringify(vinculos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return vinculos;
}

export function getObrasVinculadas(contratoId) {
  return getVinculos()[contratoId] || [];
}

/** Contratos vinculados a una obra — normalmente 1 (ejecución+supervisión ya viven en el mismo registro), pero puede haber más (convenios). */
export function getContratosDeObra(obraKey) {
  const vinculos = getVinculos();
  return Object.entries(vinculos)
    .filter(([, obras]) => obras.includes(obraKey))
    .map(([contratoId]) => contratoId);
}

export function vincularObraContrato(contratoId, obraKey) {
  const vinculos = getVinculos();
  const actuales = vinculos[contratoId] || [];
  if (!actuales.includes(obraKey)) {
    vinculos[contratoId] = [...actuales, obraKey];
    guardarVinculos(vinculos);
  }
  return vinculos[contratoId];
}

export function desvincularObraContrato(contratoId, obraKey) {
  const vinculos = getVinculos();
  vinculos[contratoId] = (vinculos[contratoId] || []).filter((k) => k !== obraKey);
  guardarVinculos(vinculos);
  return vinculos[contratoId];
}

/* ── Contrato de obra ↔ contrato de supervisión (muchos a uno) ─────
   Una supervisión puede cubrir varias empresas de obra con un mismo
   contrato de supervisión (en Utopías llegaron a ser siete) — por eso
   el vínculo vive en el contrato de OBRA (contrato_supervision_id),
   nunca al revés. */

export function vincularContratoSupervision(contratoObraId, contratoSupervisionId, usuario) {
  const actual = getContrato(contratoObraId);
  if (!actual) return null;
  return guardarContrato(contratoObraId, { ...actual, contrato_supervision_id: contratoSupervisionId }, usuario);
}

export function desvincularContratoSupervision(contratoObraId, usuario) {
  const actual = getContrato(contratoObraId);
  if (!actual) return null;
  return guardarContrato(contratoObraId, { ...actual, contrato_supervision_id: "" }, usuario);
}

/** El contrato de supervisión que atiende este contrato de obra, o null si aún no se vincula ninguno. */
export function getContratoSupervision(contratoObraId) {
  const actual = getContrato(contratoObraId);
  if (!actual?.contrato_supervision_id) return null;
  return getContrato(actual.contrato_supervision_id);
}

/** Todos los contratos de obra que atiende un contrato de supervisión (relación inversa). */
export function getContratosDeObraPorSupervision(contratoSupervisionId) {
  return getContratos().filter((c) => c.tipo_contrato === TIPO_CONTRATO_OBRA && c.contrato_supervision_id === contratoSupervisionId);
}

/* ── Roles y permisos de captura ──────────────────────────────────── */

export function puedeEditarContrato(rol) {
  return ["DIRECTOR_CONCURSOS_CONTRATOS", "ADMIN"].includes(String(rol || "").toUpperCase());
}

export function puedeEditarFrentes(rol) {
  return ["DIRECTOR_OBRA", "ADMIN"].includes(String(rol || "").toUpperCase());
}
