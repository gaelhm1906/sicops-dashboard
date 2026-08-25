/**
 * pages/GestionObras/BajaLogicaModal.jsx
 * Modal de baja lógica controlada con motivo del catálogo,
 * resumen de dependencias y confirmación explícita.
 */
import React, { useState, useEffect, useCallback } from "react";
import { geoestadisticaAPI } from "../../utils/api";

const MOTIVOS_LABELS = {
  OBRA_DUPLICADA:       "Obra duplicada",
  ERROR_DE_CAPTURA:     "Error de captura",
  OBRA_CANCELADA:       "Obra cancelada",
  OBRA_MIGRADA:         "Obra migrada",
  OBRA_CONSOLIDADA:     "Obra consolidada con otra",
  CAMBIO_DE_PROGRAMA:   "Cambio de programa",
  FUERA_DE_ALCANCE:     "Fuera del alcance del sistema",
  CAMBIO_TIPO_GEOMETRICO: "Cambio de tipo geométrico",
  OTRO:                 "Otro (especificar)",
};

const T = {
  danger:      "#b91c1c",
  dangerSoft:  "#fef2f2",
  dangerBorder:"#fecaca",
  text:        "#1e293b",
  textSoft:    "#64748b",
  inputBg:     "#f8fafc",
  inputBorder: "#cbd5e1",
  divider:     "#e2e8f0",
};

const fieldStyle = {
  height: "2.375rem", fontSize: "0.875rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.text,
  paddingLeft: "0.625rem", paddingRight: "0.625rem",
  width: "100%", boxSizing: "border-box",
};

export default function BajaLogicaModal({ obra, onClose, onSuccess }) {
  const [deps,        setDeps]        = useState(null);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [motivo,      setMotivo]      = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  /* Cargar dependencias al montar */
  useEffect(() => {
    geoestadisticaAPI.verificarDependencias(obra.clave_unica)
      .then((r) => setDeps(r.data))
      .catch(() => setDeps(null))
      .finally(() => setLoadingDeps(false));
  }, [obra.clave_unica]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const totalDeps = deps
    ? Object.values(deps).reduce((s, v) => s + parseInt(v || 0, 10), 0)
    : 0;

  const handleConfirmar = useCallback(async () => {
    if (!motivo) { setError("Selecciona un motivo de baja."); return; }
    if (motivo === "OTRO" && !observacion.trim()) {
      setError('El campo "Observaciones" es obligatorio cuando el motivo es "Otro".'); return;
    }
    setSaving(true); setError(null);
    try {
      await geoestadisticaAPI.bajaLogica(obra.clave_unica, {
        motivo_baja:        motivo,
        observaciones_baja: observacion.trim() || undefined,
      });
      onSuccess();
    } catch (e) {
      setError(e.message || "Error al dar de baja.");
    } finally {
      setSaving(false);
    }
  }, [motivo, observacion, obra, onSuccess]);

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 51 }}>
        <div className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

          {/* Header rojo */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 60%, #dc2626 100%)" }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(254,226,226,0.70)" }}>Gestión de Obras</p>
              <h2 className="mt-1 text-lg font-bold text-white">Baja Lógica de Obra</h2>
            </div>
            <button type="button" onClick={onClose}
              style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "50%", cursor: "pointer", fontWeight: 700 }}>✕</button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto">

            {/* Info de la obra */}
            <div className="rounded-xl px-4 py-3"
              style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: T.textSoft }}>
                Obra a dar de baja
              </p>
              <p className="font-bold text-sm" style={{ color: T.text }}>{obra.nombre_obra || "—"}</p>
              <p className="text-xs font-mono mt-0.5" style={{ color: "#94a3b8" }}>{obra.clave_unica}</p>
              <p className="text-xs mt-1" style={{ color: T.textSoft }}>
                {obra.programa} · {obra.dg} · {obra.alcaldia}
              </p>
            </div>

            {/* Resumen de dependencias */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: T.textSoft }}>
                Registros dependientes
              </p>
              {loadingDeps ? (
                <p className="text-xs" style={{ color: T.textSoft }}>Verificando…</p>
              ) : deps ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Alcances",              deps.alcances],
                    ["Información General",   deps.info_general],
                    ["Frentes",               deps.frentes],
                    ["Clasificaciones",       deps.clasificaciones],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded-xl px-3 py-2 flex items-center justify-between"
                      style={{ backgroundColor: parseInt(count || 0) > 0 ? "#fffbeb" : "#f8fafc",
                        border: `1px solid ${parseInt(count || 0) > 0 ? "#fde68a" : "#e2e8f0"}` }}>
                      <span className="text-xs" style={{ color: T.textSoft }}>{label}</span>
                      <span className="text-sm font-bold"
                        style={{ color: parseInt(count || 0) > 0 ? "#92400e" : "#94a3b8" }}>
                        {count || 0}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "#94a3b8" }}>No se pudo verificar.</p>
              )}
              {totalDeps > 0 && (
                <div className="mt-2 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                  ⚠ Esta obra tiene {totalDeps} registro{totalDeps !== 1 ? "s" : ""} asociado{totalDeps !== 1 ? "s" : ""}.
                  La baja lógica los conservará en la base de datos.
                </div>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1"
                style={{ color: T.textSoft }}>
                Motivo de baja <span style={{ color: T.danger }}>*</span>
              </label>
              <select value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(null); }}
                style={fieldStyle}>
                <option value="">Seleccionar motivo…</option>
                {Object.entries(MOTIVOS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Observaciones (obligatorio si motivo = OTRO) */}
            {motivo && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1"
                  style={{ color: T.textSoft }}>
                  Observaciones {motivo === "OTRO" && <span style={{ color: T.danger }}>*</span>}
                </label>
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Detalle adicional (opcional, obligatorio si motivo es Otro)"
                  rows={2}
                  style={{ ...fieldStyle, height: "auto", paddingTop: "0.5rem",
                    paddingBottom: "0.5rem", resize: "none" }} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-between gap-3"
            style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
            <button type="button" onClick={onClose}
              className="text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: "#f1f5f9", color: T.textSoft,
                border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={handleConfirmar} disabled={saving || !motivo}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{
                backgroundColor: saving || !motivo ? "#fca5a5" : T.danger,
                color: "#ffffff", border: "none",
                cursor: saving || !motivo ? "not-allowed" : "pointer",
                boxShadow: saving || !motivo ? "none" : "0 6px 16px rgba(185,28,28,0.28)",
              }}>
              {saving ? "Procesando…" : "Confirmar Baja"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
