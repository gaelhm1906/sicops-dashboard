import React, { useEffect, useState } from "react";
import Button from "../Shared/Button";
import {
  getCatalogo,
  guardarCatalogo,
  montoTotal,
  montoModificadoTotal,
  getPartidas,
  agregarPartida,
  eliminarPartida,
  hidratarCatalogoConceptosDesdeServidor,
} from "../../utils/catalogoConceptos";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";
import PanelVerificacion from "./PanelVerificacion";

function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(valor || 0);
}

/* REQ-13 — Elaboración de catálogo de conceptos: desglosado por partida
   (monto inicial y monto modificado) más el PDF del catálogo completo, y
   estatus de modificaciones sí/no y en qué partida(s).
   Ajuste de minuta (sesión de revisión #10): las partidas ya no son un
   catálogo fijo — cada área registra las propias de su catálogo. */
export default function CapturaCatalogoConceptos({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const [partidas, setPartidas] = useState(() => getPartidas(obraKey));
  const [estado, setEstado] = useState(() => getCatalogo(obraKey));
  const [partidaNueva, setPartidaNueva] = useState("");

  // Sesión PS real: trae partidas/montos ya registrados en el servidor.
  useEffect(() => {
    let cancelado = false;
    hidratarCatalogoConceptosDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) {
        setPartidas(getPartidas(obraKey));
        setEstado(getCatalogo(obraKey));
      }
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  const total = montoTotal(estado);
  const totalModificado = montoModificadoTotal(estado);

  const cambiarMonto = (partida, valor) => {
    const next = { ...estado, montosPorPartida: { ...estado.montosPorPartida, [partida]: valor } };
    setEstado(next);
    guardarCatalogo(obraKey, next);
  };

  const cambiarMontoModificado = (partida, valor) => {
    const next = { ...estado, montosModificadosPorPartida: { ...estado.montosModificadosPorPartida, [partida]: valor } };
    setEstado(next);
    guardarCatalogo(obraKey, next);
  };

  const agregar = () => {
    if (!partidaNueva.trim()) return;
    setPartidas(agregarPartida(obraKey, partidaNueva));
    setEstado(getCatalogo(obraKey));
    setPartidaNueva("");
  };

  const quitar = (partida) => {
    setPartidas(eliminarPartida(obraKey, partida));
    setEstado(getCatalogo(obraKey));
  };

  const cargarPdf = (file) => {
    const next = { ...estado, pdfNombre: file ? file.name : estado.pdfNombre };
    setEstado(next);
    guardarCatalogo(obraKey, next);
  };

  const toggleModificaciones = (hubo) => {
    const next = { ...estado, huboModificaciones: hubo, partidasModificadas: hubo ? estado.partidasModificadas : [] };
    setEstado(next);
    guardarCatalogo(obraKey, next);
  };

  const togglePartidaModificada = (partida) => {
    const yaEsta = estado.partidasModificadas.includes(partida);
    const next = {
      ...estado,
      partidasModificadas: yaEsta ? estado.partidasModificadas.filter((p) => p !== partida) : [...estado.partidasModificadas, partida],
    };
    setEstado(next);
    guardarCatalogo(obraKey, next);
  };

  const cambiarDescripcion = (descripcionModificacion) => setEstado((prev) => ({ ...prev, descripcionModificacion }));

  const guardar = () => {
    guardarCatalogo(obraKey, estado);
    onGuardar({
      estatus: total > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: total > 0 ? new Date().toISOString().slice(0, 10) : registro.fechaReal,
      evidenciaNombre: estado.pdfNombre || `Catálogo por ${formatoMoneda(total)}`,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Desglose por partida</p>
        <div className="space-y-2">
          {partidas.length > 0 && (
            <div className="flex items-center gap-2 px-3.5">
              <span className="text-[10px] font-bold uppercase tracking-widest flex-1" style={{ color: "var(--ink-faint)" }} />
              <span className="w-24 text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--ink-faint)" }}>Inicial</span>
              <span className="w-24 text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "var(--ink-faint)" }}>Modificado</span>
              <span className="w-6" />
            </div>
          )}
          {partidas.map((partida) => (
            <div key={partida} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{partida}</p>
              <input
                type="number"
                min="0"
                placeholder="Monto"
                value={estado.montosPorPartida[partida] ?? ""}
                onChange={(e) => cambiarMonto(partida, e.target.value)}
                className="w-24 px-2.5 py-1.5 text-sm text-right rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              />
              <input
                type="number"
                min="0"
                placeholder="Monto"
                value={estado.montosModificadosPorPartida[partida] ?? ""}
                onChange={(e) => cambiarMontoModificado(partida, e.target.value)}
                className="w-24 px-2.5 py-1.5 text-sm text-right rounded-lg"
                style={{ border: "1px solid var(--border)", color: "var(--oro)" }}
              />
              <button type="button" onClick={() => quitar(partida)} className="p-1 rounded-lg shrink-0" style={{ color: "var(--rojo)" }} aria-label={`Quitar partida ${partida}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            </div>
          ))}
          {partidas.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: "var(--ink-faint)" }}>Aún no registras ninguna partida.</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          <input
            value={partidaNueva}
            onChange={(e) => setPartidaNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
            placeholder="Nueva partida (ej. Cimentación)"
            className="flex-1 px-3 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={agregar}
            className="px-3 py-2 rounded-xl text-sm font-bold text-white shrink-0 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
            style={{ backgroundColor: "var(--guinda)" }}
          >
            + Agregar
          </button>
        </div>

        <div className="flex items-center justify-between mt-2.5 px-1">
          <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Monto total inicial</span>
          <span className="text-sm font-black" style={{ color: "var(--guinda)" }}>{formatoMoneda(total)}</span>
        </div>
        {totalModificado > 0 && (
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Monto total modificado</span>
            <span className="text-sm font-black" style={{ color: "var(--oro)" }}>{formatoMoneda(totalModificado)}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid var(--border)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Catálogo completo (PDF)</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: estado.pdfNombre ? "var(--verde)" : "var(--ink-faint)" }}>
            {estado.pdfNombre ? `📎 ${estado.pdfNombre}` : "Sin cargar"}
          </p>
        </div>
        <label className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px solid var(--border)" }}>
          {estado.pdfNombre ? "Reemplazar" : "Cargar"}
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => cargarPdf(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>¿Hubo modificaciones al catálogo?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleModificaciones(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={!estado.huboModificaciones ? { backgroundColor: "var(--verde)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => toggleModificaciones(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={estado.huboModificaciones ? { backgroundColor: "var(--guinda)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            Sí
          </button>
        </div>

        {estado.huboModificaciones && (
          <div className="mt-3 space-y-2.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>¿En qué partida(s)?</p>
              <div className="flex flex-wrap gap-1.5">
                {partidas.map((partida) => {
                  const activo = estado.partidasModificadas.includes(partida);
                  return (
                    <button
                      key={partida}
                      type="button"
                      onClick={() => togglePartidaModificada(partida)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={activo ? { backgroundColor: "var(--guinda)", color: "#fff" } : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
                    >
                      {partida}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              value={estado.descripcionModificacion}
              onChange={(e) => cambiarDescripcion(e.target.value)}
              rows={2}
              placeholder="Describe brevemente la modificación..."
              className="w-full px-3 py-2 text-sm rounded-xl resize-none"
              style={{ border: "1px solid var(--border)" }}
            />
          </div>
        )}
      </div>

      <PanelVerificacion obraKey={obraKey} reqId={registro.reqId} />

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
