import React, { useState } from "react";
import Button from "../Shared/Button";
import { getProyectoEjecutivo, actualizarEspecialidad, actualizarPlano, resumenProyecto, ESPECIALIDADES_PROYECTO } from "../../utils/proyectoEjecutivo";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";
import PanelVerificacion from "./PanelVerificacion";

function FilaArchivo({ label, archivo, onSeleccionar }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{label}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: archivo ? "var(--verde)" : "var(--ink-faint)" }}>
          {archivo ? `📎 ${archivo}` : "Sin cargar"}
        </p>
      </div>
      <label className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
        {archivo ? "Reemplazar" : "Cargar"}
        <input type="file" className="hidden" onChange={(e) => onSeleccionar(e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

/* REQ-02 — Entrega de proyecto ejecutivo: checklist por especialidad más
   dos documentos de consulta rápida (planta de conjunto y plantas
   individuales), pedidos como mínimo indispensable en la minuta. */
export default function CapturaProyectoEjecutivo({ obraKey, registro, onGuardar, onCancelar }) {
  const [estado, setEstado] = useState(() => getProyectoEjecutivo(obraKey));

  const resumen = resumenProyecto(estado);

  const toggleEspecialidad = (id, entregado) => setEstado(actualizarEspecialidad(obraKey, id, { entregado }));
  const archivoEspecialidad = (id, file) => setEstado(actualizarEspecialidad(obraKey, id, { archivo: file ? file.name : null }));
  const setPlano = (campo, file) => setEstado(actualizarPlano(obraKey, campo, file ? file.name : null));

  const guardar = () => {
    onGuardar({
      estatus: resumen.entregadas === resumen.total ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: resumen.entregadas === resumen.total ? new Date().toISOString().slice(0, 10) : registro.fechaReal,
      evidenciaNombre: `${resumen.entregadas} de ${resumen.total} especialidades entregadas`,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Desglose por especialidad</p>
        <div className="space-y-2">
          {ESPECIALIDADES_PROYECTO.map((esp) => {
            const dato = estado.especialidades[esp.id];
            return (
              <div key={esp.id} className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${dato.entregado ? "var(--verde)" : "var(--border)"}` }}>
                <button
                  type="button"
                  onClick={() => toggleEspecialidad(esp.id, !dato.entregado)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.99]"
                  style={{ backgroundColor: dato.entregado ? "rgba(0,99,65,0.06)" : "var(--surface)" }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: dato.entregado ? "var(--verde)" : "var(--surface-2)", border: dato.entregado ? "none" : "1px solid var(--border)" }}
                  >
                    {dato.entregado && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </div>
                  <span className="text-sm font-semibold flex-1" style={{ color: "var(--ink)" }}>{esp.label}</span>
                  <span className="text-[11px] font-semibold" style={{ color: dato.entregado ? "var(--verde)" : "var(--ink-faint)" }}>
                    {dato.entregado ? "Entregado" : "Pendiente"}
                  </span>
                </button>
                <div className="px-3.5 pb-2.5 pt-1 flex items-center gap-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <label className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-soft)" }}>
                    {dato.archivo ? "Reemplazar archivo" : "Adjuntar archivo"}
                    <input type="file" className="hidden" onChange={(e) => archivoEspecialidad(esp.id, e.target.files?.[0] || null)} />
                  </label>
                  {dato.archivo && <span className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>📎 {dato.archivo}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Consulta rápida — mínimo indispensable</p>
        <div className="space-y-2">
          <FilaArchivo label="Planta de conjunto" archivo={estado.plantaConjunto} onSeleccionar={(f) => setPlano("plantaConjunto", f)} />
          <FilaArchivo label="Plantas individuales" archivo={estado.plantasIndividuales} onSeleccionar={(f) => setPlano("plantasIndividuales", f)} />
        </div>
      </div>

      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>Avance de entrega</p>
          <p className="text-xs font-bold" style={{ color: "var(--guinda)" }}>{resumen.entregadas} de {resumen.total} especialidades</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
          <div className="h-full rounded-full" style={{ width: `${resumen.total > 0 ? (resumen.entregadas / resumen.total) * 100 : 0}%`, backgroundColor: "var(--guinda)" }} />
        </div>
      </div>

      <PanelVerificacion obraKey={obraKey} reqId={registro.reqId} />

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
