import React, { useMemo, useRef, useState } from "react";

/* Curva de avance financiero — ajuste de minuta (3ª reunión,
   "Presentación de avances", 5.3): sustituye la gráfica de barras por
   estimación por una curva continua (arrastra el último % acumulado en
   semanas sin estimación — ver avanceFinancieroPorSemana), con una meta
   al 100% para que se vea de un vistazo el punto de partida, la meta y
   cuánto falta por alcanzar. */
const COLOR_LINEA = "#2563eb";
const COLOR_META = "#BC955C";

const W = 600;
const H = 200;
const PAD = { left: 36, right: 16, top: 16, bottom: 28 };

export default function LineChartFinanciero({ semanas }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const datos = useMemo(
    () => [...semanas].sort((a, b) => Number(a.numero) - Number(b.numero)),
    [semanas]
  );

  const conDato = useMemo(() => datos.filter((d) => d.porcentajeFinanciero != null), [datos]);

  if (conDato.length === 0) {
    return (
      <div className="text-center py-6 text-xs rounded-xl" style={{ color: "#9ca3af", border: "1px dashed #e5e7eb" }}>
        Aún no hay estimaciones capturadas — agrega una para ver la curva.
      </div>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = datos.length;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const indicesConDato = datos.map((d, i) => (d.porcentajeFinanciero != null ? i : null)).filter((i) => i !== null);
  const path = indicesConDato.map((i, k) => `${k === 0 ? "M" : "L"} ${x(i)} ${y(datos[i].porcentajeFinanciero)}`).join(" ");

  const gridTicks = [0, 25, 50, 75, 100];

  const ultimo = conDato[conDato.length - 1];
  const faltante = Math.max(0, Math.round((100 - ultimo.porcentajeFinanciero) * 10) / 10);

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = null;
    let best = Infinity;
    indicesConDato.forEach((i) => {
      const d = Math.abs(x(i) - px);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? datos[hoverIdx] : null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLOR_LINEA} strokeWidth="2" strokeLinecap="round" /></svg>
          % financiero acumulado
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--guinda)" }}>
          Falta {faltante}% para el 100%
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {gridTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#eef0f2" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{t}%</text>
          </g>
        ))}

        {/* Meta 100% */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(100)} y2={y(100)} stroke={COLOR_META} strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={W - PAD.right} y={y(100) - 4} textAnchor="end" fontSize="8" fill={COLOR_META} fontWeight="bold">META</text>

        {datos.map((d, i) => {
          const step = n > 10 ? Math.ceil(n / 8) : 1;
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text key={d.numero ?? i} x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
              S{d.numero}
            </text>
          );
        })}

        {hovered && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
        )}

        <path d={path} fill="none" stroke={COLOR_LINEA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Punto de partida */}
        <circle cx={x(indicesConDato[0])} cy={y(datos[indicesConDato[0]].porcentajeFinanciero)} r="4" fill={COLOR_LINEA} stroke="#fff" strokeWidth="2" />
        {/* Punto actual */}
        <circle cx={x(indicesConDato[indicesConDato.length - 1])} cy={y(ultimo.porcentajeFinanciero)} r="4" fill={COLOR_LINEA} stroke="#fff" strokeWidth="2" />

        {hovered && hovered.porcentajeFinanciero != null && (
          <circle cx={x(hoverIdx)} cy={y(hovered.porcentajeFinanciero)} r="4" fill={COLOR_LINEA} stroke="#fff" strokeWidth="2" />
        )}
      </svg>

      {hovered && hovered.porcentajeFinanciero != null && (
        <div
          className="absolute pointer-events-none rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            backgroundColor: "#1f2937",
            color: "#fff",
            left: `${(x(hoverIdx) / W) * 100}%`,
            top: 4,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <p className="font-semibold mb-0.5">Semana {hovered.numero}</p>
          <p><strong>{hovered.porcentajeFinanciero.toFixed(1)}%</strong> financiero acumulado</p>
        </div>
      )}
    </div>
  );
}
