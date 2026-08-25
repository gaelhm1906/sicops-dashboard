import React, { useState } from "react";
import Button from "../Shared/Button";
import { getEstudio, guardarEstudio, ETAPA_ESTUDIO, ETAPA_INFO, NOMBRE_ESTUDIO, DOCUMENTOS_ESTUDIO } from "../../utils/estudioAutorizacion";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* REQ-04 / REQ-05 — Autorización de estudio ambiental o de impacto
   urbano: mismo manejo por etapas para los dos, un componente los sirve
   a ambos y se etiqueta según el requerimiento activo. */
export default function CapturaEstudioAutorizacion({ obraKey, registro, onGuardar, onCancelar }) {
  const nombre = NOMBRE_ESTUDIO[registro.reqId] || "Estudio";
  const [estudio, setEstudio] = useState(() => getEstudio(obraKey, registro.reqId));
  const [notasErr, setNotasErr] = useState(false);

  const cambiarEtapa = (etapa) => {
    const next = { ...estudio, etapa, fechaActualizacion: new Date().toISOString().slice(0, 10) };
    setEstudio(next);
    guardarEstudio(obraKey, registro.reqId, next);
  };

  const cambiarNotas = (notas) => {
    setEstudio((prev) => ({ ...prev, notas }));
    if (notas.trim()) setNotasErr(false);
  };

  const cargarDocumento = (tipo, file) => {
    if (!file) return;
    const next = { ...estudio, documentos: { ...estudio.documentos, [tipo]: file.name } };
    setEstudio(next);
    guardarEstudio(obraKey, registro.reqId, next);
  };

  /* Ajuste de minuta: no se puede guardar "En proceso" sin describir la
     etapa correspondiente. */
  const guardar = () => {
    if (estudio.etapa === ETAPA_ESTUDIO.EN_PROCESO && !estudio.notas.trim()) {
      setNotasErr(true);
      return;
    }
    guardarEstudio(obraKey, registro.reqId, estudio);
    onGuardar({
      estatus: estudio.etapa === ETAPA_ESTUDIO.CONCLUIDO ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: estudio.etapa === ETAPA_ESTUDIO.CONCLUIDO ? new Date().toISOString().slice(0, 10) : registro.fechaReal,
      evidenciaNombre: estudio.documentos.acuse || `Etapa: ${ETAPA_INFO[estudio.etapa].label}`,
      motivo: estudio.notas,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>{nombre}</p>
        {estudio.fechaActualizacion && (
          <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>Última actualización: {estudio.fechaActualizacion}</p>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Etapa actual</p>
        <div className="flex flex-col gap-2">
          {Object.values(ETAPA_ESTUDIO).map((etapa) => {
            const info = ETAPA_INFO[etapa];
            const activo = estudio.etapa === etapa;
            return (
              <button
                key={etapa}
                type="button"
                onClick={() => cambiarEtapa(etapa)}
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

      {estudio.etapa !== ETAPA_ESTUDIO.SIN_INICIAR && (
        <div className="rounded-xl px-3.5 py-3 space-y-2.5" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Documentos (PDF)</p>
          {Object.entries(DOCUMENTOS_ESTUDIO).map(([tipo, label]) => (
            <div key={tipo} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{label}</p>
                <p className="text-[11px] truncate" style={{ color: estudio.documentos[tipo] ? "var(--verde)" : "var(--ink-faint)" }}>
                  {estudio.documentos[tipo] ? `📎 ${estudio.documentos[tipo]}` : "Sin cargar"}
                </p>
              </div>
              <label className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
                {estudio.documentos[tipo] ? "Reemplazar" : "Cargar"}
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => cargarDocumento(tipo, e.target.files?.[0] || null)} />
              </label>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>
          Notas{" "}
          {estudio.etapa === ETAPA_ESTUDIO.EN_PROCESO ? (
            <span style={{ color: "var(--rojo)" }}>*</span>
          ) : (
            <span className="font-normal normal-case" style={{ color: "var(--ink-faint)" }}>(opcional)</span>
          )}
        </label>
        <textarea
          value={estudio.notas}
          onChange={(e) => cambiarNotas(e.target.value)}
          rows={3}
          placeholder={estudio.etapa === ETAPA_ESTUDIO.EN_PROCESO ? "Describe en qué etapa va el trámite..." : "Contexto adicional sobre el trámite..."}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
          style={{ border: `1px solid ${notasErr ? "var(--rojo)" : "var(--border)"}` }}
        />
        {notasErr && (
          <p className="text-xs font-semibold mt-1" style={{ color: "var(--rojo)" }}>
            Describe la etapa antes de guardar "En proceso".
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
