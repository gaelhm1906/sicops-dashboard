import React, { useState } from "react";
import Button from "../Shared/Button";
import { formatearFechaPura } from "../../utils/formatters";
import {
  getSolicitudes,
  agregarSolicitud,
  actualizarSolicitud,
  eliminarSolicitud,
  diasEnRevision,
  ESTATUS_AUTORIZACION,
} from "../../utils/preciosExtraordinarios";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

const ESTATUS_INFO = {
  [ESTATUS_AUTORIZACION.PENDIENTE]: { label: "Pendiente", color: "var(--naranja)" },
  [ESTATUS_AUTORIZACION.AUTORIZADO]: { label: "Autorizado", color: "var(--verde)" },
  [ESTATUS_AUTORIZACION.RECHAZADO]: { label: "Rechazado", color: "var(--rojo)" },
};

function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(valor || 0);
}

/* REQ-14 — Revisión de precios extraordinarios: fecha de ingreso,
   descripción, cantidad, monto, estatus de autorización (con monto
   autorizado) y fecha de liberación. `diasEnRevision` se calcula siempre
   — es justo el dato que la minuta pide medir: cuántos ingresan y cuánto
   tardan en revisarse. */
export default function CapturaPreciosExtraordinarios({ obraKey, registro, onGuardar, onCancelar }) {
  const [solicitudes, setSolicitudes] = useState(() => getSolicitudes(obraKey));
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ descripcion: "", cantidad: "", monto: "" });
  const [expandedId, setExpandedId] = useState(null);

  const totalAcumulado = solicitudes.reduce((acc, s) => acc + (Number(s.monto) || 0), 0);

  const crear = () => {
    if (!nuevo.descripcion.trim() || !nuevo.monto) return;
    setSolicitudes(agregarSolicitud(obraKey, nuevo));
    setNuevo({ descripcion: "", cantidad: "", monto: "" });
    setMostrarNuevo(false);
  };

  const cambiarEstatus = (id, estatus) => setSolicitudes(actualizarSolicitud(obraKey, id, { estatus }));
  const actualizarCampo = (id, campo, valor) => setSolicitudes(actualizarSolicitud(obraKey, id, { [campo]: valor }));
  const quitar = (id) => { setSolicitudes(eliminarSolicitud(obraKey, id)); setExpandedId(null); };

  const guardar = () => {
    onGuardar({
      estatus: solicitudes.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: solicitudes.length > 0
        ? `${solicitudes.length} solicitud${solicitudes.length === 1 ? "" : "es"} registrada${solicitudes.length === 1 ? "" : "s"}`
        : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Total acumulado</p>
          <p className="text-lg font-black" style={{ color: "var(--guinda)" }}>{formatoMoneda(totalAcumulado)}</p>
        </div>
        <span className="text-xs font-semibold shrink-0" style={{ color: "var(--ink-faint)" }}>
          {solicitudes.length} solicitud{solicitudes.length === 1 ? "" : "es"}
        </span>
      </div>

      {solicitudes.length === 0 && !mostrarNuevo && (
        <p className="text-xs text-center py-4" style={{ color: "var(--ink-faint)" }}>Aún no hay solicitudes de precio extraordinario registradas.</p>
      )}

      {solicitudes.map((s) => {
        const info = ESTATUS_INFO[s.estatus];
        const dias = diasEnRevision(s);
        const expandido = expandedId === s.id;
        return (
          <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${info.color}` }}>
            <button
              type="button"
              onClick={() => setExpandedId(expandido ? null : s.id)}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{s.descripcion}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                  {formatearFechaPura(s.fechaIngreso)} · {formatoMoneda(s.monto)} · {dias} día{dias === 1 ? "" : "s"} en revisión
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: "var(--surface-2)", color: info.color }}>
                {info.label}
              </span>
            </button>
            {expandido && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-2.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <div className="flex gap-2">
                  {Object.values(ESTATUS_AUTORIZACION).map((estatus) => (
                    <button
                      key={estatus}
                      type="button"
                      onClick={() => cambiarEstatus(s.id, estatus)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={s.estatus === estatus
                        ? { backgroundColor: ESTATUS_INFO[estatus].color, color: "#fff" }
                        : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
                    >
                      {ESTATUS_INFO[estatus].label}
                    </button>
                  ))}
                </div>
                {s.estatus === ESTATUS_AUTORIZACION.AUTORIZADO && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Monto autorizado</label>
                      <input
                        type="number"
                        value={s.montoAutorizado ?? ""}
                        onChange={(e) => actualizarCampo(s.id, "montoAutorizado", Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                        style={{ border: "1px solid var(--border)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Fecha de autorización</label>
                      <input
                        type="date"
                        value={s.fechaAutorizacion || ""}
                        onChange={(e) => actualizarCampo(s.id, "fechaAutorizacion", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                        style={{ border: "1px solid var(--border)" }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Cantidad: {s.cantidad || "—"}</span>
                  <button type="button" onClick={() => quitar(s.id)} className="text-[11px] font-bold" style={{ color: "var(--rojo)" }}>Eliminar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {mostrarNuevo ? (
        <div className="rounded-xl px-3.5 py-3 space-y-2.5" style={{ border: "1px solid var(--border)" }}>
          <input
            autoFocus
            value={nuevo.descripcion}
            onChange={(e) => setNuevo((d) => ({ ...d, descripcion: e.target.value }))}
            placeholder="Descripción del precio extraordinario"
            className="w-full px-3 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={nuevo.cantidad}
              onChange={(e) => setNuevo((d) => ({ ...d, cantidad: e.target.value }))}
              placeholder="Cantidad"
              className="w-full px-3 py-2 text-sm rounded-xl"
              style={{ border: "1px solid var(--border)" }}
            />
            <input
              type="number"
              value={nuevo.monto}
              onChange={(e) => setNuevo((d) => ({ ...d, monto: e.target.value }))}
              placeholder="Monto"
              className="w-full px-3 py-2 text-sm rounded-xl"
              style={{ border: "1px solid var(--border)" }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMostrarNuevo(false)}>Cancelar</Button>
            <Button size="sm" onClick={crear}>Agregar solicitud</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNuevo(true)}
          className="w-full py-2.5 rounded-xl text-sm font-bold"
          style={{ border: "1.5px dashed var(--border)", color: "var(--ink-faint)" }}
        >
          + Nueva solicitud
        </button>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={solicitudes.length === 0}>Guardar</Button>
      </div>
    </div>
  );
}
