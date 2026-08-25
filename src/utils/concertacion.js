/**
 * utils/concertacion.js — REQ-17.
 * Informe de concertación de obras públicas: NO es una captura de una
 * sola vez, es una bitácora de ida y vuelta. Un "caso" se abre con la
 * descripción del problema; a partir de ahí se van agregando entradas de
 * dos tipos: "seguimiento" (de Subdirección de Concertación) e
 * "indicacion_secretario" (indicaciones directas del secretario, que se
 * enganchan aquí mismo desde el panel de evaluación — ver
 * EvaluacionPanel.jsx). Solo hay un caso ABIERTO a la vez por obra; los
 * anteriores quedan como historial de solo lectura. Persistencia MOCK en
 * localStorage, namespaced por obra.
 */
const PREFIX = "concertacion::";

export const TIPO_ENTRADA = {
  SEGUIMIENTO: "seguimiento",
  INDICACION_SECRETARIO: "indicacion_secretario",
};

export function getConcertacion(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? JSON.parse(raw) : { casos: [] };
  } catch {
    return { casos: [] };
  }
}

function guardar(obraKey, estado) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(estado));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return estado;
}

export function casoActivo(estado) {
  return estado.casos.find((c) => c.estatus === "abierto") || null;
}

export function crearCaso(obraKey, problema, autor) {
  const estado = getConcertacion(obraKey);
  const nuevo = {
    id: `caso-${Date.now()}`,
    problema: problema.trim(),
    estatus: "abierto",
    fechaCreacion: new Date().toISOString(),
    fechaCierre: null,
    entradas: [],
  };
  const next = { casos: [nuevo, ...estado.casos] };
  guardar(obraKey, next);
  return next;
}

export function agregarEntrada(obraKey, casoId, { tipo, texto, autor }) {
  const estado = getConcertacion(obraKey);
  const entrada = { id: `entrada-${Date.now()}`, tipo, texto: texto.trim(), autor: autor || "sistema", fecha: new Date().toISOString() };
  const next = {
    casos: estado.casos.map((c) => (c.id === casoId ? { ...c, entradas: [...c.entradas, entrada] } : c)),
  };
  guardar(obraKey, next);
  return next;
}

export function cerrarCaso(obraKey, casoId) {
  const estado = getConcertacion(obraKey);
  const next = {
    casos: estado.casos.map((c) => (c.id === casoId ? { ...c, estatus: "cerrado", fechaCierre: new Date().toISOString() } : c)),
  };
  guardar(obraKey, next);
  return next;
}

/**
 * Engancha una indicación del secretario al caso activo de concertación
 * de una obra — si no hay ninguno abierto, se abre uno para que la
 * indicación tenga dónde vivir. Usado por EvaluacionPanel cuando el
 * secretario evalúa REQ-17 desde Revisión Integral.
 */
export function registrarIndicacionSecretario(obraKey, texto, autor) {
  let estado = getConcertacion(obraKey);
  let caso = casoActivo(estado);
  if (!caso) {
    estado = crearCaso(obraKey, "Caso abierto por indicación directa del secretario", autor);
    caso = casoActivo(estado);
  }
  return agregarEntrada(obraKey, caso.id, { tipo: TIPO_ENTRADA.INDICACION_SECRETARIO, texto, autor });
}
