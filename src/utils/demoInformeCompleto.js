/**
 * utils/demoInformeCompleto.js
 * Botón "generar ejemplo" para el Informe de Avance Físico Financiero —
 * mismo espíritu que el autollenado de Contratos.jsx, pero de punta a
 * punta: carátula vinculada + programa de obra + avance real semanal +
 * estimaciones, todo con el contrato real de referencia (DGCOP-LPN-L-O-
 * 001-26, "Centro de Resguardo Temporal" / Panteón Ministerial San
 * Lorenzo Tezonco), para poder abrir el Informe y bajar PDF/Excel sin
 * capturar nada a mano. Pensado para preparar una demo rápida.
 */
import { getObraKey } from "./seguimiento";
import {
  CONTRATO_VACIO,
  TIPO_CONTRATO_OBRA,
  TIPO_CONTRATO_SUPERVISION,
  getContrato,
  crearContrato,
  guardarContrato,
  agregarDeduccion,
  agregarSancion,
  getContratosDeObra,
  vincularObraContrato,
  vincularContratoSupervision,
} from "./contratos";
import { getQuincenas, eliminarQuincena, agregarQuincena, generarQuincenasAutomaticas } from "./programaObra";
import {
  guardarAvanceRealSemana,
  construirSemanasFisico,
  getAvanceFinanciero,
  eliminarEstimacion,
  agregarEstimacion,
} from "./avanceFisicoFinanciero";
import { EJEMPLO_CONTRATO, EJEMPLO_CONTRATO_SUPERVISION, DEDUCCIONES_EJEMPLO, SANCIONES_EJEMPLO } from "../data/ejemploContrato";
import { EJEMPLO_CONTRATO_2, EJEMPLO_CONTRATO_2_SUPERVISION, ESTIMACIONES_EJEMPLO_2, DEDUCCIONES_EJEMPLO_2, SANCIONES_EJEMPLO_2 } from "../data/ejemploContrato2";

/* Tres estimaciones (contrato de 284 días) cuyo monto sin IVA suma
   exactamente el importe sin IVA del contrato — así el % financiero
   acumulado cierra en 100% en la última semana, igual que el avance
   real. Deducciones de ejemplo al 2% (el Excel de origen no trae un
   desglose real de deducciones por estimación). */
const ESTIMACIONES_EJEMPLO = [
  {
    identificador: "EST 01",
    periodoDel: "2026-01-03",
    periodoAl: "2026-04-03",
    fechaEntrega: "2026-04-03",
    montoSinIva: 40000000,
    deduccionesTotales: 928000,
  },
  {
    identificador: "EST 02",
    periodoDel: "2026-04-04",
    periodoAl: "2026-07-13",
    fechaEntrega: "2026-07-13",
    montoSinIva: 45000000,
    deduccionesTotales: 1044000,
  },
  {
    identificador: "03F",
    periodoDel: "2026-07-14",
    periodoAl: "2026-10-13",
    fechaEntrega: "2026-10-13",
    montoSinIva: 37721738.08,
    deduccionesTotales: 875144.32,
  },
];

/**
 * Siembra de un clic todo lo que necesita el Informe de esta obra para
 * generar PDF/Excel con datos completos: carátula vinculada, programa
 * (quincenas en rampa hasta 100%), avance real semanal y estimaciones
 * — para AMBOS contratos, obra y supervisión, cada uno con su propia
 * serie (cierran en 100% la última semana de su propio plazo).
 * Idempotente: se puede correr varias veces sobre la misma obra sin
 * duplicar nada, siempre limpia lo anterior y vuelve a sembrar los
 * mismos datos.
 *
 * `dataset` permite reutilizar el mismo sembrado con un segundo
 * contrato de ejemplo (ver sembrarSegundoEjemploInformeCompleto abajo),
 * para tener dos casos distintos al hacer una demo.
 *
 * Ajuste de fondo (área técnica, 11 de agosto): el contrato de
 * supervisión es un registro INDEPENDIENTE (propia carátula, propio
 * importe al 5-6%), vinculado por `contrato_supervision_id`, no campos
 * sueltos — y ya NO se siembra un "avance de supervisión interna"
 * separado: esa comparación era la lógica equivocada que se corrigió.
 * Lo que antes eran dos vistas del mismo dato ahora son dos contratos
 * reales, cada uno con su propio avance físico y sus propias
 * estimaciones (el de supervisión a escala de su propio importe, no el
 * de la obra que supervisa).
 */
/* Siembra programa + avance real + estimaciones bajo una clave de
   seguimiento (obraKey para el contrato de obra, id del contrato para
   el de supervisión — misma convención que CapturaAvanceFisico/
   CapturaAvanceFinanciero y el Informe). `factorReal` desplaza la
   curva real respecto a la programada, para que obra y supervisión no
   se vean idénticas en la demo. */
function sembrarAvance(trackingKey, caratula, estimaciones, factorReal) {
  for (const q of getQuincenas(trackingKey)) eliminarQuincena(trackingKey, q.id);
  const tramos = generarQuincenasAutomaticas(caratula.fecha_inicio, caratula.dias_naturales);
  tramos.forEach((t, i) => {
    const pctAcumulado = Math.round((100 * (i + 1)) / tramos.length);
    agregarQuincena(trackingKey, { ...t, pctAcumulado });
  });

  const semanas = construirSemanasFisico(trackingKey, caratula);
  semanas.forEach((s, i) => {
    const esUltima = i === semanas.length - 1;
    const real = esUltima ? 100 : Math.max(0, s.avanceProgramado - factorReal);
    guardarAvanceRealSemana(trackingKey, s.numero, real, "supervision");
  });

  const { estimaciones: estimacionesActuales } = getAvanceFinanciero(trackingKey);
  for (const e of estimacionesActuales) eliminarEstimacion(trackingKey, e.id);
  for (const e of estimaciones) agregarEstimacion(trackingKey, e);
}

function sembrarConDataset(obra, usuario, { contrato, contratoSupervision, deducciones, sanciones, estimaciones }) {
  const obraKey = getObraKey(obra);

  const vinculados = getContratosDeObra(obraKey);
  const contratoId = vinculados[0] || crearContrato(usuario).id;
  guardarContrato(contratoId, { ...CONTRATO_VACIO, ...contrato, tipo_contrato: TIPO_CONTRATO_OBRA }, usuario);
  for (const d of deducciones) agregarDeduccion(contratoId, usuario, d);
  for (const s of sanciones) agregarSancion(contratoId, usuario, s);
  if (!vinculados.includes(contratoId)) vincularObraContrato(contratoId, obraKey);

  let caratulaSupervision = null;
  if (contratoSupervision) {
    const actual = getContrato(contratoId);
    const supervisionId = actual.contrato_supervision_id || crearContrato(usuario).id;
    guardarContrato(supervisionId, { ...CONTRATO_VACIO, ...contratoSupervision, tipo_contrato: TIPO_CONTRATO_SUPERVISION }, usuario);
    if (!actual.contrato_supervision_id) vincularContratoSupervision(contratoId, supervisionId, usuario);
    caratulaSupervision = getContrato(supervisionId);
  }

  const caratula = getContrato(contratoId);

  sembrarAvance(obraKey, caratula, estimaciones, 8);

  if (caratulaSupervision) {
    /* Estimaciones de la supervisión: mismos periodos que las de la
       obra, montos a escala de su propio importe (no tiene sentido
       que la supervisión facture lo mismo que la obra que supervisa). */
    const ratio = Number(caratulaSupervision.importe_sin_iva) / Number(caratula.importe_sin_iva);
    const estimacionesSupervision = estimaciones.map((e) => ({
      ...e,
      montoSinIva: Math.round(e.montoSinIva * ratio * 100) / 100,
      deduccionesTotales: Math.round(e.deduccionesTotales * ratio * 100) / 100,
    }));
    sembrarAvance(caratulaSupervision.id, caratulaSupervision, estimacionesSupervision, 4);
  }
}

export function sembrarEjemploInformeCompleto(obra, usuario) {
  sembrarConDataset(obra, usuario, {
    contrato: EJEMPLO_CONTRATO,
    contratoSupervision: EJEMPLO_CONTRATO_SUPERVISION,
    deducciones: DEDUCCIONES_EJEMPLO,
    sanciones: SANCIONES_EJEMPLO,
    estimaciones: ESTIMACIONES_EJEMPLO,
  });
}

/* Segundo ejemplo — mismo mecanismo, contrato distinto (ver
   data/ejemploContrato2.js): adjudicación directa, monto menor, plazo
   más corto, y sí trae deducción/sanción de ejemplo. Para poder mostrar
   dos casos distintos al hacer una demo. */
export function sembrarSegundoEjemploInformeCompleto(obra, usuario) {
  sembrarConDataset(obra, usuario, {
    contrato: EJEMPLO_CONTRATO_2,
    contratoSupervision: EJEMPLO_CONTRATO_2_SUPERVISION,
    deducciones: DEDUCCIONES_EJEMPLO_2,
    sanciones: SANCIONES_EJEMPLO_2,
    estimaciones: ESTIMACIONES_EJEMPLO_2,
  });
}
