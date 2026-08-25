/**
 * pages/InteligenciaOperativa/index.jsx
 * Inteligencia Operativa — Fase 1: resumen ejecutivo, transiciones de
 * estatus y alertas de obras sin movimiento, a partir de `auditoria`.
 * Solo accesible para ADMIN.
 */
import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Layout/Sidebar";
import Footer  from "../../components/Layout/Footer";
import { useAuth }        from "../../context/AuthContext";
import { inteligenciaAPI } from "../../utils/api";

/* ── Paleta institucional (consistente con Estado Operativo) ── */
const T = {
  pageBg: "linear-gradient(180deg, #f1f5f9 0%, #e8ecf0 100%)",
  heroBg: "linear-gradient(135deg, #312e81 0%, #4338ca 60%, #6366f1 100%)",
  card:   "#ffffff",
  border: "rgba(0,0,0,0.08)",
  shadow: "0 2px 8px rgba(0,0,0,0.06)",
};

function fmtFecha(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function KpiCard({ label, value, accent = "#1e293b" }) {
  return (
    <div className="rounded-2xl p-4 text-center"
      style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-xl font-black" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function SectionTitle({ children, badge }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{children}</p>
      <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
      {badge}
    </div>
  );
}

const BUCKET_CFG = {
  d7:  { label: "7+ días",  bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  d15: { label: "15+ días", bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  d30: { label: "30+ días", bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
};

function bucketDe(dias) {
  if (dias >= 30) return "d30";
  if (dias >= 15) return "d15";
  return "d7";
}

export default function InteligenciaOperativa() {
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN";

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await inteligenciaAPI.getResumen();
      setData(r);
    } catch (e) {
      setError(e.message || "Error al cargar inteligencia operativa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) cargar(); }, [cargar, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
        <div className="flex flex-1"><Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-red-600">Acceso restringido — Solo ADMIN.</p>
          </main>
        </div><Footer />
      </div>
    );
  }

  const resumen       = data?.resumen;
  const transiciones  = data?.transiciones;
  const sinMovimiento = data?.sinMovimiento;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full">

          {/* Hero */}
          <div className="rounded-2xl px-5 py-4 mb-5"
            style={{ background: T.heroBg, border: "1px solid rgba(0,0,0,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Panel Administrativo · SICOPS — Fase 1
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white">📈 Inteligencia Operativa</h1>
                {data && (
                  <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Generado el {data.generado_en} · Fuente: tabla auditoria
                  </p>
                )}
              </div>
              <button type="button" onClick={cargar} disabled={loading}
                className="text-sm font-semibold px-4 py-2 rounded-xl shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.28)", cursor: loading ? "wait" : "pointer" }}>
                {loading ? "Actualizando…" : "↺ Actualizar"}
              </button>
            </div>
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#4338ca", borderTopColor: "transparent" }} />
            </div>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          {data && (
            <>
              {/* ── Resumen ejecutivo ── */}
              <div className="mb-5">
                <SectionTitle>Resumen Ejecutivo</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <KpiCard label="Eventos totales"   value={resumen.total_eventos.toLocaleString("es-MX")} />
                  <KpiCard label="Obras auditadas"   value={resumen.obras_unicas.toLocaleString("es-MX")} />
                  <KpiCard label="Inauguraciones"    value={resumen.inauguraciones.toLocaleString("es-MX")} accent="#15803d" />
                  <KpiCard label="Cancelaciones"     value={resumen.cancelaciones.toLocaleString("es-MX")} accent="#b91c1c" />
                  <KpiCard label="Actualizaciones"   value={resumen.actualizaciones.toLocaleString("es-MX")} />
                  <KpiCard label="Avance prom. capturado"
                    value={resumen.avance_promedio_capturado !== null ? `${resumen.avance_promedio_capturado}%` : "—"} />
                  <KpiCard label="DGs activas"       value={resumen.dgs_activas.toLocaleString("es-MX")} />
                  <KpiCard label="Semanas con datos" value={resumen.actividad_semanal.length} />
                </div>

                {/* Top DGs por actividad */}
                {resumen.top_dgs.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          {["DG / Usuario", "Eventos", "Obras distintas", "Avance prom."].map((h, i) => (
                            <th key={h} className="px-4 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: "#64748b", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.top_dgs.map((dg, i) => (
                          <tr key={dg.usuario} style={{ backgroundColor: i % 2 === 0 ? "white" : "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                            <td className="px-4 py-2 font-semibold" style={{ color: "#1e293b" }}>{dg.usuario}</td>
                            <td className="px-4 py-2 text-right" style={{ color: "#4338ca", fontWeight: 700 }}>{dg.eventos}</td>
                            <td className="px-4 py-2 text-right" style={{ color: "#64748b" }}>{dg.obras_distintas}</td>
                            <td className="px-4 py-2 text-right" style={{ color: "#64748b" }}>
                              {dg.avance_promedio !== null ? `+${dg.avance_promedio}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Transiciones de estatus ── */}
              <div className="mb-5">
                <SectionTitle>Transiciones de Estatus</SectionTitle>
                {transiciones.matriz.length === 0 ? (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>Sin transiciones registradas aún.</p>
                ) : (
                  <div className="rounded-2xl overflow-hidden mb-3" style={{ border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          {["De", "A", "Total", "Última vez"].map((h, i) => (
                            <th key={h} className="px-4 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: "#64748b", textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transiciones.matriz.map((t, i) => (
                          <tr key={`${t.estatus_anterior}-${t.estatus_nuevo}`}
                            style={{ backgroundColor: i % 2 === 0 ? "white" : "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                            <td className="px-4 py-2" style={{ color: "#64748b" }}>{t.estatus_anterior}</td>
                            <td className="px-4 py-2 font-semibold" style={{ color: "#1e293b" }}>→ {t.estatus_nuevo}</td>
                            <td className="px-4 py-2 text-right font-bold" style={{ color: "#4338ca" }}>{t.total}</td>
                            <td className="px-4 py-2 text-right" style={{ color: "#94a3b8" }}>{fmtFecha(t.ultima_fecha)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {transiciones.recientes.length > 0 && (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#94a3b8" }}>
                      Últimos cambios de estatus
                    </p>
                    <div className="space-y-1.5">
                      {transiciones.recientes.slice(0, 8).map((r, i) => (
                        <div key={i} className="text-xs flex items-center justify-between gap-2">
                          <span className="truncate" style={{ color: "#1e293b" }}>
                            {r.nombre_obra || `Obra #${r.obra_id}`} <span style={{ color: "#94a3b8" }}>({r.tabla})</span>
                          </span>
                          <span className="shrink-0" style={{ color: "#64748b" }}>
                            {r.estatus_anterior} → <strong>{r.estatus_nuevo}</strong> · {r.usuario} · {fmtFecha(r.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Obras sin movimiento ── */}
              <div>
                <SectionTitle>Obras Sin Movimiento</SectionTitle>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {["d7", "d15", "d30"].map((k) => {
                    const cfg = BUCKET_CFG[k];
                    return (
                      <div key={k} className="rounded-2xl p-4 text-center"
                        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cfg.text, opacity: 0.8 }}>
                          {cfg.label}
                        </p>
                        <p className="text-xl font-black" style={{ color: cfg.text }}>
                          {sinMovimiento.resumen[k]}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {sinMovimiento.listado.length === 0 ? (
                  <p className="text-sm" style={{ color: "#94a3b8" }}>No hay obras activas sin movimiento ≥ 7 días. 🎉</p>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          {["Obra", "Tabla", "Estatus", "DG", "Última act.", "Días"].map((h, i) => (
                            <th key={h} className="px-3 py-2 text-xs font-bold uppercase tracking-wide"
                              style={{ color: "#64748b", textAlign: i === 5 ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sinMovimiento.listado.map((o, i) => {
                          const cfg = BUCKET_CFG[bucketDe(o.dias_sin_movimiento)];
                          return (
                            <tr key={`${o.tabla}-${o.obra_id}`}
                              style={{ backgroundColor: i % 2 === 0 ? "white" : "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                              <td className="px-3 py-2 font-semibold truncate max-w-[220px]" style={{ color: "#1e293b" }}
                                title={o.nombre_obra}>{o.nombre_obra || `Obra #${o.obra_id}`}</td>
                              <td className="px-3 py-2 truncate max-w-[160px]" style={{ color: "#94a3b8" }} title={o.tabla}>{o.tabla}</td>
                              <td className="px-3 py-2" style={{ color: "#64748b" }}>{o.estatus || "—"}</td>
                              <td className="px-3 py-2" style={{ color: "#64748b" }}>{o.usuario || "—"}</td>
                              <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{fmtFecha(o.ultima_actualizacion)}</td>
                              <td className="px-3 py-2 text-right">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                                  {o.dias_sin_movimiento}d
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </main>
      </div>
      <Footer />
    </div>
  );
}
