/**
 * data/ejemploContrato2.js
 * Segundo contrato de ejemplo — para tener dos casos distintos al hacer
 * una demo (además del de Pantéón Ministerial/DGCOP en
 * ejemploContrato.js). Datos ficticios pero plausibles, a la escala de
 * una obra menor (rehabilitación de cancha/Utopía) en vez de una obra
 * grande, para que el contraste entre ambos ejemplos sea evidente:
 * adjudicación directa en vez de licitación pública, monto mucho menor,
 * plazo más corto, y sí trae una deducción y una sanción de ejemplo
 * (el primer contrato las deja vacías).
 */
export const EJEMPLO_CONTRATO_2 = {
  numero_contrato: "DGCOP-AD-L-O-014-26",
  procedimiento: "Adjudicación directa",
  numero_concurso: "DGCOP/ADO/014/2026",
  fecha_contrato: "2026-02-10",
  dependencia: "SOBSE",
  direccion_general: "DGCOP",
  programa: "EL BALON VUELVE AL BARRIO",
  area_responsable: "Dirección de Construcción de Obras Públicas \"B\"",
  contratista: "CONSTRUCCIONES Y URBANIZACIONES DEL VALLE, S.A. DE C.V.",
  representante_legal: "MARTHA ELENA ROJAS CASTILLO",
  rfc: "CUV110315K27",
  domicilio_fiscal: "AV. TLÁHUAC NÚM. 1220, COL. SANTA CATARINA YECAHUIZOTL, ALCALDÍA TLÁHUAC, C.P. 13100, CIUDAD DE MÉXICO",
  objeto_contrato: "Rehabilitación de la cancha deportiva y áreas comunes de la Utopía Tecómitl.",
  importe_sin_iva: "950000.00",
  iva: "152000.00",
  importe_total: "1102000.00",
  anticipo: "0",
  tipo_ejercicio: "Anual",
  oficio_autorizacion: "CDMX/SOBSE/DGAF/02-2026/48",
  numero_acuerdo: "DCOP D-26 REQ-OP-14",
  clave_programatica_presupuestal: "343024K02115O26061212100O26NR0148",
  fondo_aportacion: "Recursos Fiscales CDMX",
  fecha_inicio: "2026-02-16",
  fecha_termino: "2026-06-15",
  dias_naturales: "120",
  plazo_ejecucion: "120 días naturales",
  numero_frentes: "",
  alcance_frentes: "",
  retencion_porcentaje: "",
};

/* Contrato de supervisión de este segundo ejemplo — al 6% del importe
   de la obra (extremo alto del rango 5-6% que dio el área técnica). */
export const EJEMPLO_CONTRATO_2_SUPERVISION = {
  numero_contrato: "DGCOP-SUP-AD-L-O-014-26",
  procedimiento: "Adjudicación directa",
  numero_concurso: "DGCOP/ADO/015/2026",
  fecha_contrato: "2026-02-10",
  dependencia: "SOBSE",
  direccion_general: "DGCOP",
  programa: "EL BALON VUELVE AL BARRIO",
  area_responsable: "Dirección de Construcción de Obras Públicas \"B\"",
  contratista: "GRUPO SUPERVISOR DEL VALLE, S.C.",
  representante_legal: "JORGE ALBERTO SOLIS PEÑA",
  rfc: "GSV081120HR3",
  domicilio_fiscal: "CALZADA TLÁHUAC NÚM. 88, COL. SANTA CATARINA YECAHUIZOTL, ALCALDÍA TLÁHUAC, C.P. 13100, CIUDAD DE MÉXICO",
  objeto_contrato: "Supervisión externa de la rehabilitación de la cancha deportiva y áreas comunes de la Utopía Tecómitl.",
  importe_sin_iva: "57000.00",
  iva: "9120.00",
  importe_total: "66120.00",
  anticipo: "0",
  tipo_ejercicio: "Anual",
  oficio_autorizacion: "CDMX/SOBSE/DGAF/02-2026/49",
  numero_acuerdo: "DCOP D-26 REQ-OP-15",
  clave_programatica_presupuestal: "343024K02115O26061212100O26NR0149",
  fondo_aportacion: "Recursos Fiscales CDMX",
  fecha_inicio: "2026-02-16",
  fecha_termino: "2026-06-15",
  dias_naturales: "120",
  plazo_ejecucion: "120 días naturales",
  numero_frentes: "",
  alcance_frentes: "",
  retencion_porcentaje: "",
};

/* Tres estimaciones (contrato de 120 días) cuyo monto sin IVA suma
   exactamente el importe sin IVA del contrato — mismo criterio que
   ESTIMACIONES_EJEMPLO en utils/demoInformeCompleto.js. */
export const ESTIMACIONES_EJEMPLO_2 = [
  {
    identificador: "EST 01",
    periodoDel: "2026-02-16",
    periodoAl: "2026-03-17",
    fechaEntrega: "2026-03-17",
    montoSinIva: 300000,
    deduccionesTotales: 6960,
  },
  {
    identificador: "EST 02",
    periodoDel: "2026-03-18",
    periodoAl: "2026-04-16",
    fechaEntrega: "2026-04-16",
    montoSinIva: 350000,
    deduccionesTotales: 8120,
  },
  {
    identificador: "03F",
    periodoDel: "2026-04-17",
    periodoAl: "2026-06-15",
    fechaEntrega: "2026-06-15",
    montoSinIva: 300000,
    deduccionesTotales: 6960,
  },
];

export const DEDUCCIONES_EJEMPLO_2 = [
  { concepto: "5 al millar — vigilancia, inspección y control", porcentaje: 0.5 },
];

export const SANCIONES_EJEMPLO_2 = [
  { concepto: "Retraso injustificado en la ejecución", porcentaje: 1, diasPermitidos: 5 },
];
