import React from "react";

const VARIANT_COLORS = {
  primary: "#691C32",
  danger:  "#dc2626",
  info:    "#2563eb",
  secondary: "#6b7280",
};

/**
 * Modal de confirmación institucional reutilizable.
 *
 * Props:
 *   open           — boolean: mostrar o no
 *   title          — string: título principal
 *   subtitle       — string: subtítulo / nombre de obra
 *   children       — ReactNode: contenido (inputs, textos, etc.)
 *   onConfirm      — () => void
 *   onCancel       — () => void
 *   confirmText    — string (default "Confirmar")
 *   cancelText     — string (default "Cancelar")
 *   confirmDisabled — boolean
 *   loading        — boolean
 *   variant        — "primary" | "danger" | "info" | "secondary"
 */
export default function ConfirmModal({
  open,
  title,
  subtitle,
  children,
  onConfirm,
  onCancel,
  confirmText   = "Confirmar",
  cancelText    = "Cancelar",
  confirmDisabled = false,
  loading       = false,
  variant       = "primary",
}) {
  if (!open) return null;

  const accentColor = VARIANT_COLORS[variant] ?? VARIANT_COLORS.primary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
        style={{
          background: "rgba(255,255,255,0.97)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Franja de color superior */}
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

        {/* Cabecera */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <h3 className="text-lg font-bold" style={{ color: "#1f2937" }}>{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm font-medium truncate" style={{ color: "#6b7280" }}>{subtitle}</p>
          )}
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Pie con botones */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-full text-sm font-medium transition-colors"
            style={{ backgroundColor: "#e5e7eb", color: "#374151" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#d1d5db"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#e5e7eb"; }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || loading}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-opacity"
            style={{
              backgroundColor: accentColor,
              opacity: confirmDisabled || loading ? 0.5 : 1,
              cursor: confirmDisabled || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Guardando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
