/**
 * ModalSistema.jsx
 * Control global de apertura / cierre del sistema — FUNCIÓN 1.
 * Diseño institucional SOBSE con indicadores visuales claros.
 */
import React, { memo, useCallback, useMemo, useState } from "react";
import { sistemaAPI } from "../../utils/api";

/* ── Paleta ── */
const ABIERTO = {
  heroBg:    "linear-gradient(135deg, #064e27 0%, #166534 55%, #1a7a3c 100%)",
  cardBg:    "rgba(22,101,52,0.07)",
  cardBorder:"rgba(22,101,52,0.22)",
  dot:       "#22c55e",
  labelColor:"#166534",
  btnBg:     "linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)",
  btnHover:  "#7f1d1d",
};
const CERRADO = {
  heroBg:    "linear-gradient(135deg, #6a1425 0%, #691C32 55%, #4a0f1e 100%)",
  cardBg:    "rgba(105,28,50,0.07)",
  cardBorder:"rgba(105,28,50,0.22)",
  dot:       "#ef4444",
  labelColor:"#691C32",
  btnBg:     "linear-gradient(135deg, #166534 0%, #0c4a2a 100%)",
  btnHover:  "#064e27",
};

const ANIM = `
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.35); }
  }
  .modal-in  { animation: modal-in 0.22s cubic-bezier(0.34,1.1,0.64,1) both; }
  .pulse-dot { animation: pulse-dot 1.6s ease-in-out infinite; }
`;

function ModalSistema({ abierto, onClose, onChange }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const P = useMemo(() => (abierto ? ABIERTO : CERRADO), [abierto]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await sistemaAPI.toggle(!abierto);
      onChange?.(response);
      onClose?.();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado del sistema.");
    } finally {
      setLoading(false);
    }
  }, [loading, abierto, onChange, onClose]);

  return (
    <>
      <style>{ANIM}</style>
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(8,12,10,0.58)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Estado del sistema"
      >
        <div
          className="modal-in w-full rounded-[24px] overflow-hidden flex flex-col"
          style={{
            maxWidth: "440px",
            background: "#ffffff",
            boxShadow: "0 32px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ══ HERO HEADER ══ */}
          <div
            className="px-6 pt-6 pb-5 shrink-0"
            style={{ background: P.heroBg }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.24em] mb-2"
                  style={{ color: "rgba(255,255,255,0.58)" }}
                >
                  SICOPS — Administración del sistema
                </p>
                <h2 className="text-xl font-bold text-white leading-tight">
                  Control de apertura
                </h2>
                <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
                  Gestiona el acceso operativo de todos los usuarios.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 flex items-center justify-center rounded-full text-white/80 hover:text-white transition-colors"
                style={{
                  width: 36, height: 36,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ══ BODY ══ */}
          <div className="px-6 pt-5 pb-6 space-y-4">

            {/* Card de estado actual */}
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: P.cardBg, border: `1px solid ${P.cardBorder}` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${abierto ? "pulse-dot" : ""}`}
                  style={{ backgroundColor: P.dot }}
                />
                <span className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: P.labelColor }}>
                  {abierto ? "Sistema abierto" : "Sistema cerrado"}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
                {abierto
                  ? "Los usuarios con permiso pueden capturar y actualizar información. Al cerrar el sistema, todas las operaciones de escritura quedarán bloqueadas hasta que se vuelva a abrir."
                  : "El sistema está en modo solo lectura. Los usuarios pueden navegar y consultar pero no pueden guardar cambios. Al abrir, se habilita la captura de información."}
              </p>
            </div>

            {/* Card de qué pasará */}
            <div
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#64748b" }}>
                Al confirmar, el sistema pasará a:
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: abierto ? "#ef4444" : "#22c55e" }}
                />
                <span className="text-sm font-semibold" style={{ color: abierto ? "#b91c1c" : "#166534" }}>
                  {abierto ? "CERRADO — Solo consulta" : "ABIERTO — Captura habilitada"}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.22)" }}>
                {error}
              </div>
            )}

            {/* Botones */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: "#f1f5f9",
                  color:           "#475569",
                  border:          "1px solid #e2e8f0",
                  cursor:          loading ? "not-allowed" : "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleToggle}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  background:  loading ? "#94a3b8" : P.btnBg,
                  border:      "1px solid transparent",
                  cursor:      loading ? "not-allowed" : "pointer",
                  boxShadow:   loading ? "none" : "0 6px 20px rgba(0,0,0,0.20)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="inline-block border-2 border-t-transparent rounded-full animate-spin"
                      style={{ width: 14, height: 14, borderColor: "#fff", borderTopColor: "transparent" }}
                    />
                    Aplicando...
                  </span>
                ) : (
                  abierto ? "Cerrar sistema" : "Abrir sistema"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(ModalSistema);
