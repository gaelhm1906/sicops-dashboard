/** "cancelada" | "inaugurada" | "terminada" | "editable" — ciclo de vida de la obra (independiente del indicador de seguimiento) */
export function getEstadoObra(obra) {
  const estatus = String(obra.estatus || obra.estado || "").toUpperCase();
  if (estatus === "CANCELADA" || estatus === "CANCELADO") return "cancelada";
  if (estatus === "INAUGURADA" || estatus.includes("ENTREGAD") || estatus.includes("INAUGUR")) return "inaugurada";
  if (estatus === "TERMINADA" || estatus === "TERMINADO" || Number(obra.avance_real ?? obra.avance ?? obra.porcentaje ?? 0) >= 100) return "terminada";
  return "editable";
}
