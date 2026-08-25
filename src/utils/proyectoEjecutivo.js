/**
 * utils/proyectoEjecutivo.js — REQ-02.
 * Entrega de proyecto ejecutivo, desglosada por especialidad, más dos
 * documentos de consulta rápida (planta de conjunto y plantas
 * individuales) que se piden como mínimo indispensable. Solo se guarda
 * el nombre del archivo (como el resto de evidencias del sistema), no
 * su contenido. Persistencia MOCK en localStorage, namespaced por obra.
 */
const PREFIX = "proyecto_ejecutivo::";

export const ESPECIALIDADES_PROYECTO = [
  { id: "estudios_topografia", label: "Estudios / Topografía" },
  { id: "arquitectonico", label: "Arquitectónico" },
  { id: "estructura", label: "Estructura" },
  { id: "instalaciones", label: "Instalaciones" },
  { id: "acabados", label: "Acabados" },
];

function estadoVacio() {
  return {
    especialidades: Object.fromEntries(ESPECIALIDADES_PROYECTO.map((e) => [e.id, { entregado: false, archivo: null }])),
    plantaConjunto: null,
    plantasIndividuales: null,
  };
}

export function getProyectoEjecutivo(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    const data = raw ? JSON.parse(raw) : null;
    return { ...estadoVacio(), ...data, especialidades: { ...estadoVacio().especialidades, ...(data?.especialidades || {}) } };
  } catch {
    return estadoVacio();
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

export function actualizarEspecialidad(obraKey, especialidadId, cambios) {
  const estado = getProyectoEjecutivo(obraKey);
  const next = { ...estado, especialidades: { ...estado.especialidades, [especialidadId]: { ...estado.especialidades[especialidadId], ...cambios } } };
  return guardar(obraKey, next);
}

export function actualizarPlano(obraKey, campo, archivoNombre) {
  const estado = getProyectoEjecutivo(obraKey);
  return guardar(obraKey, { ...estado, [campo]: archivoNombre });
}

export function resumenProyecto(estado) {
  const valores = Object.values(estado.especialidades);
  return { entregadas: valores.filter((v) => v.entregado).length, total: valores.length };
}
