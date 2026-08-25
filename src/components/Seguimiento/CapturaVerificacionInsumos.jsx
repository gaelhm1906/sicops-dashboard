import React, { useEffect, useState } from "react";
import Button from "../Shared/Button";
import { getInsumos, agregarInsumo, actualizarInsumo, eliminarInsumo, hidratarInsumosDesdeServidor } from "../../utils/verificacionInsumos";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(valor || 0);
}

/* REQ-11 — Verificación de compra de insumos y entregas extraordinarias
   (elevadores, estructuras metálicas, montacargas — ejemplos, no un
   catálogo cerrado). Cada insumo captura costo total, % de pago y
   factura. Ajuste de reunión con el Secretario (12 de agosto, sesión
   Cablebús): además, proveedor y responsable de compra — para poder
   rastrear el caso citado (elevadores de las estaciones) de punta a
   punta: quién lo compró, a quién, la factura y el pago. */
export default function CapturaVerificacionInsumos({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const [insumos, setInsumos] = useState(() => getInsumos(obraKey));
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", proveedor: "", responsableCompra: "", costoTotal: "", porcentajePago: "" });
  const [expandedId, setExpandedId] = useState(null);

  // Sesión PS real: trae los insumos ya registrados en el servidor.
  useEffect(() => {
    let cancelado = false;
    hidratarInsumosDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) setInsumos(getInsumos(obraKey));
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  const crear = () => {
    if (!nuevo.nombre.trim() || !nuevo.costoTotal) return;
    setInsumos(agregarInsumo(obraKey, nuevo));
    setNuevo({ nombre: "", proveedor: "", responsableCompra: "", costoTotal: "", porcentajePago: "" });
    setMostrarNuevo(false);
  };

  const actualizarCampo = (id, campo, valor) => setInsumos(actualizarInsumo(obraKey, id, { [campo]: valor }));
  const cargarFactura = (id, file) => setInsumos(actualizarInsumo(obraKey, id, { facturaNombre: file ? file.name : null }));
  const quitar = (id) => { setInsumos(eliminarInsumo(obraKey, id)); setExpandedId(null); };

  const guardar = () => {
    onGuardar({
      estatus: insumos.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: insumos.length > 0 ? `${insumos.length} insumo${insumos.length === 1 ? "" : "s"} verificado${insumos.length === 1 ? "" : "s"}` : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-3">
      {insumos.length === 0 && !mostrarNuevo && (
        <p className="text-xs text-center py-4" style={{ color: "var(--ink-faint)" }}>Aún no registras insumos ni entregas extraordinarias.</p>
      )}

      {insumos.map((i) => {
        const expandido = expandedId === i.id;
        return (
          <div key={i.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setExpandedId(expandido ? null : i.id)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{i.nombre}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
                  {formatoMoneda(i.costoTotal)} · {i.porcentajePago}% pagado{i.proveedor ? ` · ${i.proveedor}` : ""}
                </p>
              </div>
              <div className="w-10 h-1.5 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "var(--border-soft)" }}>
                <div className="h-full rounded-full" style={{ width: `${i.porcentajePago}%`, backgroundColor: i.porcentajePago >= 100 ? "var(--verde)" : "var(--naranja)" }} />
              </div>
            </button>
            {expandido && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-2.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Proveedor</label>
                    <input
                      value={i.proveedor || ""}
                      onChange={(e) => actualizarCampo(i.id, "proveedor", e.target.value)}
                      placeholder="A quién se le compró"
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                      style={{ border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Responsable de compra</label>
                    <input
                      value={i.responsableCompra || ""}
                      onChange={(e) => actualizarCampo(i.id, "responsableCompra", e.target.value)}
                      placeholder="Quién la gestionó"
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                      style={{ border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Porcentaje de pago</label>
                  <input
                    type="range" min="0" max="100" value={i.porcentajePago}
                    onChange={(e) => actualizarCampo(i.id, "porcentajePago", Number(e.target.value))}
                    className="w-full" style={{ accentColor: "var(--guinda)" }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] flex-1 truncate" style={{ color: i.facturaNombre ? "var(--verde)" : "var(--ink-faint)" }}>
                    {i.facturaNombre ? `📎 ${i.facturaNombre}` : "Sin factura cargada"}
                  </p>
                  <label className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer shrink-0" style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)" }}>
                    {i.facturaNombre ? "Reemplazar" : "Cargar factura"}
                    <input type="file" className="hidden" onChange={(e) => cargarFactura(i.id, e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => quitar(i.id)} className="text-[11px] font-bold" style={{ color: "var(--rojo)" }}>Eliminar</button>
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
            value={nuevo.nombre}
            onChange={(e) => setNuevo((d) => ({ ...d, nombre: e.target.value }))}
            placeholder="Insumo — ej. Elevador, estructura metálica, montacargas"
            className="w-full px-3 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={nuevo.proveedor}
              onChange={(e) => setNuevo((d) => ({ ...d, proveedor: e.target.value }))}
              placeholder="Proveedor"
              className="w-full px-3 py-2 text-sm rounded-xl" style={{ border: "1px solid var(--border)" }}
            />
            <input
              value={nuevo.responsableCompra}
              onChange={(e) => setNuevo((d) => ({ ...d, responsableCompra: e.target.value }))}
              placeholder="Responsable de compra"
              className="w-full px-3 py-2 text-sm rounded-xl" style={{ border: "1px solid var(--border)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" value={nuevo.costoTotal}
              onChange={(e) => setNuevo((d) => ({ ...d, costoTotal: e.target.value }))}
              placeholder="Costo total"
              className="w-full px-3 py-2 text-sm rounded-xl" style={{ border: "1px solid var(--border)" }}
            />
            <input
              type="number" min="0" max="100" value={nuevo.porcentajePago}
              onChange={(e) => setNuevo((d) => ({ ...d, porcentajePago: e.target.value }))}
              placeholder="% pagado"
              className="w-full px-3 py-2 text-sm rounded-xl" style={{ border: "1px solid var(--border)" }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMostrarNuevo(false)}>Cancelar</Button>
            <Button size="sm" onClick={crear}>Agregar insumo</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarNuevo(true)}
          className="w-full py-2.5 rounded-xl text-sm font-bold"
          style={{ border: "1.5px dashed var(--border)", color: "var(--ink-faint)" }}
        >
          + Nuevo insumo
        </button>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={insumos.length === 0}>Guardar</Button>
      </div>
    </div>
  );
}
