import CapturaTipoA from "./CapturaTipoA";
import CapturaTipoB from "./CapturaTipoB";
import CapturaTipoC from "./CapturaTipoC";
import CapturaAvanceFisico from "./CapturaAvanceFisico";
import CapturaAvanceFinanciero from "./CapturaAvanceFinanciero";
import CapturaFuerzaTrabajo from "./CapturaFuerzaTrabajo";
import CapturaGeneradoresObra from "./CapturaGeneradoresObra";
import CapturaPreciosExtraordinarios from "./CapturaPreciosExtraordinarios";
import CapturaProyectoEjecutivo from "./CapturaProyectoEjecutivo";
import CapturaCambiosProyecto from "./CapturaCambiosProyecto";
import CapturaEstudioAutorizacion from "./CapturaEstudioAutorizacion";
import CapturaTurnoTrabajo from "./CapturaTurnoTrabajo";
import CapturaVerificacionInsumos from "./CapturaVerificacionInsumos";
import CapturaCatalogoConceptos from "./CapturaCatalogoConceptos";
import CapturaConcertacion from "./CapturaConcertacion";
import CapturaInformeVisitaAsesor from "./CapturaInformeVisitaAsesor";
import CapturaExpedienteUnico from "./CapturaExpedienteUnico";

const CAPTURA_COMPONENTS = { A: CapturaTipoA, B: CapturaTipoB, C: CapturaTipoC };

/* Requerimientos con formulario dedicado (formato oficial propio) en vez del
   genérico por tipoCaptura */
const CAPTURA_DEDICADA = {
  "REQ-02": CapturaProyectoEjecutivo,
  "REQ-03": CapturaCambiosProyecto,
  "REQ-04": CapturaEstudioAutorizacion,
  "REQ-05": CapturaEstudioAutorizacion,
  "REQ-09": CapturaFuerzaTrabajo,
  "REQ-10": CapturaTurnoTrabajo,
  "REQ-11": CapturaVerificacionInsumos,
  "REQ-12": CapturaGeneradoresObra,
  "REQ-13": CapturaCatalogoConceptos,
  "REQ-14": CapturaPreciosExtraordinarios,
  "REQ-15": CapturaAvanceFisico,
  "REQ-16": CapturaAvanceFinanciero,
  "REQ-17": CapturaConcertacion,
  "REQ-18": CapturaInformeVisitaAsesor,
  "REQ-19": CapturaExpedienteUnico,
};

export function getCapturaComponent(requerimiento) {
  return CAPTURA_DEDICADA[requerimiento.id] || CAPTURA_COMPONENTS[requerimiento.tipoCaptura];
}
