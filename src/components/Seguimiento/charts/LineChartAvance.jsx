import React, { useMemo, useRef, useState } from "react";

/* Curva de avance: % Programado, % Real (Sup. Externa) y % Financiero,
 * las tres juntas (ajuste de fondo, área técnica 11 de agosto): antes
 * había una gráfica de avance físico (programado/real) separada de una
 * de avance financiero, y una tercera —hoy eliminada— que comparaba
 * "supervisión interna" contra "externa" (lógica equivocada: son dos
 * CONTRATOS distintos, no dos observadores del mismo dato). Las tres
 * curvas juntas sirven de control: si el financiero se despega por
 * encima del físico, se está cobrando más de lo ejecutado.
 * Colores validados (script dataviz): ámbar/verde/azul, PASS con WARN de
 * separación CVD ámbar↔verde → mitigado con patrón de línea (discontinua vs sólida). */
const COLOR_PROGRAMADO = "#d97706";
const COLOR_REAL = "#16a34a";
const COLOR_FINANCIERO = "#2563eb";

const W = 600;
const H = 220;
const PAD = { left: 36, right: 16, top: 16, bottom: 28 };

export default function LineChartAvance({ semanas, financiero }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const financieroPorSemana = useMemo(() => {
    const mapa = {};
    for (const f of financiero || []) mapa[f.numero] = f.porcentajeFinanciero;
    return mapa;
  }, [financiero]);

  const datos = useMemo(
    () => [...semanas]
      .sort((a, b) => Number(a.numero) - Number(b.numero))
      .map((s) => ({ ...s, avanceFinanciero: financieroPorSemana[s.numero] ?? null })),
    [semanas, financieroPorSemana]
  );

  const tieneFinanciero = useMemo(
    () => datos.some((d) => d.avanceFinanciero !== null && d.avanceFinanciero !== undefined),
    [datos]
  );

  if (datos.length === 0) {
    return (
      <div className="text-center py-6 text-xs rounded-xl" style={{ color: "#9ca3af", border: "1px dashed #e5e7eb" }}>
        Aún no hay semanas capturadas — agrega una para ver la curva.
      </div>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = datos.length;
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const valorFinanciero = (d) => d.avanceFinanciero ?? 0;

  const pathFor = (key) =>
    datos.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const pathFinanciero = () =>
    datos.filter((d) => d.avanceFinanciero !== null).map((d) => `${x(datos.indexOf(d))},${y(valorFinanciero(d))}`);

  const gridTicks = [0, 25, 50, 75, 100];

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    datos.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? datos[hoverIdx] : null;
  const puntosFinanciero = tieneFinanciero ? pathFinanciero() : [];
  const dFinanciero = puntosFinanciero.length > 0 ? `M ${puntosFinanciero.join(" L ")}` : "";

  return (
    <div className="relative">
      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-1.5 px-1 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLOR_PROGRAMADO} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" /></svg>
          Programado
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLOR_REAL} strokeWidth="2" strokeLinecap="round" /></svg>
          Real
        </span>
        {tieneFinanciero && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLOR_FINANCIERO} strokeWidth="2" strokeDasharray="1 3" strokeLinecap="round" /></svg>
            Financiero
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Gridlines */}
        {gridTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#eef0f2" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{t}%</text>
          </g>
        ))}

        {/* Eje X: número de semana (selectivo si hay muchas) */}
        {datos.map((d, i) => {
          const step = n > 10 ? Math.ceil(n / 8) : 1;
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text key={d.id || i} x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
              S{d.numero}
            </text>
          );
        })}

        {/* Crosshair */}
        {hovered && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#d1d5db" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* Líneas */}
        <path d={pathFor("avanceProgramado")} fill="none" stroke={COLOR_PROGRAMADO} strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor("avanceReal")} fill="none" stroke={COLOR_REAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {tieneFinanciero && (
          <path d={dFinanciero} fill="none" stroke={COLOR_FINANCIERO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Marcador final de cada serie */}
        <circle cx={x(n - 1)} cy={y(datos[n - 1].avanceProgramado)} r="4" fill={COLOR_PROGRAMADO} stroke="#fff" strokeWidth="2" />
        <circle cx={x(n - 1)} cy={y(datos[n - 1].avanceReal)} r="4" fill={COLOR_REAL} stroke="#fff" strokeWidth="2" />
        {tieneFinanciero && datos[n - 1].avanceFinanciero !== null && (
          <circle cx={x(n - 1)} cy={y(valorFinanciero(datos[n - 1]))} r="4" fill={COLOR_FINANCIERO} stroke="#fff" strokeWidth="2" />
        )}

        {/* Punto activo en hover */}
        {hovered && (
          <>
            <circle cx={x(hoverIdx)} cy={y(hovered.avanceProgramado)} r="4" fill={COLOR_PROGRAMADO} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hoverIdx)} cy={y(hovered.avanceReal)} r="4" fill={COLOR_REAL} stroke="#fff" strokeWidth="2" />
            {tieneFinanciero && hovered.avanceFinanciero !== null && (
              <circle cx={x(hoverIdx)} cy={y(valorFinanciero(hovered))} r="4" fill={COLOR_FINANCIERO} stroke="#fff" strokeWidth="2" />
            )}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
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
          <p><strong>{hovered.avanceProgramado.toFixed(2)}%</strong> programado</p>
          <p><strong>{hovered.avanceReal.toFixed(2)}%</strong> real</p>
          {hovered.avanceFinanciero !== null && <p><strong>{valorFinanciero(hovered).toFixed(2)}%</strong> financiero</p>}
        </div>
      )}
    </div>
  );
}
