import React from "react";
import RegistrarTareaWizardContenido from "./RegistrarTareaWizardContenido";

/**
 * Versión en modal independiente del asistente — para lanzarlo desde una
 * pantalla que NO es ya el modal de la obra (p. ej. la vista previa de la
 * Bandeja de trabajo en el Home). Dentro de la Bandeja de la obra se usa
 * directamente RegistrarTareaWizardContenido, sin este envoltorio, para no
 * abrir una ventana encima de otra.
 */
export default function RegistrarTareaWizard({ obra, obraKey, requerimientosRol, registrosPorId, tareaInicial, onGuardar, onClose, onIrSiguiente }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between gap-3 shrink-0" style={{ backgroundColor: "var(--guinda)" }}>
          <div className="min-w-0">
            <p className="text-white/65 text-xs truncate">{obra.nombre_obra || obra.nombre}</p>
            <p className="text-white font-semibold text-sm mt-0.5">Reportar avance</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <RegistrarTareaWizardContenido
            obra={obra}
            obraKey={obraKey}
            requerimientosRol={requerimientosRol}
            registrosPorId={registrosPorId}
            tareaInicial={tareaInicial}
            onGuardar={onGuardar}
            onSalir={onClose}
            onIrSiguiente={onIrSiguiente}
          />
        </div>
      </div>
    </div>
  );
}
