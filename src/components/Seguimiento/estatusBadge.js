import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

export const ESTATUS_INFO = {
  [ESTATUS_REGISTRO.CUMPLIDO]:  { label: "Cumplido",  bg: "#ecfdf5", color: "#16a34a", border: "#bbf7d0" },
  [ESTATUS_REGISTRO.PENDIENTE]: { label: "Pendiente",  bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  [ESTATUS_REGISTRO.ATRASADO]:  { label: "Atrasado",   bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  [ESTATUS_REGISTRO.NO_APLICA]: { label: "No aplica",  bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
};

export function getEstatusInfo(estatus) {
  return ESTATUS_INFO[estatus] || ESTATUS_INFO.pendiente;
}

export const TIPO_CAPTURA_INFO = {
  A: { label: "Estatus + evidencia", icono: "📋" },
  B: { label: "Multimedia",          icono: "🎞️" },
  C: { label: "Datos tabulares",     icono: "📊" },
};
