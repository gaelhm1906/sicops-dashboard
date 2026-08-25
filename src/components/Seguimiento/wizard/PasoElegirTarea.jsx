import React from "react";
import { getEstatusInfo } from "../estatusBadge";
import { SEMAFORO_MANUAL_INFO } from "../../../utils/semaforoManual";

/**
 * Paso 1 (cuando hay más de una tarea aplicable): elegir sobre cuál
 * requerimiento se va a reportar. Tocar una fila avanza de inmediato al
 * siguiente paso — no hace falta un botón "Continuar" aparte.
 */
export default function PasoElegirTarea({ requerimientos, registrosPorId, onElegir }) {
  const filas = requerimientos
    .map((req) => ({ req, registro: registrosPorId[req.id] }))
    .filter(({ registro }) => registro && registro.estatus !== "no_aplica")
    .sort((a, b) => {
      const orden = { atrasado: 0, pendiente: 1, cumplido: 2 };
      return (orden[a.registro.estatus] ?? 3) - (orden[b.registro.estatus] ?? 3);
    });

  if (filas.length === 0) {
    return (
      <div className="bg-blueprint card text-center py-10 text-sm" style={{ color: "var(--ink-faint)" }}>
        No hay requerimientos disponibles para reportar en esta obra.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filas.map(({ req, registro }) => {
        const estatusInfo = getEstatusInfo(registro.estatus);
        const semaforoInfo = registro.semaforo ? SEMAFORO_MANUAL_INFO[registro.semaforo] : null;
        return (
          <button
            key={req.id}
            type="button"
            onClick={() => onElegir(req)}
            className="task-row card group w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
            style={{ borderLeftColor: estatusInfo.color }}
          >
            {semaforoInfo && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: semaforoInfo.color }}
                title={semaforoInfo.label}
                aria-label={semaforoInfo.label}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{req.nombre}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{req.categoria} · {req.periodicidad}</p>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ backgroundColor: estatusInfo.bg, color: estatusInfo.color }}
            >
              {estatusInfo.label}
            </span>
            <svg
              className="shrink-0 transition-transform duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
