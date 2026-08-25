import React from "react";

/**
 * Indicador de pasos — guía al usuario por un flujo lineal (elegir tarea →
 * captura → revisión → confirmación). Círculo verde con anillo = paso
 * activo; guinda con palomita = completado; blanco = pendiente. La línea
 * entre círculos se rellena con una transición real, no un salto.
 */
export default function Stepper({ steps, current }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const estado = i < current ? "completado" : i === current ? "activo" : "pendiente";
          return (
            <React.Fragment key={label}>
              <div
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-black border-2 transition-transform duration-200 ease-[var(--ease-out)]"
                style={
                  estado === "completado"
                    ? { backgroundColor: "var(--guinda)", borderColor: "var(--guinda)", color: "#fff" }
                    : estado === "activo"
                    ? { backgroundColor: "var(--verde)", borderColor: "var(--verde)", color: "#fff", boxShadow: "0 0 0 4px rgba(0,99,65,0.18)", transform: "scale(1.08)" }
                    : { backgroundColor: "#fff", borderColor: "var(--border)", color: "var(--ink-faint)" }
                }
                title={label}
              >
                {estado === "completado" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-[2px] mx-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-[var(--ease-in-out)]"
                    style={{ width: i < current ? "100%" : "0%", backgroundColor: "var(--guinda)" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {steps[current] && (
        <p className="text-sm font-black" style={{ color: "var(--ink)" }}>{steps[current]}</p>
      )}
    </div>
  );
}
