import React, { useState } from "react";
import Button from "../Shared/Button";
import Collapse from "../Shared/Collapse";
import Chevron from "../Shared/Chevron";
import {
  getExpediente,
  setEstatusDocumento,
  cargarDocumento,
  quitarDocumento,
  cambiarObservaciones as cambiarObservacionesExpediente,
  progresoExpediente,
  progresoSeccion,
  documentosPendientesDeCarga,
  CHECKLIST_HOMOLOGADO,
  ESTATUS_DOCUMENTO,
  ESTATUS_DOCUMENTO_INFO,
} from "../../utils/expedienteUnico";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* REQ-19 — Informe de avances de la integración del expediente único.
   Checklist homologado (minuta 2026-08-12): un solo formato documental
   para los tres procedimientos — ya no cambia según el tipo elegido, así
   que el checklist está disponible desde que se abre el expediente. El
   tipo de procedimiento se sigue capturando (dato del contrato), pero es
   independiente de qué documentos se piden. */

/* Ajuste de UX/UI (separar el estado del requisito de la acción de
   cargar): los cuatro estados se presentan como UN selector — mismo
   trato visual, mismo orden en todas las secciones — en vez de mezclar
   tres botones de estado con una cuarta que además era un disparador de
   archivo. "Sí" ya no abre el selector de archivo al elegirlo: solo
   marca el estado; la carga es una acción aparte que aparece debajo. */
const ESTADOS_BOTON = [ESTATUS_DOCUMENTO.SI, ESTATUS_DOCUMENTO.NO, ESTATUS_DOCUMENTO.EN_PROCESO, ESTATUS_DOCUMENTO.NO_APLICA];

function FilaDocumento({ obraKey, doc, valor, onCambio }) {
  const estatus = valor?.estatus || ESTATUS_DOCUMENTO.NO;
  const tieneArchivo = estatus === ESTATUS_DOCUMENTO.SI && !!valor?.archivoNombre;

  const marcar = (nuevoEstatus) => onCambio(setEstatusDocumento(obraKey, doc.id, nuevoEstatus));
  const cargar = (file) => {
    if (!file) return;
    onCambio(cargarDocumento(obraKey, doc.id, file.name));
  };
  const quitar = () => onCambio(quitarDocumento(obraKey, doc.id));

  return (
    <div className="px-3.5 py-2.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{doc.nombre}</p>
        {doc.area && (
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{doc.area}</p>
        )}
      </div>

      {/* Selector de estado — grid 2×2 en pantallas chicas, 1×4 en desktop,
          siempre en el mismo orden Sí/No/En proceso/No aplica. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
        {ESTADOS_BOTON.map((op) => {
          const activo = estatus === op;
          const info = ESTATUS_DOCUMENTO_INFO[op];
          return (
            <button
              key={op}
              type="button"
              onClick={() => marcar(op)}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: activo ? info.bg : "transparent",
                color: activo ? info.color : "var(--ink-faint)",
                border: `1px solid ${activo ? info.border : "var(--border)"}`,
              }}
            >
              {activo ? `✓ ${info.label}` : info.label}
            </button>
          );
        })}
      </div>

      {/* Bloque de carga — solo aparece con "Sí" seleccionado, sea cual
          sea el destino (subir por primera vez o mostrar lo ya subido). */}
      {estatus === ESTATUS_DOCUMENTO.SI && (
        <div className="mt-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-soft)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>Documento</p>

          {tieneArchivo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>📄 {valor.archivoNombre}</p>
                <p className="text-[10.5px] mt-0.5" style={{ color: "var(--verde)" }}>✓ Documento cargado</p>
              </div>
              <label className="text-[10.5px] font-bold px-2 py-1 rounded-lg cursor-pointer shrink-0" style={{ backgroundColor: "var(--surface)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
                Reemplazar
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => cargar(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={quitar} className="text-[10.5px] font-bold shrink-0" style={{ color: "var(--rojo)" }}>Quitar</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg shrink-0" style={{ backgroundColor: "var(--surface)", color: "var(--guinda)", border: "1px dashed var(--guinda)" }}>
                📎 Cargar documento
              </span>
              <span className="text-[10.5px]" style={{ color: "var(--ink-faint)" }}>PDF, JPG, PNG u otros formatos permitidos.</span>
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => cargar(e.target.files?.[0])} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function SeccionChecklist({ obraKey, seccion, expediente, onCambio, abierta, onToggle }) {
  const progreso = progresoSeccion(expediente, seccion.seccion);
  const completa = progreso.total > 0 && progreso.hechos === progreso.total;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-3.5 py-3 text-left" style={{ backgroundColor: "var(--surface-2)" }}>
        <Chevron open={abierta} color="var(--ink-faint)" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Sección {seccion.seccion}</p>
          <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{seccion.titulo}</p>
        </div>
        <span
          className="text-[11px] font-black px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: completa ? "rgba(0,99,65,0.1)" : "var(--surface)", color: completa ? "var(--verde)" : "var(--ink-faint)", border: "1px solid var(--border)" }}
        >
          {progreso.hechos}/{progreso.total}
        </span>
      </button>
      <Collapse open={abierta}>
        <div>
          {seccion.documentos.map((doc) => (
            <FilaDocumento key={doc.id} obraKey={obraKey} doc={doc} valor={expediente.checklist[doc.id]} onCambio={onCambio} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}

export default function CapturaExpedienteUnico({ obraKey, registro, onGuardar, onCancelar }) {
  const [expediente, setExpediente] = useState(() => getExpediente(obraKey));
  const [seccionesAbiertas, setSeccionesAbiertas] = useState(() => new Set());
  /* Bloquea el guardado si queda algún "Sí" sin archivo (pedido
     explícito: no basta con que el % no lo cuente, hay que rechazar el
     guardado). Se recalcula en cada render, así que la advertencia
     desaparece sola en cuanto se sube el comprobante o se cambia el
     estado — no hace falta limpiarla a mano. */
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const progreso = progresoExpediente(expediente);
  const pendientesCarga = documentosPendientesDeCarga(expediente);

  const cambiarObservaciones = (observaciones) => {
    setExpediente((prev) => ({ ...prev, observaciones }));
    cambiarObservacionesExpediente(obraKey, observaciones);
  };

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas((prev) => {
      const next = new Set(prev);
      next.has(seccion) ? next.delete(seccion) : next.add(seccion);
      return next;
    });
  };

  const guardar = () => {
    if (pendientesCarga.length > 0) {
      setIntentoGuardar(true);
      return;
    }
    onGuardar({
      estatus: progreso.total > 0 && progreso.hechos === progreso.total ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: progreso.hechos === progreso.total && progreso.total > 0 ? new Date().toISOString().slice(0, 10) : registro.fechaReal,
      evidenciaNombre: `${progreso.hechos} de ${progreso.total} documentos aplicables${progreso.noAplica ? ` (${progreso.noAplica} no aplica)` : ""}`,
      motivo: expediente.observaciones,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Checklist documental</p>
          <span className="text-xs font-black" style={{ color: "var(--guinda)" }}>
            {progreso.hechos} de {progreso.total} · {progreso.pct}%
            {progreso.noAplica > 0 && <span className="font-normal" style={{ color: "var(--ink-faint)" }}> ({progreso.noAplica} no aplica)</span>}
          </span>
        </div>
        <div className="space-y-2">
          {CHECKLIST_HOMOLOGADO.map((seccion) => (
            <SeccionChecklist
              key={seccion.seccion}
              obraKey={obraKey}
              seccion={seccion}
              expediente={expediente}
              onCambio={setExpediente}
              abierta={seccionesAbiertas.has(seccion.seccion)}
              onToggle={() => toggleSeccion(seccion.seccion)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>
          Observaciones <span className="font-normal normal-case" style={{ color: "var(--ink-faint)" }}>(opcional)</span>
        </label>
        <textarea
          value={expediente.observaciones}
          onChange={(e) => cambiarObservaciones(e.target.value)}
          rows={3}
          placeholder="Contexto adicional sobre el expediente..."
          className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
          style={{ border: "1px solid var(--border)" }}
        />
      </div>

      {intentoGuardar && pendientesCarga.length > 0 && (
        <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <p className="text-xs font-bold" style={{ color: "var(--rojo)" }}>
            No se puede guardar: {pendientesCarga.length} documento{pendientesCarga.length === 1 ? "" : "s"} marcado{pendientesCarga.length === 1 ? "" : "s"} "Sí" sin archivo cargado.
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
            Sube el comprobante o cambia el estado de: {pendientesCarga.slice(0, 5).map((d) => d.nombre).join(", ")}
            {pendientesCarga.length > 5 ? ` y ${pendientesCarga.length - 5} más` : ""}.
          </p>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
