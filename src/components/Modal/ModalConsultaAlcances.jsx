/**
 * ModalConsultaAlcances — vista de solo lectura del historial de alcances.
 * Se abre desde CoberturaAlcances al hacer click en una obra CON alcances.
 */
import React, { useEffect, useState } from "react";
import { alcancesAPI } from "../../utils/api";

const TIPO_CFG = {
  PROYECTADO: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  EJECUTADO:  { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
};

function fmtFecha(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Spin() {
  return (
    <div className="w-7 h-7 rounded-full border-4 border-t-transparent animate-spin"
      style={{ borderColor: "#0e7490", borderTopColor: "transparent" }} />
  );
}

export default function ModalConsultaAlcances({ open, obra, onClose }) {
  const [alcances,  setAlcances]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!open || !obra?.clave_unica) return;
    setLoading(true);
    setError(null);
    alcancesAPI.getHistorial(obra.clave_unica)
      .then((r) => setAlcances(r.data || []))
      .catch((e) => setError(e.message || "Error al cargar alcances"))
      .finally(() => setLoading(false));
  }, [open, obra?.clave_unica]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !obra) return null;

  const tipoCfg = TIPO_CFG[obra.tipo_alcance_obra] || null;
  const meta    = [obra.programa, obra.dg].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(5,20,30,0.55)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl"
        style={{
          maxWidth: "860px", maxHeight: "90vh",
          background: "#fff",
          border: "1px solid rgba(14,116,144,0.18)",
          boxShadow: "0 24px 64px rgba(5,20,30,0.24), 0 4px 16px rgba(5,20,30,0.10)",
        }}
      >
        {/* ── HEADER ── */}
        <div
          className="shrink-0 px-6 pt-5 pb-4 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg, #0c4a63 0%, #0e7490 55%, #0891b2 100%)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Detalle de Alcances · Consulta
              </p>
              <h2 className="mt-1 text-lg font-bold leading-snug text-white truncate" title={obra.nombre_obra}>
                {obra.nombre_obra || "Obra"}
              </h2>
              {meta && <p className="mt-0.5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>{meta}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {obra.clave_unica && (
                  <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{obra.clave_unica}</p>
                )}
                {tipoCfg ? (
                  <span style={{ display: "inline-block", fontSize: "0.625rem", fontWeight: 700, padding: "2px 8px",
                    borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
                    {obra.tipo_alcance_obra}
                  </span>
                ) : (
                  <span style={{ display: "inline-block", fontSize: "0.625rem", fontWeight: 700, padding: "2px 8px",
                    borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.60)",
                    border: "1px solid rgba(255,255,255,0.15)", textTransform: "uppercase" }}>
                    Sin clasificar
                  </span>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f8fbfc" }}>

          {/* KPI rápido */}
          {!loading && !error && (
            <div className="px-6 py-3 flex items-center gap-4 border-b" style={{ borderColor: "rgba(14,116,144,0.12)", backgroundColor: "#fff" }}>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total alcances</p>
                <p className="text-xl font-bold" style={{ color: "#0e7490" }}>{alcances.length}</p>
              </div>
              {obra.ultima_captura && (
                <div className="pl-4 border-l" style={{ borderColor: "rgba(14,116,144,0.15)" }}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Última captura</p>
                  <p className="text-sm font-semibold text-gray-700">{fmtFecha(obra.ultima_captura)}</p>
                </div>
              )}
              {obra.ultimo_usuario && (
                <div className="pl-4 border-l" style={{ borderColor: "rgba(14,116,144,0.15)" }}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Usuario</p>
                  <p className="text-sm font-semibold text-gray-700">{obra.ultimo_usuario}</p>
                </div>
              )}
            </div>
          )}

          {/* Estados */}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16">
              <Spin /><span className="text-sm text-gray-500">Cargando alcances…</span>
            </div>
          )}

          {error && !loading && (
            <div className="m-6 rounded-xl px-4 py-3 text-sm text-center"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
              {error}
            </div>
          )}

          {!loading && !error && alcances.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">Sin registros de alcances.</div>
          )}

          {/* Tabla */}
          {!loading && !error && alcances.length > 0 && (
            <div className="px-4 py-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "rgba(14,116,144,0.06)" }}>
                    {["Acción","Concepto","Cantidad","Unidad","Usuario captura","Fecha captura","Usuario edición","Fecha edición"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-gray-500 whitespace-nowrap"
                        style={{ borderBottom: "1px solid rgba(14,116,144,0.14)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alcances.map((a, i) => (
                    <tr key={a.id || i}
                      style={{ borderBottom: "1px solid rgba(14,116,144,0.08)", backgroundColor: i % 2 === 0 ? "#fff" : "rgba(14,116,144,0.025)" }}>
                      <td className="px-3 py-2.5">
                        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: "rgba(14,116,144,0.10)", color: "#0e7490", border: "1px solid rgba(14,116,144,0.20)" }}>
                          {a.accion}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-800 max-w-[220px]" title={a.concepto}>
                        <span className="font-medium">{a.concepto}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold tabular-nums text-gray-700 whitespace-nowrap text-right">
                        {Number(a.cantidad).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 uppercase font-semibold whitespace-nowrap">{a.unidad || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{a.usuario_actualizacion || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(a.fecha_captura)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{a.usuario_edicion || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtFecha(a.fecha_edicion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="shrink-0 px-6 py-3.5 flex justify-end rounded-b-2xl"
          style={{ backgroundColor: "#fff", borderTop: "1px solid rgba(14,116,144,0.12)" }}>
          <button type="button" onClick={onClose}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ backgroundColor: "rgba(14,116,144,0.08)", color: "#0e7490",
              border: "1px solid rgba(14,116,144,0.20)", cursor: "pointer" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
