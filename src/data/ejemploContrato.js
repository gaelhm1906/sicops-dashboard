/**
 * data/ejemploContrato.js
 * Contrato de ejemplo — datos reales compartidos (carátula del contrato
 * DGCOP-LPN-L-O-001-26, "Construcción del Centro de Resguardo Temporal"
 * 1era etapa, vinculado a la obra PANTEÓN MINISTERIAL SAN LORENZO
 * TEZONCO / programa CENTRO DE RESGUARDO TEMPORAL — fuente:
 * ARCHIVOS_TRABAJO/SICOPS_Contrato_DGCOP-LPN-L-O-001-26.xlsx) para
 * poblar demos con un botón en vez de capturarlos a mano. Compartido
 * por el autollenado de Contratos.jsx y por el generador de ejemplo
 * completo del Informe (utils/demoInformeCompleto.js) — si comparten
 * otro contrato de referencia, este es el único bloque que hay que
 * actualizar.
 *
 * No hay dato real de supervisión externa, número de frentes ni
 * deducciones/sanciones en el Excel de origen — se dejan vacíos en vez
 * de inventarlos; el Informe/PDF/Excel funcionan igual con esos campos
 * en blanco (muestran "—").
 */
export const EJEMPLO_CONTRATO = {
  numero_contrato: "DGCOP-LPN-L-O-001-26",
  procedimiento: "Licitación pública nacional",
  numero_concurso: "909005989-DGCOP-L-157-2025",
  fecha_contrato: "2026-01-02",
  dependencia: "SOBSE",
  direccion_general: "DGCOP",
  programa: "CENTRO DE RESGUARDO TEMPORAL",
  area_responsable: "Dirección de Construcción de Obras Públicas \"D\"",
  contratista: "GONZALEZ SOTO Y ASOCIADOS, S.A. DE C.V.",
  representante_legal: "ADRIAN GONZALEZ MARTINEZ",
  rfc: "GSA820129U49",
  domicilio_fiscal: "CALZADA DESIERTO DE LOS LEONES, NÚM. 4073, COL. SAN ÁNGEL INN, ALCALDÍA ÁLVARO OBREGÓN, C.P. 01060, CIUDAD DE MÉXICO",
  objeto_contrato: "\"Construcción del Centro de Resguardo Temporal\" 1era etapa.",
  importe_sin_iva: "122721738.08",
  iva: "19635478.09",
  importe_total: "142357216.17",
  anticipo: "0",
  tipo_ejercicio: "Anual",
  oficio_autorizacion: "CDMX/SOBSE/DGAF/05-02-2026/15",
  numero_acuerdo: "DCOP D-26 REQ-OP-3",
  clave_programatica_presupuestal: "343024K02115O26061212100O26NR0151",
  fondo_aportacion: "15O260",
  fecha_inicio: "2026-01-03",
  fecha_termino: "2026-10-13",
  dias_naturales: "284",
  plazo_ejecucion: "284 días naturales",
  numero_frentes: "",
  alcance_frentes: "",
  retencion_porcentaje: "",
};

export const DEDUCCIONES_EJEMPLO = [];

export const SANCIONES_EJEMPLO = [];

/* Ajuste de fondo (área técnica, 11 de agosto): la supervisión externa
   es OTRO contrato, independiente — no campos sueltos dentro del de
   obra. Monto de ejemplo al 5.5% del importe de la obra (el rango que
   dio el área técnica es 5-6%). `tipo_contrato` se agrega al vincular
   (ver utils/demoInformeCompleto.js), no aquí, porque este objeto
   también es la fuente del contrato de OBRA. */
export const EJEMPLO_CONTRATO_SUPERVISION = {
  numero_contrato: "DGCOP-SUP-L-O-001-26",
  procedimiento: "Licitación pública nacional",
  numero_concurso: "909005989-DGCOP-L-158-2025",
  fecha_contrato: "2026-01-02",
  dependencia: "SOBSE",
  direccion_general: "DGCOP",
  programa: "CENTRO DE RESGUARDO TEMPORAL",
  area_responsable: "Dirección de Construcción de Obras Públicas \"D\"",
  contratista: "SUPERVISIÓN TÉCNICA Y CONTROL DE OBRA, S.C.",
  representante_legal: "LAURA PATRICIA MENDOZA RUIZ",
  rfc: "STC950614RT2",
  domicilio_fiscal: "AV. INSURGENTES SUR NÚM. 1898, COL. FLORIDA, ALCALDÍA ÁLVARO OBREGÓN, C.P. 01030, CIUDAD DE MÉXICO",
  objeto_contrato: "Supervisión externa de la \"Construcción del Centro de Resguardo Temporal\" 1era etapa.",
  importe_sin_iva: "6749695.59",
  iva: "1079951.30",
  importe_total: "7829646.89",
  anticipo: "0",
  tipo_ejercicio: "Anual",
  oficio_autorizacion: "CDMX/SOBSE/DGAF/05-02-2026/16",
  numero_acuerdo: "DCOP D-26 REQ-OP-4",
  clave_programatica_presupuestal: "343024K02115O26061212100O26NR0152",
  fondo_aportacion: "15O260",
  fecha_inicio: "2026-01-03",
  fecha_termino: "2026-10-13",
  dias_naturales: "284",
  plazo_ejecucion: "284 días naturales",
  numero_frentes: "",
  alcance_frentes: "",
  retencion_porcentaje: "",
};
