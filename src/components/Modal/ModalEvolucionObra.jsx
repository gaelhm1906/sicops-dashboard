/**
 * components/Modal/ModalEvolucionObra.jsx
 * Evolución de Obras — Nivel 5: línea de tiempo histórica de una sola obra.
 * Fuente: GET /api/evolucion/obra?tabla=X&id=Y (snapshots_semanales + auditoria).
 *
 * Vista ejecutiva — mismos cálculos y mismo backend que antes, solo cambia
 * la presentación visual (jerarquía, KPIs, gráfica, alertas, timeline).
 */
import React, { useEffect, useState, useCallback } from "react";
import { evolucionAPI } from "../../utils/api";

const ESTATUS_CFG = {
  "EN PROCESO":  { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  "SIN INICIAR": { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
  TERMINADA:     { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  INAUGURADA:    { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  CANCELADO:     { bg: "#fff1f2", text: "#b91c1c", border: "#fecdd3" },
};

const TENDENCIA_CFG = {
  ACELERANDO:     { icon: "▲", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "Acelerando" },
  ESTABLE:        { icon: "▬", color: "#691C32", bg: "#F3E8EC", border: "#E8C4CC", label: "Estable" },
  DESACELERANDO:  { icon: "▽", color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Desacelerando" },
  ESTANCADA:      { icon: "■", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", label: "Estancada" },
  "SIN DATOS SUFICIENTES": { icon: "—", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", label: "Sin datos suficientes" },
};

const HITO_CFG = {
  CAMBIO_ESTATUS: { icon: "🔄", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  MAYOR_AVANCE:   { icon: "🚀", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

const ALERTA_CFG = {
  ESTANCADA:           { icon: "🔴", label: "Obra estancada" },
  RETROCESO_DETECTADO: { icon: "🔴", label: "Retroceso detectado" },
};

function fmtFecha(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtFechaHora(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Gráfica SVG de línea, sin librerías externas — estilo institucional ── */
function GraficaEvolucion({ serie }) {
  if (!serie.length) {
    return (
      <div className="flex items-center justify-center py-10 text-sm" style={{ color: "#9ca3af" }}>
        Sin datos semanales disponibles todavía.
      </div>
    );
  }

  const W = 760, H = 220, PAD_L = 38, PAD_R = 16, PAD_T = 18, PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const stepX = serie.length > 1 ? plotW / (serie.length - 1) : 0;

  const puntos = serie.map((p, i) => ({
    ...p,
    x: PAD_L + i * stepX,
    y: PAD_T + (1 - Math.min(100, Math.max(0, p.avance ?? 0)) / 100) * plotH,
  }));

  const hayAnomalia = puntos.some((p) => p.anomalia);
  const areaPath =
    `M ${puntos[0].x} ${PAD_T + plotH} ` +
    puntos.map((p) => `L ${p.x} ${p.y}`).join(" ") +
    ` L ${puntos[puntos.length - 1].x} ${PAD_T + plotH} Z`;

  // Mostrar etiqueta de semana solo cada N puntos si hay muchos, para no saturar el eje
  const labelStep = serie.length > 14 ? Math.ceil(serie.length / 14) : 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id="areaEvolucion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#691C32" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#691C32" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Líneas guía 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = PAD_T + (1 - v / 100) * plotH;
          return (
            <g key={v}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#F1EFEC" strokeWidth="1" />
              <text x={4} y={y + 3} fontSize="9" fontWeight="600" fill="#B0A99A">{v}%</text>
            </g>
          );
        })}

        {/* Área bajo la curva */}
        <path d={areaPath} fill="url(#areaEvolucion)" />

        {/* Segmentos — punteados si tocan un punto con anomalía */}
        {puntos.slice(1).map((p, i) => {
          const prev = puntos[i];
          const dashed = prev.anomalia || p.anomalia;
          return (
            <line key={`seg-${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
              stroke={dashed ? "#d1d5db" : "#691C32"}
              strokeWidth="2.5" strokeDasharray={dashed ? "5,4" : "none"} strokeLinecap="round" />
          );
        })}

        {/* Puntos */}
        {puntos.map((p, i) => (
          <g key={p.periodo}>
            {p.anomalia ? (
              <polygon points={`${p.x},${p.y - 7} ${p.x - 7},${p.y + 6} ${p.x + 7},${p.y + 6}`}
                fill="#f59e0b" stroke="#fff" strokeWidth="1.5">
                <title>{`${p.periodo} · ${p.avance}% · ⚠ ${p.motivo_anomalia || "Dato anómalo — excluido del cálculo"}`}</title>
              </polygon>
            ) : (
              <circle cx={p.x} cy={p.y} r="4.5" fill="#691C32" stroke="#fff" strokeWidth="1.5">
                <title>{`${p.periodo} · ${p.avance}% · ${p.estatus}`}</title>
              </circle>
            )}
            {i % labelStep === 0 && (
              <text x={p.x} y={H - 8} fontSize="9" fontWeight="600" textAnchor="middle" fill="#9C8F7A">
                W{p.semana}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hayAnomalia && (
        <p className="text-xs mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ color: "#92400e", backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
          <span>⚠</span> Los puntos marcados con triángulo tienen una inconsistencia de captura conocida y no se usan en los indicadores.
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, color = "#1A1A1A", sub }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#FCFCFC", border: "1px solid #EFEFEF", minWidth: 124 }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "#9C8F7A" }}>{label}</p>
      <p className="text-lg font-black leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#B0A99A" }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: "#9C8F7A" }}>
      {children}
    </p>
  );
}

export default function ModalEvolucionObra({ open, onClose, tabla, id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bitacoraExpandida, setBitacoraExpandida] = useState(false);

  const cargar = useCallback(async () => {
    if (!tabla || id === undefined || id === null) return;
    setLoading(true); setError(null);
    try {
      const r = await evolucionAPI.getObra(tabla, id);
      setData(r);
    } catch (e) {
      setError(e.message || "Error al cargar la evolución de la obra.");
    } finally {
      setLoading(false);
    }
  }, [tabla, id]);

  useEffect(() => { if (open) { cargar(); setBitacoraExpandida(false); } }, [open, cargar]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const obra = data?.obra;
  const cfgEstatus = obra ? (ESTATUS_CFG[obra.estatus_actual] || ESTATUS_CFG["SIN INICIAR"]) : null;
  const cfgTendencia = data ? (TENDENCIA_CFG[data.indicadores.tendencia] || TENDENCIA_CFG.ESTABLE) : null;
  const alertasActivas = (data?.alertas || []).filter((a) => a.activa);
  const eventosOrdenados = data ? data.eventos.slice().reverse() : [];
  const eventosVisibles = bitacoraExpandida ? eventosOrdenados : eventosOrdenados.slice(0, 5);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(44,36,24,0.55)", backdropFilter: "blur(3px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />

      <div style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 860, maxHeight: "92vh", background: "white", borderRadius: 24,
          boxShadow: "0 24px 64px rgba(44,36,24,0.22)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header institucional — mismo lenguaje visual que el resto de SICOPS (burgundy/gold) */}
          <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #691C32 0%, #7E2843 55%, #4F0E21 100%)", flexShrink: 0 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.62)" }}>
                  Evolución de Obra · {obra ? `${obra.seguimiento || "—"} › ${obra.programa || "—"}` : "Cargando..."}
                </p>
                <h2 className="text-xl font-bold text-white mt-1 truncate">
                  {obra?.nombre_obra || "Cargando..."}
                </h2>
                {obra && (
                  <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.78)" }}>
                    📍 {obra.alcaldia || "—"} &nbsp;·&nbsp; {obra.clave_unica || "Sin clave"} &nbsp;·&nbsp; Avance actual: <strong>{obra.avance_actual}%</strong>
                  </p>
                )}
              </div>
              <button type="button" onClick={onClose}
                className="text-sm font-bold px-3 py-1.5 rounded-xl shrink-0 transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                ✕
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#FAF9F7" }}>
            {loading && !data && (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
              </div>
            )}
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>{error}</div>
            )}

            {data && (
              <div className="space-y-5">

                {/* Banner de alertas activas — visible, no solo un punto en el header */}
                {alertasActivas.length > 0 && (
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#B91C1C" }}>
                      🔴 {alertasActivas.length} alerta{alertasActivas.length !== 1 ? "s" : ""} operativa{alertasActivas.length !== 1 ? "s" : ""} activa{alertasActivas.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-1.5">
                      {alertasActivas.map((a, i) => {
                        const cfg = ALERTA_CFG[a.codigo] || { icon: "🔴", label: a.codigo };
                        return (
                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span style={{ color: "#7F1D1D" }}>{cfg.icon} <strong>{cfg.label}:</strong> {a.descripcion}</span>
                            <span className="shrink-0 text-[10px] font-semibold" style={{ color: "#B91C1C" }}>{fmtFecha(a.fecha_detectada)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Estatus + tendencia + banderas */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: cfgEstatus.bg, color: cfgEstatus.text, border: `1px solid ${cfgEstatus.border}` }}>
                    {obra.estatus_actual}
                  </span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                    style={{ backgroundColor: cfgTendencia.bg, color: cfgTendencia.color, border: `1px solid ${cfgTendencia.border}` }}>
                    {cfgTendencia.icon} {cfgTendencia.label}
                  </span>
                  {data.indicadores.proxima_a_terminar && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                      🏁 Próxima a terminar
                    </span>
                  )}
                  {data.indicadores.lista_para_inauguracion && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                      🎉 Lista para inauguración
                    </span>
                  )}
                </div>

                {/* KPIs — jerarquía visual en grid, no scroll horizontal */}
                <div>
                  <SectionLabel>Indicadores</SectionLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <Kpi label="Variación acum." value={`${data.indicadores.variacion_acumulada >= 0 ? "+" : ""}${data.indicadores.variacion_acumulada}%`} color="#691C32" />
                    <Kpi
                      label="Mayor increm."
                      value={data.indicadores.mayor_incremento_semanal ? `+${data.indicadores.mayor_incremento_semanal.delta}%` : "—"}
                      sub={data.indicadores.mayor_incremento_semanal?.periodo}
                      color="#16a34a"
                    />
                    <Kpi label="Sem. sin mov." value={data.indicadores.semanas_sin_movimiento} color={data.indicadores.semanas_sin_movimiento >= 3 ? "#B91C1C" : "#1A1A1A"} />
                    <Kpi label="Sem. con datos" value={data.indicadores.semanas_con_datos} />
                    {data.indicadores.semanas_excluidas_por_anomalia > 0 && (
                      <Kpi label="Excluidas" value={data.indicadores.semanas_excluidas_por_anomalia} color="#d97706" />
                    )}
                    <Kpi label="Días entre act." value={data.indicadores.tiempo_promedio_entre_actualizaciones_dias ?? "—"} />
                  </div>
                </div>

                {/* Gráfica */}
                <div className="rounded-2xl p-5" style={{ backgroundColor: "white", border: "1px solid #EFEFEF" }}>
                  <SectionLabel>Evolución semanal de avance</SectionLabel>
                  <GraficaEvolucion serie={data.serie} />
                </div>

                {/* Hitos — timeline vertical */}
                {data.hitos.length > 0 && (
                  <div>
                    <SectionLabel>Hitos</SectionLabel>
                    <div className="relative pl-5" style={{ borderLeft: "2px solid #EFEFEF" }}>
                      {data.hitos.map((h, i) => {
                        const cfg = HITO_CFG[h.tipo] || { icon: "•", color: "#1A1A1A", bg: "#FCFCFC", border: "#EFEFEF" };
                        return (
                          <div key={i} className="relative mb-2.5 last:mb-0">
                            <span className="absolute rounded-full" style={{ width: 10, height: 10, left: -25, top: 6, backgroundColor: cfg.color, border: "2px solid white", boxShadow: `0 0 0 2px ${cfg.border}` }} />
                            <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                              <span>{cfg.icon}</span>
                              <span className="font-bold" style={{ color: cfg.color }}>{h.descripcion}</span>
                              <span className="ml-auto text-[10px] font-semibold" style={{ color: "#9C8F7A" }}>{fmtFecha(h.fecha)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bitácora de eventos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel>Bitácora de cambios</SectionLabel>
                    {eventosOrdenados.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setBitacoraExpandida((v) => !v)}
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: "#691C32" }}
                      >
                        {bitacoraExpandida ? "Ver menos" : `Ver las ${eventosOrdenados.length}`}
                      </button>
                    )}
                  </div>
                  {eventosOrdenados.length === 0 ? (
                    <p className="text-sm" style={{ color: "#9C8F7A" }}>Sin eventos registrados todavía.</p>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #EFEFEF" }}>
                      {eventosVisibles.map((ev, i) => (
                        <div key={i} className="px-4 py-2.5 text-xs flex items-center justify-between gap-2"
                          style={{ backgroundColor: i % 2 === 0 ? "white" : "#FCFCFC", borderTop: i > 0 ? "1px solid #F8F5F2" : "none" }}>
                          <span style={{ color: "#1A1A1A" }}>
                            <strong>{ev.usuario}</strong> · {ev.porcentaje_anterior}% → {ev.porcentaje_nuevo}%
                            {ev.motivo ? ` · "${ev.motivo}"` : ""}
                          </span>
                          <span className="shrink-0 font-semibold" style={{ color: "#9C8F7A" }}>{fmtFechaHora(ev.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
