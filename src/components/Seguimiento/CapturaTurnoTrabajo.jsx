import React, { useEffect, useState } from "react";
import Button from "../Shared/Button";
import { useAuth } from "../../context/AuthContext";
import { formatearHora } from "../../utils/formatters";
import { getTurnosHoy, registrarTurno, TURNO, TURNO_INFO, hidratarTurnosDesdeServidor } from "../../utils/turnosTrabajo";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* REQ-10 — Turnos de trabajo. Ajuste de minuta (revisión de programa de
   obra): tres turnos de ocho horas que cubren el día completo (se
   incorpora el diurno que faltaba); se eliminan las validaciones de
   geolocalización y de ventana horaria — basta con que el Director de
   Obra cargue el reporte de cumplimiento de horarios de la empresa. */
export default function CapturaTurnoTrabajo({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const { user } = useAuth();
  const [turnos, setTurnos] = useState(() => getTurnosHoy(obraKey));
  const [turnoElegido, setTurnoElegido] = useState(TURNO.MATUTINO);
  const [reporteNombre, setReporteNombre] = useState(null);

  // Sesión PS real: trae los turnos de hoy ya registrados en el servidor.
  useEffect(() => {
    let cancelado = false;
    hidratarTurnosDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) setTurnos(getTurnosHoy(obraKey));
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  const guardar = () => {
    const next = registrarTurno(obraKey, { turno: turnoElegido, usuario: user?.email, reporteNombre }, obra?.id);
    setTurnos(next);
    onGuardar({
      estatus: ESTATUS_REGISTRO.CUMPLIDO,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: reporteNombre || `Turno ${TURNO_INFO[turnoElegido].label} registrado`,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Turno</p>
        <div className="flex flex-col gap-2">
          {Object.values(TURNO).map((t) => {
            const info = TURNO_INFO[t];
            const activo = turnoElegido === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTurnoElegido(t)}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
                style={{
                  backgroundColor: activo ? "var(--guinda)" : "var(--surface-2)",
                  color: activo ? "#fff" : "var(--ink-soft)",
                  border: `1.5px solid ${activo ? "var(--guinda)" : "var(--border)"}`,
                }}
              >
                <span className="text-sm font-semibold">{info.label}</span>
                <span className="text-[11px]" style={{ opacity: 0.75 }}>{info.rango}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid var(--border)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Reporte de cumplimiento de horarios</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: reporteNombre ? "var(--verde)" : "var(--ink-faint)" }}>
            {reporteNombre ? `📎 ${reporteNombre}` : "Cargado por la empresa — opcional"}
          </p>
        </div>
        <label className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
          {reporteNombre ? "Reemplazar" : "Cargar"}
          <input type="file" className="hidden" onChange={(e) => setReporteNombre(e.target.files?.[0]?.name || reporteNombre)} />
        </label>
      </div>

      {turnos.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Registrados hoy</p>
          <div className="space-y-1.5">
            {turnos.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{TURNO_INFO[t.turno].label}</span>
                <span className="text-[11px] font-mono" style={{ color: "var(--ink-faint)" }}>{formatearHora(t.hora)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Registrar turno</Button>
      </div>
    </div>
  );
}
