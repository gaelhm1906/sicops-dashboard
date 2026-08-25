import React, { useEffect, useState } from "react";
import Button from "../Shared/Button";
import {
  getFrentesHoy,
  agregarFrente,
  eliminarFrente,
  cambiarTipoFrente,
  agregarOficio,
  actualizarOficio,
  eliminarOficio,
  totalFrente,
  totalTrabajadores,
  totalTrabajadoresPorTipo,
  TIPO_FRENTE,
  TIPO_FRENTE_INFO,
  hidratarFuerzaTrabajoDesdeServidor,
} from "../../utils/fuerzaTrabajo";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* Un frente expandible: al abrirlo se ve (y edita) el detalle por
   oficio — "en Alberca hay 5 trabajadores" no basta, hace falta saber
   cuántos son albañiles, cuántos herreros, etc. */
function FrenteCard({ frente, expandido, onExpandir, onQuitarFrente, onCambiarTipo, onAgregarOficio, onActualizarOficio, onEliminarOficio }) {
  const [nombreOficio, setNombreOficio] = useState("");
  const [trabajadoresOficio, setTrabajadoresOficio] = useState("");
  const total = totalFrente(frente);
  const esEstudios = frente.tipo === TIPO_FRENTE.ESTUDIOS;

  const agregar = () => {
    if (!nombreOficio.trim() || !trabajadoresOficio) return;
    onAgregarOficio(frente.id, nombreOficio, trabajadoresOficio);
    setNombreOficio("");
    setTrabajadoresOficio("");
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${esEstudios ? "var(--oro)" : "var(--border)"}` }}>
      <button
        type="button"
        onClick={() => onExpandir(expandido ? null : frente.id)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <p className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{frente.nombre}</p>
        <span className="text-xs font-bold shrink-0" style={{ color: "var(--guinda)" }}>
          {total} trabajador{total === 1 ? "" : "es"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: expandido ? "rotate(90deg)" : "none" }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {expandido && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-2.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
          {/* Ajuste de reunión con el Secretario (12 de agosto, sesión
              Cablebús): un frente puede tener personal 100% en estudios,
              no en obra física — ese personal no debe contarse como
              avance de obra. Se marca por frente, no por oficio, porque
              el caso descrito era el frente completo (una estación
              entera haciendo estudios). */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>Este personal está en</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.values(TIPO_FRENTE).map((tipo) => {
                const activo = frente.tipo === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => onCambiarTipo(frente.id, tipo)}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-full transition-colors"
                    style={activo
                      ? { backgroundColor: tipo === TIPO_FRENTE.ESTUDIOS ? "var(--oro)" : "var(--guinda)", color: "#fff" }
                      : { backgroundColor: "var(--surface-2)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}
                  >
                    {TIPO_FRENTE_INFO[tipo].label}
                  </button>
                );
              })}
            </div>
            {esEstudios && (
              <p className="text-[10.5px] mt-1.5" style={{ color: "var(--ink-faint)" }}>
                No se contará como avance físico de obra mientras esté en "Estudios".
              </p>
            )}
          </div>

          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Detalle por oficio</p>

          {frente.oficios.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: "var(--ink-faint)" }}>Aún no capturas oficios en este frente.</p>
          )}
          {frente.oficios.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <p className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{o.nombre}</p>
              <input
                type="number"
                min="0"
                value={o.trabajadores}
                onChange={(e) => onActualizarOficio(frente.id, o.id, e.target.value)}
                className="w-20 px-2 py-1.5 text-sm text-right rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              />
              <button type="button" onClick={() => onEliminarOficio(frente.id, o.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--rojo)" }} aria-label={`Quitar ${o.nombre}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex items-end gap-2 pt-1">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Oficio</label>
              <input
                value={nombreOficio}
                onChange={(e) => setNombreOficio(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
                placeholder="Ej. Albañiles"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              />
            </div>
            <div className="w-20">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Trabajadores</label>
              <input
                type="number"
                min="0"
                value={trabajadoresOficio}
                onChange={(e) => setTrabajadoresOficio(e.target.value)}
                placeholder="0"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              />
            </div>
            <button
              type="button"
              onClick={agregar}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: "var(--guinda)" }}
            >
              + Agregar
            </button>
          </div>

          <button
            type="button"
            onClick={() => onQuitarFrente(frente.id)}
            className="text-[11px] font-bold"
            style={{ color: "var(--rojo)" }}
          >
            Quitar este frente
          </button>
        </div>
      )}
    </div>
  );
}

/* REQ-09 — Fuerza de trabajo: la captura la hace directamente el
   Director General (minuta de revisión de programa de obra: "la
   Dirección General captura la fuerza de trabajo por frente, no solo la
   valida" — revierte el ajuste anterior donde Supervisión/JUD
   capturaban y el Director General solo verificaba). Diaria, por frente
   y dentro de cada frente desglosada por oficio en texto libre (no se
   encasilla ni el frente ni el oficio en un catálogo cerrado). El total
   por frente y el total del día son la suma automática de los oficios. */
export default function CapturaFuerzaTrabajo({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const [frentes, setFrentes] = useState(() => getFrentesHoy(obraKey));
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [expandido, setExpandido] = useState(null);

  // Sesión PS real: trae lo ya capturado hoy en el servidor antes de
  // mostrar la pantalla — no afecta al resto de sesiones.
  useEffect(() => {
    let cancelado = false;
    hidratarFuerzaTrabajoDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) setFrentes(getFrentesHoy(obraKey));
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  const total = totalTrabajadores(frentes);
  const totalObra = totalTrabajadoresPorTipo(frentes, TIPO_FRENTE.OBRA);
  const totalEstudios = totalTrabajadoresPorTipo(frentes, TIPO_FRENTE.ESTUDIOS);

  const agregar = () => {
    if (!nombreNuevo.trim()) return;
    const next = agregarFrente(obraKey, nombreNuevo);
    setFrentes(next);
    setExpandido(next[next.length - 1].id);
    setNombreNuevo("");
  };

  const quitarFrente = (id) => {
    setFrentes(eliminarFrente(obraKey, id));
    if (expandido === id) setExpandido(null);
  };

  const cambiarTipoFrenteLocal = (frenteId, tipo) => setFrentes(cambiarTipoFrente(obraKey, frenteId, tipo));
  const agregarOficioFrente = (frenteId, nombre, trabajadores) => setFrentes(agregarOficio(obraKey, frenteId, nombre, trabajadores));
  const actualizarOficioFrente = (frenteId, oficioId, valor) => setFrentes(actualizarOficio(obraKey, frenteId, oficioId, valor));
  const eliminarOficioFrente = (frenteId, oficioId) => setFrentes(eliminarOficio(obraKey, frenteId, oficioId));

  const guardar = () => {
    onGuardar({
      estatus: frentes.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: frentes.length > 0
        ? `${totalObra} en obra${totalEstudios > 0 ? ` + ${totalEstudios} en estudios` : ""} · ${frentes.length} frente${frentes.length === 1 ? "" : "s"}`
        : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Total del día</p>
            <p className="text-2xl font-black" style={{ color: "var(--guinda)" }}>
              {total} <span className="text-sm font-semibold" style={{ color: "var(--ink-faint)" }}>trabajadores</span>
            </p>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-faint)" }}>
            {frentes.length} frente{frentes.length === 1 ? "" : "s"}
          </span>
        </div>
        {/* Desglose obra/estudios: el de estudios no cuenta como avance
            físico de obra (ajuste de reunión con el Secretario, 12 de
            agosto, sesión Cablebús). */}
        {totalEstudios > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 text-[11px] font-semibold" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <span style={{ color: "var(--guinda)" }}>{totalObra} en obra</span>
            <span style={{ color: "var(--oro)" }}>{totalEstudios} en estudios</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {frentes.map((f) => (
          <FrenteCard
            key={f.id}
            frente={f}
            expandido={expandido === f.id}
            onExpandir={setExpandido}
            onQuitarFrente={quitarFrente}
            onCambiarTipo={cambiarTipoFrenteLocal}
            onAgregarOficio={agregarOficioFrente}
            onActualizarOficio={actualizarOficioFrente}
            onEliminarOficio={eliminarOficioFrente}
          />
        ))}
        {frentes.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: "var(--ink-faint)" }}>Aún no capturas ningún frente hoy.</p>
        )}
      </div>

      <div className="flex items-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Nuevo frente</label>
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
            placeholder="Ej. Cimentación poniente"
            className="w-full px-3 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
        </div>
        <button
          type="button"
          onClick={agregar}
          className="px-3 py-2 rounded-xl text-sm font-bold text-white shrink-0 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
          style={{ backgroundColor: "var(--guinda)" }}
        >
          + Agregar frente
        </button>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={frentes.length === 0}>Guardar</Button>
      </div>
    </div>
  );
}
