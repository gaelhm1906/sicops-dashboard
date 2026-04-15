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

/* ── COLOR para barras de progreso — paleta institucional SOBSE ── */
export function colorBarra(porcentaje) {
  if (porcentaje >= 80) return "bg-[#006341]";
  if (porcentaje >= 50) return "bg-[#F4B860]";
  return "bg-[#E8A8A8]";
}

/* ── ESTADO → badge ── */
export function estadoLabel(estado) {
  const map = {
    actualizada: { label: "Actualizada",  clase: "badge-green",  icono: "✅" },
    pendiente:   { label: "Pendiente",    clase: "badge-red",    icono: "⏳" },
    en_progreso: { label: "En progreso",  clase: "badge-yellow", icono: "🔄" },
  };
  return map[estado] || { label: estado, clase: "badge-gray", icono: "❓" };
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
