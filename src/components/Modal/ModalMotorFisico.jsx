import React from "react";
import MotorFisicoInfografia from "../Seguimiento/MotorFisicoInfografia";

/**
 * Envoltura de modal para la infografía del Motor de Avance Físico —
 * mismo patrón que ModalMotorFinanciero.jsx (cierre flotante, sin barra
 * de título duplicada encima del contenido).
 */
export default function ModalMotorFisico({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Motor de Avance Físico — cómo funciona"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Cerrar"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#691C32">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="w-full h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <MotorFisicoInfografia />
      </div>
    </div>
  );
}
