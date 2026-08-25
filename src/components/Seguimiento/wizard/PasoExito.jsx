import React from "react";

/**
 * Paso final: confirmación de éxito con la mascota. Cierra el ciclo que
 * abrió "Elegir tarea" — el usuario sabe que su reporte quedó guardado
 * sin tener que adivinarlo.
 */
export default function PasoExito({ requerimiento, onRegistrarOtra, onCerrar, hayMasTareas, labelRegistrarOtra = "Registrar otra tarea" }) {
  return (
    <div className="flex flex-col items-center text-center py-8 space-y-5">
      <div className="relative animate-fade-in">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: "#fff", border: "3px solid var(--oro-light)" }}
        >
          <img
            src="/web/assets/img/saludo.png"
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--verde)", border: "3px solid #fff" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-black" style={{ color: "var(--ink)" }}>Guardado con éxito</h2>
        <p className="text-sm mt-1" style={{ color: "var(--ink-faint)" }}>
          "{requerimiento.nombre}" quedó actualizado.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
        {hayMasTareas && (
          <button
            type="button"
            onClick={onRegistrarOtra}
            className="flex-1 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
            style={{ backgroundColor: "var(--guinda)" }}
          >
            {labelRegistrarOtra}
          </button>
        )}
        <button
          type="button"
          onClick={onCerrar}
          className="flex-1 px-5 py-2.5 rounded-full text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
