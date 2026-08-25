import React, { useState } from "react";
import Button from "../Shared/Button";
import { formatearFechaPura } from "../../utils/formatters";
import { getCambios, agregarCambio, eliminarCambio, ESPECIALIDADES_PROYECTO } from "../../utils/cambiosProyecto";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

const LABEL_ESPECIALIDAD = Object.fromEntries(ESPECIALIDADES_PROYECTO.map((e) => [e.id, e.label]));

/* REQ-03 — Informe sobre cambios de proyecto: primero sí/no hubo cambios
   esta semana; si los hay, cada uno se registra con descripción y
   categorización por especialidad. */
export default function CapturaCambiosProyecto({ obraKey, registro, onGuardar, onCancelar }) {
  const [huboCambios, setHuboCambios] = useState(null);
  const [cambios, setCambios] = useState(() => getCambios(obraKey));
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ especialidadId: ESPECIALIDADES_PROYECTO[0].id, descripcion: "" });

  const crear = () => {
    if (!nuevo.descripcion.trim()) return;
    setCambios(agregarCambio(obraKey, nuevo));
    setNuevo({ especialidadId: ESPECIALIDADES_PROYECTO[0].id, descripcion: "" });
    setMostrarNuevo(false);
  };

  const quitar = (id) => setCambios(eliminarCambio(obraKey, id));

  const respuesta = huboCambios !== null ? huboCambios : cambios.length > 0;

  const guardar = () => {
    onGuardar({
      estatus: ESTATUS_REGISTRO.CUMPLIDO,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: respuesta ? `${cambios.length} cambio${cambios.length === 1 ? "" : "s"} reportado${cambios.length === 1 ? "" : "s"}` : "Sin cambios reportados",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>¿Hubo cambios de proyecto esta semana?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHuboCambios(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={!respuesta ? { backgroundColor: "var(--verde)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => setHuboCambios(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={respuesta ? { backgroundColor: "var(--guinda)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            Sí
          </button>
        </div>
      </div>

      {respuesta && (
        <div className="space-y-2">
          {cambios.map((c) => (
            <div key={c.id} className="rounded-xl px-3.5 py-2.5" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)" }}>
                    {LABEL_ESPECIALIDAD[c.especialidadId] || c.especialidadId}
                  </span>
                  <p className="text-sm mt-1.5" style={{ color: "var(--ink)" }}>{c.descripcion}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>{formatearFechaPura(c.fecha)}</p>
                </div>
                <button type="button" onClick={() => quitar(c.id)} className="shrink-0 text-[11px] font-bold" style={{ color: "var(--rojo)" }}>Eliminar</button>
              </div>
            </div>
          ))}

          {mostrarNuevo ? (
            <div className="rounded-xl px-3.5 py-3 space-y-2.5" style={{ border: "1px solid var(--border)" }}>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Especialidad</label>
                <select
                  value={nuevo.especialidadId}
                  onChange={(e) => setNuevo((d) => ({ ...d, especialidadId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-white"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {ESPECIALIDADES_PROYECTO.map((esp) => <option key={esp.id} value={esp.id}>{esp.label}</option>)}
                </select>
              </div>
              <textarea
                autoFocus
                value={nuevo.descripcion}
                onChange={(e) => setNuevo((d) => ({ ...d, descripcion: e.target.value }))}
                rows={3}
                placeholder="Describe el cambio de proyecto..."
                className="w-full px-3 py-2 text-sm rounded-xl resize-none"
                style={{ border: "1px solid var(--border)" }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setMostrarNuevo(false)}>Cancelar</Button>
                <Button size="sm" onClick={crear}>Agregar cambio</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarNuevo(true)}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ border: "1.5px dashed var(--border)", color: "var(--ink-faint)" }}
            >
              + Registrar cambio
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={respuesta && cambios.length === 0}>Guardar</Button>
      </div>
    </div>
  );
}
