/**
 * Catálogo oficial de SEGUIMIENTO_PS 2.0.
 * Fuente: "SEGUIMIENTO ADICIONAL PARA LA CORRECTA EJECUCIÓN DE OBRA.csv"
 * y "VISITAS_OBLIGADAS.csv" — carpeta requerrimientos del proyecto.
 * El formato exacto de captura por requerimiento (campos específicos) se
 * ajustará cuando exista la especificación final; la arquitectura es
 * configurable vía tipoCaptura por requerimiento.
 */

/* Tipos de captura soportados por requerimiento */
export const TIPO_CAPTURA = {
  A: "ESTATUS_EVIDENCIA", // estatus corto + adjunto
  B: "MULTIMEDIA",        // drag & drop de foto/video
  C: "TABULAR",           // csv / plantilla
};

export const CATEGORIAS = [
  "Proyecto",
  "Trámites y Estudios",
  "Obra",
  "Financiero",
  "Acciones Complementarias",
];

export const PERIODICIDADES = ["Diaria", "Semanal"];

/* Roles/puestos responsables — taxonomía de la persona (no confundir con
   el rol de sistema ADMIN/SECRETARIO/ACTUALIZACION ni con la dg de obra) */
export const ROLES_RESPONSABLE = {
  SECRETARIO:                     "Secretario",
  DIRECTOR_GENERAL:               "Director General",
  DIRECTOR_PROYECTO:              "Director de Proyecto",
  SUBDIRECTOR_PROYECTOS:          "Subdirector de Proyectos",
  DIRECTOR_OBRAS_INDUCIDAS:       "Director de Obras Inducidas",
  SUPERVISION_EXTERNA:            "Supervisión Externa",
  JEFE_UNIDAD_OBRA:               "Jefe de Unidad Departamental de Obra",
  DIRECTOR_OBRA:                  "Director de Obra",
  RESIDENTE_OBRA:                 "Residente de Obra",
  DIRECTOR_CONCURSOS_CONTRATOS:   "Director de Concurso, Contratos y Estimaciones",
  SUBDIRECCION_CONCERTACION:      "Subdirección de Concertación",
  /* Ajuste de reunión con el Secretario (12 de agosto, sesión Cablebús):
     renombrado — revisan suelo, estructuras y otros aspectos, no solo
     estructuras; "Asesores Estructuristas" se quedaba corto. */
  ASESORES_ESTRUCTURISTAS:        "Equipo Asesor Técnico de la Secretaría",
  SUBDIRECCION_COMUNICACION:      "Subdirección de Comunicación",
  DIRECTOR_AREA:                  "Director de Área",
  SUBDIRECTOR:                    "Subdirector",
};

/**
 * 19 requerimientos oficiales decretados por el Secretario, más REQ-21
 * ("Calidad de la obra"), agregado en la reunión del 12 de agosto
 * (sesión DGCOP) sobre esa base — no formaba parte del decreto original
 * de 19. Ajuste de minuta (3ª reunión, punto 8.1): "Proyecto Integral" (REQ-01, "Revisión integral
 * de la ejecución de obra") se retiró del catálogo — no es una tarea
 * asignable a las áreas, es la revisión que el Secretario ya hace sobre
 * el tablero mismo; dejarla como requerimiento la hacía aparecer como
 * un pendiente de las DG y, en la vista por funcionario, como una tarea
 * del propio Secretario.
 * responsables: códigos de ROLES_RESPONSABLE que ven este requerimiento —
 * cada uno de estos códigos SÍ debe seguir viendo la tarea en su bandeja y
 * contando en su cumplimiento individual (vista por funcionario); eso no
 * cambia. `responsableLabel` es solo para cuando el tablero necesita
 * mostrar UN nombre (notificaciones, guía impresa, "quién es responsable"):
 * ahí, dos códigos que en la práctica son "el mismo puesto con dos
 * nombres posibles según la Dirección" (ajuste de reunión con el
 * Secretario, 12 de agosto — sesión Cablebús, tareas #5 y #7) deben verse
 * como un solo actor, no como dos responsables distintos duplicando la
 * misma tarea. */
export const REQUERIMIENTOS = [
  {
    id: "REQ-02",
    nombre: "Entrega de anteproyecto o proyecto ejecutivo a la residencia de obra",
    categoria: "Proyecto",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_PROYECTO", "SUBDIRECTOR_PROYECTOS"],
    responsableLabel: "Director o Subdirector de Proyectos",
  },
  {
    id: "REQ-03",
    nombre: "Informe sobre cambios de proyecto",
    categoria: "Proyecto",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    /* Ajuste de reunión con el Secretario (12 de agosto, sesión DGCOP):
       se agrega al Director de Obra como responsable de validar los
       cambios de proyecto, además de quien los origina (Proyecto). */
    responsables: ["DIRECTOR_PROYECTO", "SUBDIRECTOR_PROYECTOS", "DIRECTOR_OBRA"],
    responsableLabel: "Director o Subdirector de Proyectos · Director de Obra",
  },
  {
    id: "REQ-04",
    nombre: "Autorización del estudio ambiental",
    categoria: "Trámites y Estudios",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRAS_INDUCIDAS"],
  },
  {
    id: "REQ-05",
    nombre: "Autorización del estudio de impacto urbano",
    categoria: "Trámites y Estudios",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRAS_INDUCIDAS"],
  },
  {
    id: "REQ-06",
    nombre: "Trámites y ejecución de las obras inducidas",
    categoria: "Trámites y Estudios",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRAS_INDUCIDAS"],
  },
  {
    id: "REQ-07",
    nombre: "Reporte fotográfico con cámara 360°",
    categoria: "Obra",
    periodicidad: "Semanal",
    tipoCaptura: "B",
    /* Ajuste de minuta (revisión de programa de obra): se retira JUD para
       no duplicar la tarea de Supervisión Externa. */
    responsables: ["SUPERVISION_EXTERNA"],
  },
  {
    id: "REQ-08",
    nombre: "Video",
    categoria: "Obra",
    periodicidad: "Semanal",
    tipoCaptura: "B",
    responsables: ["SUPERVISION_EXTERNA"],
  },
  {
    id: "REQ-09",
    nombre: "Fuerza de trabajo",
    categoria: "Obra",
    periodicidad: "Diaria",
    tipoCaptura: "C",
    /* Ajuste de minuta (revisión de programa de obra): revierte el
       ajuste #8 de la sesión anterior — la Dirección General vuelve a
       capturar directamente por frente, no solo a validar. */
    responsables: ["DIRECTOR_GENERAL"],
  },
  {
    id: "REQ-10",
    nombre: "Verificación de turnos de trabajo",
    categoria: "Obra",
    periodicidad: "Diaria",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRA"],
  },
  {
    id: "REQ-11",
    nombre: "Verificación de compra de insumos de entrega extendida con facturas",
    categoria: "Obra",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_GENERAL"],
  },
  {
    id: "REQ-12",
    nombre: "Entrega de generadores de obra",
    categoria: "Obra",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRA"],
  },
  {
    id: "REQ-13",
    nombre: "Elaboración de catálogo de conceptos de obra ejecutada",
    categoria: "Financiero",
    periodicidad: "Semanal",
    tipoCaptura: "C",
    responsables: ["JEFE_UNIDAD_OBRA", "RESIDENTE_OBRA"],
    responsableLabel: "JUD / Residente de Obra",
  },
  {
    id: "REQ-14",
    nombre: "Revisión de precios extraordinarios",
    categoria: "Financiero",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_CONCURSOS_CONTRATOS"],
  },
  {
    /* Ajuste de reunión (12 de agosto, acuerdo #4): ante el Secretario
       los dos módulos "se ven iguales" y se leen como duplicidad — se
       evaluó fusionarlos, pero se descartó (sobrecargaría la pantalla
       con otro switch más). Se mantienen separados y solo se renombran
       para dejar claro que ambos alimentan el mismo informe en PDF. */
    id: "REQ-15",
    nombre: "Informe de avance físico-financiero (avance real)",
    categoria: "Financiero",
    periodicidad: "Semanal",
    tipoCaptura: "C",
    responsables: ["SUPERVISION_EXTERNA"],
  },
  {
    id: "REQ-16",
    nombre: "Informe de avance físico-financiero (estimaciones)",
    categoria: "Financiero",
    periodicidad: "Semanal",
    tipoCaptura: "C",
    responsables: ["SUPERVISION_EXTERNA"],
  },
  {
    id: "REQ-17",
    nombre: "Informe de concertación de obras públicas",
    categoria: "Acciones Complementarias",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["SUBDIRECCION_CONCERTACION"],
  },
  {
    id: "REQ-18",
    nombre: "Informe de visitas de obra",
    categoria: "Acciones Complementarias",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["ASESORES_ESTRUCTURISTAS"],
  },
  {
    id: "REQ-19",
    nombre: "Informe de avances de la integración del expediente único",
    categoria: "Acciones Complementarias",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_CONCURSOS_CONTRATOS"],
  },
  {
    id: "REQ-20",
    nombre: "Memoria fotográfica y videos profesional",
    categoria: "Acciones Complementarias",
    periodicidad: "Diaria",
    tipoCaptura: "B",
    responsables: ["SUBDIRECCION_COMUNICACION"],
  },
  {
    /* Ajuste de reunión con el Secretario (12 de agosto, sesión DGCOP,
       a propuesta de Julio): actividad nueva, no existía en las 19
       originales. La minuta la asigna a "Subdirector de Obra" — el
       catálogo no tiene ese código por separado (ver ajuste de la
       misma reunión sobre Director/Subdirector de Obra como el mismo
       puesto con dos nombres posibles); se asigna a DIRECTOR_OBRA,
       igual que las demás tareas de ese puesto. */
    id: "REQ-21",
    nombre: "Calidad de la obra",
    categoria: "Obra",
    periodicidad: "Semanal",
    tipoCaptura: "A",
    responsables: ["DIRECTOR_OBRA"],
  },
];

/**
 * Visitas obligadas por funcionario — fuente VISITAS_OBLIGADAS.csv.
 * Los renglones combinados del CSV ("X / Y") se expanden en una entrada
 * por rol, con la misma cuota, para poder buscar por rol único.
 */
export const VISITAS_OBLIGADAS = [
  { rol: "SECRETARIO",                   label: "Secretario",                                        visitasPorDia: 1, periodo: "Diaria",  observaciones: "" },
  { rol: "DIRECTOR_GENERAL",             label: "Director General",                                  visitasPorDia: 2, periodo: "Diarias", observaciones: "" },
  { rol: "DIRECTOR_AREA",                label: "Director de Área",                                  visitasPorDia: 4, periodo: "Diarias", observaciones: "" },
  { rol: "DIRECTOR_OBRA",                label: "Director de Obra",                                  visitasPorDia: 4, periodo: "Diarias", observaciones: "" },
  { rol: "DIRECTOR_OBRAS_INDUCIDAS",     label: "Director de Obras Inducidas",                       visitasPorDia: 4, periodo: "Diarias", observaciones: "" },
  { rol: "DIRECTOR_CONCURSOS_CONTRATOS", label: "Director de Concurso, Contratos y Estimaciones",    visitasPorDia: 1, periodo: "Diaria",  observaciones: "" },
  { rol: "DIRECTOR_PROYECTO",            label: "Director de Proyectos",                             visitasPorDia: 2, periodo: "Diarias", observaciones: "" },
  { rol: "SUBDIRECTOR_PROYECTOS",        label: "Subdirector de Proyectos",                          visitasPorDia: 2, periodo: "Diarias", observaciones: "" },
  { rol: "SUBDIRECTOR",                  label: "Subdirector",                                       visitasPorDia: 3, periodo: "Diarias", observaciones: "" },
  { rol: "JEFE_UNIDAD_OBRA",             label: "Jefe de Unidad Obra / Proyecto",                     visitasPorDia: 3, periodo: "Diarias", observaciones: "" },
  { rol: "SUBDIRECCION_COMUNICACION",    label: "Subdirección de Comunicación",                      visitasPorDia: 2, periodo: "Diaria / DG", observaciones: "10 visitas" },
  { rol: "ADMIN",                        label: "Administrador del sistema",                         visitasPorDia: 0, periodo: "",       observaciones: "" },
];

export function getVisitaObligadaPorRol(rol) {
  const key = String(rol || "").toUpperCase();
  return VISITAS_OBLIGADAS.find((v) => v.rol === key) || null;
}

export function getRequerimientosPorRol(rol) {
  const key = String(rol || "").toUpperCase();
  if (key === "ADMIN") return REQUERIMIENTOS;
  return REQUERIMIENTOS.filter((r) => r.responsables.includes(key));
}
