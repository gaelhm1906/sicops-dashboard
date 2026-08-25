import React, { useMemo, useState } from "react";
import { formatearFechaPura } from "../../utils/formatters";
import { diasHastaFecha } from "../../utils/seguimiento";
import { ROLES_RESPONSABLE } from "../../data/seguimientoCatalogo";
import { ESTADO_EVALUACION, ESTADO_EVALUACION_INFO, guardarEvaluacion, getHistorial } from "../../utils/evaluaciones";
import { registrarIndicacionSecretario } from "../../utils/concertacion";

/* REQ-17 (Informe de concertación) es una bitácora de ida y vuelta — la
   observación del secretario no solo se guarda como evaluación genérica,
   también se engancha a esa misma bitácora como una "indicación directa",
   visible para Subdirección de Concertación cuando vuelva a capturar. */
const REQ_CON_BITACORA = new Set(["REQ-17"]);

const OPCIONES_ESTADO = [
  ESTADO_EVALUACION.NO_ATENDIDO,
  ESTADO_EVALUACION.ATENDIDO_PARCIAL,
  ESTADO_EVALUACION.ATENDIDO,
];

/**
 * Panel de evaluación del secretario — "Entrar a un espacio" (mismo
 * patrón de panel lateral que la Bandeja de obra): el secretario deja un
 * veredicto + observación sobre un requerimiento específico de una obra.
 * Esa observación es lo que "se notifica" al responsable — hoy solo se
 * guarda y se marca como notificada; el canal real (correo/push) se
 * conecta después.
 */
export default function EvaluacionPanel({
  obra,
  obraKey,
  requerimiento,
  registro,
  cumplida,
  evaluacionActual,
  evaluadoPor,
  onGuardar,
  onClose,
  onVerBandeja,
}) {
  const [estado, setEstado] = useState(
    evaluacionActual?.estado || (cumplida ? ESTADO_EVALUACION.ATENDIDO : ESTADO_EVALUACION.NO_ATENDIDO)
  );
  const [observacion, setObservacion] = useState(evaluacionActual?.observacion || "");
  const [guardando, setGuardando] = useState(false);

  /* `responsableLabel` del requerimiento (si existe) va antes que
     `responsables[0]` — dos códigos que son "el mismo puesto con dos
     nombres según la Dirección" (ajuste de reunión con el Secretario, 12
     de agosto) deben mostrarse como un solo actor, no como si el primero
     de la lista fuera el único responsable real. */
  const responsableLabel = registro?.actualizadoPor || requerimiento.responsableLabel || ROLES_RESPONSABLE[requerimiento.responsables?.[0]] || "Sin asignar";
  const dias = diasHastaFecha(registro?.fechaCompromiso);
  const vencido = dias !== null && dias < 0;

  /* Ajuste de reunión con el Secretario (12 de agosto, sesión DGCOP,
     propuesta de Rey): el hilo completo de observaciones sobre este
     requerimiento, no solo la más reciente — antes cada evaluación
     nueva pisaba la anterior sin dejar rastro. */
  const historial = useMemo(() => getHistorial(obraKey, requerimiento.id), [obraKey, requerimiento.id]);

  const dgObra = obra?.dg || obra?.direccion_general || null;

  const handleGuardar = async () => {
    if (!observacion.trim()) return;
    setGuardando(true);
    const evaluacion = guardarEvaluacion(obraKey, requerimiento.id, {
      estado,
      observacion: observacion.trim(),
      evaluadoPor,
      dg: dgObra,
      obraNombre: obra.nombre_obra || obra.nombre,
    });
    if (REQ_CON_BITACORA.has(requerimiento.id)) {
      registrarIndicacionSecretario(obraKey, observacion.trim(), evaluadoPor);
    }
    setGuardando(false);
    onGuardar?.(evaluacion);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/20 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Evaluar ${requerimiento.nombre} — ${obra.nombre_obra || obra.nombre}`}
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-panel-in"
        style={{ height: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0" style={{ backgroundColor: "#691C32" }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>
              Panel de evaluación
            </p>
            <p className="text-white font-bold text-sm mt-0.5 truncate">{obra.nombre_obra || obra.nombre}</p>
            <p className="text-white/70 text-xs mt-0.5 truncate">{requerimiento.nombre}</p>
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

        {/* Cuerpo scrollable */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {/* Responsable + fecha límite */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
              Responsable: {responsableLabel}
            </span>
            {registro?.fechaCompromiso && (
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: vencido ? "rgba(220,38,38,0.10)" : "var(--surface-2)",
                  color: vencido ? "var(--rojo)" : "var(--ink-soft)",
                  border: `1px solid ${vencido ? "rgba(220,38,38,0.25)" : "var(--border)"}`,
                }}
              >
                Límite: {formatearFechaPura(registro.fechaCompromiso)}{vencido ? " (Vencido)" : ""}
              </span>
            )}
          </div>

          {evaluacionActual?.notificado && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs flex items-start gap-2" style={{ backgroundColor: "rgba(0,99,65,0.08)", color: "var(--verde)", border: "1px solid rgba(0,99,65,0.2)" }}>
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Ya se notificó a este responsable el {formatearFechaPura(evaluacionActual.fecha)}. Puedes actualizar la evaluación.</span>
            </div>
          )}

          {/* Historial — hilo de observaciones previas sobre este
              requerimiento, más reciente primero. */}
          {historial.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>
                Historial ({historial.length})
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {historial.map((h, i) => {
                  const info = ESTADO_EVALUACION_INFO[h.estado];
                  return (
                    <div key={i} className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: info?.color }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
                          {info?.label}
                        </span>
                        <span className="text-[10.5px] shrink-0" style={{ color: "var(--ink-faint)" }}>{formatearFechaPura(h.fecha)}</span>
                      </div>
                      {h.observacion && <p className="text-xs" style={{ color: "var(--ink)" }}>{h.observacion}</p>}
                      <p className="text-[10.5px] mt-1" style={{ color: "var(--ink-faint)" }}>{h.evaluadoPor}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado de la revisión */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Estado de la revisión</p>
            <div className="flex flex-col gap-2">
              {OPCIONES_ESTADO.map((op) => {
                const info = ESTADO_EVALUACION_INFO[op];
                const activo = estado === op;
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setEstado(op)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                    style={{
                      backgroundColor: activo ? "var(--guinda)" : "var(--surface-2)",
                      color: activo ? "#fff" : "var(--ink-soft)",
                      border: `1.5px solid ${activo ? "var(--guinda)" : "var(--border)"}`,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activo ? "#fff" : info.color }} />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observación */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#8C6B41" }}>
              Observación técnica
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={4}
              placeholder="Describe lo que encontró la revisión..."
              className="w-full px-3.5 py-3 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
            />
          </div>

          <div className="rounded-xl px-3.5 py-3 text-xs flex items-start gap-2" style={{ backgroundColor: "rgba(217,119,6,0.08)", color: "#92400e", border: "1px solid rgba(217,119,6,0.22)" }}>
            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <span>
              Esta observación se enviará como notificación directa al responsable{dgObra ? ` y en copia al Director General de ${dgObra}` : ""}, y quedará registrada en el historial de "{requerimiento.nombre}".
            </span>
          </div>

          {onVerBandeja && (
            <button
              type="button"
              onClick={onVerBandeja}
              className="text-xs font-bold flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              style={{ color: "var(--guinda)" }}
            >
              Ver bandeja completa de la obra
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Pie fijo con la acción principal */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={!observacion.trim() || guardando}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "var(--guinda)" }}
          >
            {guardando ? "Guardando..." : "Guardar y notificar"}
          </button>
        </div>
      </div>
    </div>
  );
}
