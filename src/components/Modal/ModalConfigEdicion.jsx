/**
 * ModalConfigEdicion.jsx
 * Control administrativo para habilitar / bloquear la edición
 * de registros ya guardados en el módulo de Alcances — FUNCIÓN 4.
 */
import React, { useCallback, useEffect, useState } from "react";
import { alcancesAPI } from "../../utils/api";

const ANIM = `
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .cfged-modal-in { animation: modal-in 0.22s cubic-bezier(0.34,1.1,0.64,1) both; }
`;

function Spin({ size = 14 }) {
  return (
    <span
      className="inline-block border-2 border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size, borderColor: "#166534", borderTopColor: "transparent" }}
    />
  );
}

export default function ModalConfigEdicion({ onClose }) {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [permitir,   setPermitir]   = useState(false);
  const [adminUser,  setAdminUser]  = useState(null);
  const [fechaUpdate,setFechaUpdate]= useState(null);
  const [feedback,   setFeedback]   = useState(null);

  /* Cargar config actual */
  useEffect(() => {
    let cancelled = false;
    alcancesAPI.getConfig()
      .then((res) => {
        if (cancelled) return;
        setPermitir(res?.data?.permitir_edicion_alcances ?? false);
        setAdminUser(res?.data?.usuario_admin || null);
        setFechaUpdate(res?.data?.fecha_actualizacion || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* Cerrar con Escape */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleToggle = useCallback(async () => {
    if (saving) return;
    const nuevoValor = !permitir;
    setSaving(true);
    setFeedback(null);
    try {
      await alcancesAPI.updateConfig({ permitir_edicion_alcances: nuevoValor });
      setPermitir(nuevoValor);
      setFeedback({
        type: "ok",
        text: nuevoValor
          ? "Edición de alcances habilitada. Los usuarios pueden modificar registros."
          : "Edición de alcances bloqueada. Los usuarios solo pueden crear nuevos registros.",
      });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Error al actualizar la configuración." });
    } finally {
      setSaving(false);
    }
  }, [saving, permitir]);

  const fechaFormateada = fechaUpdate
    ? new Date(fechaUpdate).toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <>
      <style>{ANIM}</style>
      <div
        className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(8,12,10,0.58)", backdropFilter: "blur(6px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-label="Control de edición de alcances"
      >
        <div
          className="cfged-modal-in w-full rounded-[24px] overflow-hidden flex flex-col"
          style={{
            maxWidth:   "420px",
            background: "linear-gradient(180deg, #fffdf9 0%, #f6f1e8 100%)",
            boxShadow:  "0 32px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
            border:     "1px solid rgba(201,166,107,0.28)",
          }}
        >
          {/* ── Hero header ── */}
          <div
            className="px-6 py-5 shrink-0"
            style={{
              background: "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 55%, #1e3a1e 100%)",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <circle cx="12" cy="16" r="1" fill="rgba(255,255,255,0.90)" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
                    style={{ color: "rgba(255,255,255,0.55)" }}>
                    SICOPS — Módulo Alcances
                  </p>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    Control de edición
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(255,255,255,0.10)",
                  border:          "1px solid rgba(255,255,255,0.18)",
                  color:           "rgba(255,255,255,0.80)",
                  cursor:          "pointer",
                }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Cuerpo ── */}
          <div className="px-6 py-5 space-y-5">

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Spin size={18} />
                <span className="text-sm" style={{ color: "#64748b" }}>Cargando configuración…</span>
              </div>
            ) : (
              <>
                {/* Card de estado actual + toggle */}
                <div
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: permitir ? "rgba(22,101,52,0.07)" : "rgba(105,28,50,0.07)",
                    border:          permitir ? "1px solid rgba(22,101,52,0.22)" : "1px solid rgba(105,28,50,0.22)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{permitir ? "🔓" : "🔒"}</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: permitir ? "#166534" : "#691C32" }}
                        >
                          {permitir ? "Edición habilitada" : "Edición bloqueada"}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "#4b5563" }}>
                        {permitir
                          ? "Los usuarios pueden modificar y eliminar registros existentes en el historial de alcances."
                          : "Los usuarios solo pueden agregar nuevos registros. Los existentes no se pueden modificar."}
                      </p>
                    </div>

                    {/* Toggle switch */}
                    <button
                      type="button"
                      onClick={handleToggle}
                      disabled={saving}
                      aria-label={permitir ? "Bloquear edición" : "Habilitar edición"}
                      className="shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none"
                      style={{
                        backgroundColor: permitir ? "#22c55e" : "#691C32",
                        opacity:         saving ? 0.6 : 1,
                        cursor:          saving ? "wait" : "pointer",
                      }}
                    >
                      <span
                        className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300"
                        style={{ transform: permitir ? "translateX(24px)" : "translateX(4px)" }}
                      />
                    </button>
                  </div>
                </div>

                {/* Información sobre qué se controla */}
                <div
                  className="rounded-xl px-4 py-3 space-y-1.5"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Esto controla
                  </p>
                  {[
                    { icon: "✏️", label: "Editar cantidad y unidad de registros guardados" },
                    { icon: "🗑️", label: "Eliminar registros del historial de alcances" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-sm">{icon}</span>
                      <span className="text-xs" style={{ color: "#475569" }}>{label}</span>
                      <span
                        className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: permitir ? "rgba(34,197,94,0.12)" : "rgba(105,28,50,0.10)",
                          color:           permitir ? "#166534" : "#691C32",
                        }}
                      >
                        {permitir ? "ON" : "OFF"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Meta */}
                {(adminUser || fechaFormateada) && (
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    {adminUser && <>Último cambio por: <strong style={{ color: "#64748b" }}>{adminUser}</strong></>}
                    {fechaFormateada && <> · {fechaFormateada}</>}
                  </p>
                )}

                {/* Feedback */}
                {feedback && (
                  <div
                    className="rounded-xl px-4 py-3 text-sm font-medium"
                    style={{
                      backgroundColor: feedback.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(185,28,28,0.08)",
                      color:           feedback.type === "ok" ? "#166534" : "#b91c1c",
                      border:          feedback.type === "ok" ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(185,28,28,0.22)",
                    }}
                  >
                    {feedback.text}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            className="shrink-0 px-5 py-4 flex justify-end"
            style={{ borderTop: "1px solid rgba(201,166,107,0.18)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 100%)",
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
