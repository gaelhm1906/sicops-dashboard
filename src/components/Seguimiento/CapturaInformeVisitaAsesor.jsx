import React, { useState } from "react";
import Button from "../Shared/Button";
import { getInforme, guardarInforme } from "../../utils/informeVisitaAsesor";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* REQ-18 — Informe de visitas de obra (Asesores Estructuristas). Distinto
   del módulo de Visitas (cuota diaria de check-ins por rol): este es un
   requerimiento normal más, semanal — sí/no de si la visita se realizó,
   más un reporte general adjunto. */
export default function CapturaInformeVisitaAsesor({ obraKey, registro, onGuardar, onCancelar }) {
  const [estado, setEstado] = useState(() => getInforme(obraKey));

  const elegir = (visitaRealizada) => setEstado((prev) => ({ ...prev, visitaRealizada }));
  const cambiarReporte = (reporteGeneral) => setEstado((prev) => ({ ...prev, reporteGeneral }));
  const cargarArchivo = (file) => setEstado((prev) => ({ ...prev, archivoNombre: file ? file.name : prev.archivoNombre }));

  const puedeGuardar = estado.visitaRealizada !== null && (estado.visitaRealizada === false || estado.reporteGeneral.trim().length > 0);

  const guardar = () => {
    const datos = { ...estado, fecha: new Date().toISOString().slice(0, 10) };
    guardarInforme(obraKey, datos);
    onGuardar({
      estatus: estado.visitaRealizada ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.ATRASADO,
      fechaReal: estado.visitaRealizada ? datos.fecha : registro.fechaReal,
      evidenciaNombre: estado.visitaRealizada ? (estado.archivoNombre || "Reporte general capturado") : "Visita no realizada esta semana",
      motivo: estado.reporteGeneral,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>¿Se realizó la visita esta semana?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => elegir(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={estado.visitaRealizada === false ? { backgroundColor: "var(--rojo)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => elegir(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={estado.visitaRealizada === true ? { backgroundColor: "var(--verde)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            Sí
          </button>
        </div>
      </div>

      {estado.visitaRealizada === true && (
        <>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>
              Reporte general <span style={{ color: "var(--rojo)" }}>*</span>
            </label>
            <textarea
              autoFocus
              value={estado.reporteGeneral}
              onChange={(e) => cambiarReporte(e.target.value)}
              rows={4}
              placeholder="Describe lo observado durante la visita estructural..."
              className="w-full px-3.5 py-3 text-sm rounded-xl resize-none"
              style={{ border: "1px solid var(--border)" }}
            />
          </div>
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid var(--border)" }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Reporte adjunto</p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: estado.archivoNombre ? "var(--verde)" : "var(--ink-faint)" }}>
                {estado.archivoNombre ? `📎 ${estado.archivoNombre}` : "Opcional"}
              </p>
            </div>
            <label className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
              {estado.archivoNombre ? "Reemplazar" : "Cargar"}
              <input type="file" className="hidden" onChange={(e) => cargarArchivo(e.target.files?.[0] || null)} />
            </label>
          </div>
        </>
      )}

      {estado.visitaRealizada === false && (
        <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>
            Motivo <span className="font-normal normal-case" style={{ color: "var(--ink-faint)" }}>(opcional)</span>
          </label>
          <textarea
            value={estado.reporteGeneral}
            onChange={(e) => cambiarReporte(e.target.value)}
            rows={2}
            placeholder="¿Por qué no se realizó la visita esta semana?"
            className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
          />
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={!puedeGuardar}>Guardar</Button>
      </div>
    </div>
  );
}
