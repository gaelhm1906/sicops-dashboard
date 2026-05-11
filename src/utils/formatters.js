/* ── FECHAS ── */
export function formatearFecha(isoString) {
  if (!isoString) return "—";
  const fecha = new Date(isoString);
  return fecha.toLocaleDateString("es-CL", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  });
}

export function formatearFechaHora(isoString) {
  if (!isoString) return "—";
  const fecha = new Date(isoString);
  return fecha.toLocaleString("es-CL", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatearFechaLarga(isoString) {
  if (!isoString) return "—";
  const fecha = new Date(isoString);
  return fecha.toLocaleDateString("es-CL", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
}

export function formatearHora(isoString) {
  if (!isoString) return "—";
  const fecha = new Date(isoString);
  return fecha.toLocaleTimeString("es-CL", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ── PORCENTAJE ── */
export function formatearPorcentaje(valor) {
  return `${valor}%`;
}

/* ── COLOR para barras de progreso ──
   Colores oficiales SIG-SOBSE:
   < 30%       → rojo
   30 – 70%    → naranja
   > 70%       → verde
   ENTREGADO   → azul (verificar con colorPorEstatus)
*/
export function colorBarra(porcentaje) {
  const n = Number(porcentaje) || 0;
  if (n > 70)  return "bg-[#4caf50]";  // verde
  if (n >= 30) return "bg-[#ff9800]";  // naranja
  return "bg-[#f44336]";               // rojo
}

/* Retorna color hex según avance (para uso en estilos inline) */
export function colorHexAvance(avance) {
  const n = Number(avance);
  if (avance === null || avance === undefined || isNaN(n)) return "#9e9e9e";
  if (n > 70)  return "#4caf50";
  if (n >= 30) return "#ff9800";
  return "#f44336";
}

/* Retorna color hex teniendo en cuenta estatus ENTREGADO */
export function colorHexEstatus(estatus, avance) {
  const estado = String(estatus || "").toUpperCase();
  if (estado === "ENTREGADO") return "#2196f3";
  if (estado === "CANCELADA" || estado === "CANCELADO") return "#6b7280";
  return colorHexAvance(avance);
}

/* ── ESTADO → badge ──
   Soporta tanto los nombres legacy (actualizada/pendiente/en_progreso)
   como los nuevos nombres oficiales (SIN INICIAR / EN PROCESO / TERMINADO / ENTREGADO).
*/
export function estadoLabel(estado) {
  const map = {
    // Estatuses canónicos nuevos BD unificada
    "INAUGURADA":  { label: "Inaugurada",  clase: "badge-blue",   icono: "🔵" },
    "TERMINADA":   { label: "Terminada",   clase: "badge-green",  icono: "🟢" },
    "EN PROCESO":  { label: "En proceso",  clase: "badge-yellow", icono: "🟠" },
    "SIN INICIAR": { label: "Sin iniciar", clase: "badge-red",    icono: "🔴" },
    "CANCELADO":   { label: "Cancelada",   clase: "badge-gray",   icono: "●" },
    // Aliases heredados (compatibilidad)
    "TERMINADO":   { label: "Terminado",   clase: "badge-green",  icono: "🟢" },
    "ENTREGADO":   { label: "Inaugurada",  clase: "badge-blue",   icono: "🔵" },
    "CANCELADA":   { label: "Cancelada",   clase: "badge-gray",   icono: "●" },
    actualizada:   { label: "Terminada",   clase: "badge-green",  icono: "🟢" },
    pendiente:     { label: "Sin iniciar", clase: "badge-red",    icono: "🔴" },
    en_progreso:   { label: "En proceso",  clase: "badge-yellow", icono: "🟠" },
  };
  return map[estado] || { label: estado || "—", clase: "badge-gray", icono: "❓" };
}

/* ── TIEMPO RELATIVO ── */
export function tiempoRelativo(isoString) {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const min  = Math.floor(diff / 60000);
  const hrs  = Math.floor(min / 60);
  const dias = Math.floor(hrs / 24);
  if (min < 1)   return "Hace un momento";
  if (min < 60)  return `Hace ${min} min`;
  if (hrs < 24)  return `Hace ${hrs} h`;
  if (dias < 7)  return `Hace ${dias} día${dias > 1 ? "s" : ""}`;
  return formatearFecha(isoString);
}
