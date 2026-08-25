import React from "react";
import { getEstatusInfo } from "../estatusBadge";
import { SEMAFORO_MANUAL, SEMAFORO_MANUAL_INFO } from "../../../utils/semaforoManual";

function Dato({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: "var(--ink)" }}>{value}</p>
    </div>
  );
}

/**
 * Paso de revisión: muestra exactamente lo que se va a guardar antes de
 * confirmarlo — nunca se persiste nada sin que el usuario lo vea primero.
 */
export default function PasoPrevisualizacion({ obra, requerimiento, cambios, guardando, semaforo, onCambiarSemaforo, onCorregir, onConfirmar }) {
  const estatusInfo = getEstatusInfo(cambios.estatus);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black" style={{ color: "var(--ink)" }}>Revisa antes de guardar</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-faint)" }}>Confirma que la información sea correcta.</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: estatusInfo.bg, color: estatusInfo.color }}
          >
            {estatusInfo.label}
          </span>
          <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{requerimiento.nombre}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Dato label="Obra" value={obra.nombre_obra || obra.nombre} />
          <Dato label="Fecha" value={cambios.fechaReal} />
          <Dato label="Evidencia" value={cambios.evidenciaNombre} />
          <Dato label="Comentario" value={cambios.motivo} />
        </div>
      </div>

      {/* Semáforo manual (ajuste de reunión con el Secretario, 12 de
          agosto): criterio propio de quien captura, aparte del cálculo
          automático — opcional, no bloquea el guardado. */}
      <div className="card p-5">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2.5" style={{ color: "var(--ink-faint)" }}>
          ¿Cómo va esta actividad? <span className="font-normal normal-case">(opcional)</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(SEMAFORO_MANUAL).map((op) => {
            const info = SEMAFORO_MANUAL_INFO[op];
            const activo = semaforo === op;
            return (
              <button
                key={op}
                type="button"
                onClick={() => onCambiarSemaforo(activo ? null : op)}
                className="text-xs font-bold px-2.5 py-2 rounded-xl transition-colors"
                style={activo
                  ? { backgroundColor: info.bg, color: info.color, border: `1.5px solid ${info.color}` }
                  : { backgroundColor: "var(--surface-2)", color: "var(--ink-faint)", border: "1.5px solid var(--border)" }}
              >
                {activo ? "✓ " : ""}{info.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCorregir}
          className="px-5 py-2.5 rounded-full text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
        >
          Corregir
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={guardando}
          className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-60"
          style={{ backgroundColor: "var(--guinda)" }}
        >
          {guardando ? "Guardando..." : "Confirmar y guardar"}
        </button>
      </div>
    </div>
  );
}
