import React, { useEffect, useState } from "react";
import Button from "../Shared/Button";
import {
  getFrentes,
  agregarFrente,
  actualizarPartida,
  resumenFrente,
  resumenObra,
  PARTIDAS_GENERADORES,
  hidratarGeneradoresDesdeServidor,
} from "../../utils/generadoresObra";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* REQ-12 — Entrega de generadores de obra: organizados por FRENTE y, dentro
   de cada frente, por PARTIDA técnica. Los frentes ya reportados quedan
   precargados como chips — no se vuelven a crear cada semana, solo se
   actualiza el estatus sí/no de sus partidas. */
export default function CapturaGeneradoresObra({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const [frentes, setFrentes] = useState(() => getFrentes(obraKey));
  const [frenteActivo, setFrenteActivo] = useState(() => frentes[0]?.id || null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(frentes.length === 0);

  // Sesión PS real: trae los frentes/partidas ya registrados en el servidor.
  useEffect(() => {
    let cancelado = false;
    hidratarGeneradoresDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) {
        const frescos = getFrentes(obraKey);
        setFrentes(frescos);
        setFrenteActivo((actual) => actual || frescos[0]?.id || null);
        setMostrarNuevo(frescos.length === 0);
      }
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  const resumen = resumenObra(frentes);
  const frente = frentes.find((f) => f.id === frenteActivo) || null;

  const agregar = () => {
    if (!nombreNuevo.trim()) return;
    const next = agregarFrente(obraKey, nombreNuevo);
    setFrentes(next);
    setFrenteActivo(next[next.length - 1].id);
    setNombreNuevo("");
    setMostrarNuevo(false);
  };

  const togglePartida = (partida, entregado) => {
    setFrentes(actualizarPartida(obraKey, frenteActivo, partida, entregado));
  };

  const guardar = () => {
    onGuardar({
      estatus: resumen.entregadas > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: resumen.total > 0
        ? `${resumen.entregadas} de ${resumen.total} partidas con generador`
        : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-4">
      {/* Frentes precargados */}
      <div className="flex flex-wrap gap-2">
        {frentes.map((f) => {
          const r = resumenFrente(f);
          const activo = f.id === frenteActivo && !mostrarNuevo;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFrenteActivo(f.id); setMostrarNuevo(false); }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
              style={activo
                ? { backgroundColor: "var(--guinda)", color: "#fff" }
                : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
            >
              {f.nombre}
              <span className="block font-normal mt-0.5" style={{ opacity: 0.8 }}>{r.entregadas}/{r.total}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => { setMostrarNuevo(true); setFrenteActivo(null); }}
          className="px-3 py-2 rounded-xl text-xs font-bold"
          style={{ border: "1.5px dashed var(--border)", color: "var(--ink-faint)" }}
        >
          + Nuevo frente
        </button>
      </div>

      {mostrarNuevo && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre del frente"
            className="flex-1 px-3 py-2 text-sm rounded-xl"
            style={{ border: "1px solid var(--border)" }}
          />
          <button type="button" onClick={agregar} className="px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "var(--guinda)" }}>
            Crear
          </button>
        </div>
      )}

      {/* Checklist de partidas del frente activo */}
      {frente && !mostrarNuevo ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>{frente.nombre} · Partidas</p>
          {PARTIDAS_GENERADORES.map((partida) => {
            const estado = frente.partidas[partida];
            return (
              <button
                key={partida}
                type="button"
                onClick={() => togglePartida(partida, !estado.entregado)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.99]"
                style={{
                  border: `1.5px solid ${estado.entregado ? "var(--verde)" : "var(--border)"}`,
                  backgroundColor: estado.entregado ? "rgba(0,99,65,0.06)" : "var(--surface)",
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: estado.entregado ? "var(--verde)" : "var(--surface-2)", border: estado.entregado ? "none" : "1px solid var(--border)" }}
                >
                  {estado.entregado && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-semibold flex-1" style={{ color: "var(--ink)" }}>{partida}</span>
                <span className="text-[11px] font-semibold" style={{ color: estado.entregado ? "var(--verde)" : "var(--ink-faint)" }}>
                  {estado.entregado ? "Entregado" : "Pendiente"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        !mostrarNuevo && (
          <p className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>Selecciona o crea un frente para capturar sus partidas.</p>
        )
      )}

      {/* Resumen general */}
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>Resumen general</p>
          <p className="text-xs font-bold" style={{ color: "var(--guinda)" }}>{resumen.entregadas} de {resumen.total} partidas</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${resumen.total > 0 ? (resumen.entregadas / resumen.total) * 100 : 0}%`, backgroundColor: "var(--guinda)" }}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={frentes.length === 0}>Guardar</Button>
      </div>
    </div>
  );
}
