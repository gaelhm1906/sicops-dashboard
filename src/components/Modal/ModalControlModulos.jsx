/**
 * components/Modal/ModalControlModulos.jsx
 * Panel de control operativo de módulos — solo visible para ADMIN.
 *
 * Permite habilitar/deshabilitar módulos del sistema en tiempo real
 * sin redeployar. Los cambios se persisten en sig_sobse.modulos_control.
 */

import React, { useCallback, useEffect, useState } from "react";
import { modulosAPI } from "../../utils/api";
import { useModules } from "../../context/ModulesContext";

/* ── Iconos inline ── */
function IconLock({ open = false }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const THEME = {
  heroBg:   "linear-gradient(135deg, #691C32 0%, #7E2843 58%, #4F0E21 100%)",
  panelBg:  "linear-gradient(180deg, #fffdf9 0%, #f6f1e8 100%)",
  border:   "1px solid rgba(201,166,107,0.28)",
  shadow:   "0 24px 60px rgba(38,26,17,0.24)",
  accent:   "#691C32",
  gold:     "#B8912A",
  goldSoft: "#F5E8D1",
};

/* Chip de estado */
function EstadoChip({ habilitado }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{
        backgroundColor: habilitado ? "rgba(34,197,94,0.12)" : "rgba(105,28,50,0.10)",
        color:           habilitado ? "#166534"               : "#7E2843",
        border:          habilitado ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(105,28,50,0.20)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: habilitado ? "#22c55e" : "#7E2843" }}
      />
      {habilitado ? "Habilitado" : "Restringido"}
    </span>
  );
}

/* Card de un módulo */
function ModuloCard({ clave, config, onToggle, toggling }) {
  const isToggling = toggling === clave;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border:     THEME.border,
        background: "#ffffff",
        boxShadow:  "0 4px 16px rgba(38,26,17,0.08)",
      }}
    >
      {/* Encabezado */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-3"
        style={{
          background: config.enabled
            ? "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(255,253,249,0.80) 100%)"
            : "linear-gradient(135deg, rgba(105,28,50,0.07) 0%, rgba(255,253,249,0.80) 100%)",
          borderBottom: THEME.border,
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest">
              {clave}
            </span>
            <EstadoChip habilitado={config.enabled} />
          </div>
          <p className="text-sm font-bold text-gray-800 truncate">{config.label || clave}</p>
          {config.route && (
            <p className="text-xs text-gray-400 mt-0.5">{config.route}</p>
          )}
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={() => onToggle(clave, !config.enabled)}
          disabled={isToggling}
          aria-label={`${config.enabled ? "Restringir" : "Habilitar"} módulo ${config.label || clave}`}
          className="shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none"
          style={{
            backgroundColor: config.enabled ? "#22c55e" : "#7E2843",
            opacity:         isToggling ? 0.6 : 1,
            cursor:          isToggling ? "wait" : "pointer",
          }}
        >
          <span
            className="inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300"
            style={{ transform: config.enabled ? "translateX(24px)" : "translateX(4px)" }}
          />
        </button>
      </div>

      {/* Roles con acceso aunque esté restringido */}
      <div className="px-5 py-3">
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.14em] font-semibold mb-2">
          Bypass — acceso aunque esté restringido
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(config.restrictedRoles || []).map((rol) => (
            <span
              key={rol}
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{
                backgroundColor: "rgba(201,166,107,0.14)",
                color:           THEME.gold,
                border:          "1px solid rgba(201,166,107,0.28)",
              }}
            >
              {rol}
            </span>
          ))}
        </div>
        {config.message && (
          <p className="mt-3 text-[12px] leading-5 text-gray-500 italic line-clamp-2">
            {config.message}
          </p>
        )}
        {config.actualizadoPor && (
          <p className="mt-2 text-[11px] text-gray-400">
            Último cambio por: <strong>{config.actualizadoPor}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ModalControlModulos({ onClose }) {
  const { moduleStates, refreshModules } = useModules();
  const [localStates, setLocalStates]    = useState(moduleStates);
  const [toggling, setToggling]          = useState(null);
  const [feedback, setFeedback]          = useState(null);

  /* Sync cuando moduleStates cambie externamente */
  useEffect(() => {
    setLocalStates(moduleStates);
  }, [moduleStates]);

  /* Cerrar con Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleToggle = useCallback(async (clave, nuevoEstado) => {
    setToggling(clave);
    setFeedback(null);

    try {
      await modulosAPI.toggle(clave, nuevoEstado);

      /* Actualizar estado local optimisticamente */
      setLocalStates((prev) => ({
        ...prev,
        [clave]: {
          ...(prev[clave] || {}),
          enabled:   nuevoEstado,
          habilitado: nuevoEstado,
        },
      }));

      setFeedback({
        type: "ok",
        text: `Módulo "${clave}" ${nuevoEstado ? "habilitado" : "restringido"} correctamente.`,
      });

      /* Refrescar contexto global para que el resto de la app se actualice */
      await refreshModules();
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Error al cambiar estado del módulo." });
    } finally {
      setToggling(null);
    }
  }, [refreshModules]);

  const modulos = Object.entries(localStates);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,10,12,0.60)", backdropFilter: "blur(8px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-[28px] overflow-hidden flex flex-col"
        style={{
          maxWidth:  "580px",
          maxHeight: "90vh",
          background: THEME.panelBg,
          border:     THEME.border,
          boxShadow:  THEME.shadow,
        }}
      >
        {/* Hero */}
        <div className="px-6 py-5 shrink-0" style={{ background: THEME.heroBg }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#F4D7A1" }}
              >
                <IconShield />
              </div>
              <div>
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
                  style={{ color: "rgba(255,248,241,0.65)" }}
                >
                  SICOPS — Administración
                </div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  Control Operativo de Módulos
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors"
              style={{ backgroundColor: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className="mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: feedback.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(105,28,50,0.10)",
              color:           feedback.type === "ok" ? "#166534"               : "#7E2843",
              border:          feedback.type === "ok" ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(105,28,50,0.25)",
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Lista de módulos */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 space-y-4">
          {modulos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No hay módulos configurados.</p>
          )}
          {modulos.map(([clave, config]) => (
            <ModuloCard
              key={clave}
              clave={clave}
              config={config}
              onToggle={handleToggle}
              toggling={toggling}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-4 flex justify-between items-center text-xs text-gray-400"
          style={{ borderTop: "1px solid rgba(201,166,107,0.18)" }}
        >
          <span>Los cambios aplican de inmediato para todos los usuarios activos.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #691C32 0%, #7E2843 100%)" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
