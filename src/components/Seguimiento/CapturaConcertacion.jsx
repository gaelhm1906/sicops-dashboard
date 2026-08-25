import React, { useState } from "react";
import Button from "../Shared/Button";
import { useAuth } from "../../context/AuthContext";
import { formatearFechaHora } from "../../utils/formatters";
import { getConcertacion, casoActivo, crearCaso, agregarEntrada, cerrarCaso, TIPO_ENTRADA } from "../../utils/concertacion";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

function Entrada({ e }) {
  const esSecretario = e.tipo === TIPO_ENTRADA.INDICACION_SECRETARIO;
  return (
    <div
      className="rounded-xl px-3.5 py-2.5"
      style={esSecretario
        ? { backgroundColor: "rgba(105,28,50,0.06)", border: "1px solid rgba(105,28,50,0.2)" }
        : { backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        {esSecretario && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--guinda)", color: "#fff" }}>
            Secretario
          </span>
        )}
        <span className="text-[11px] font-mono" style={{ color: "var(--ink-faint)" }}>{formatearFechaHora(e.fecha)}</span>
      </div>
      <p className="text-sm" style={{ color: "var(--ink)" }}>{e.texto}</p>
    </div>
  );
}

/* REQ-17 — Informe de concertación de obras públicas: no es una captura
   de una sola vez, es una bitácora de ida y vuelta. Se abre un caso con
   la descripción del problema, se le agregan seguimientos, y las
   indicaciones directas del secretario (desde el panel de evaluación de
   Revisión Integral) aparecen en la misma línea de tiempo. */
export default function CapturaConcertacion({ obraKey, registro, onGuardar, onCancelar }) {
  const { user } = useAuth();
  const [estado, setEstado] = useState(() => getConcertacion(obraKey));
  const [problemaNuevo, setProblemaNuevo] = useState("");
  const [seguimientoNuevo, setSeguimientoNuevo] = useState("");
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const caso = casoActivo(estado);
  const cerrados = estado.casos.filter((c) => c.estatus === "cerrado");

  const abrirCaso = () => {
    if (!problemaNuevo.trim()) return;
    setEstado(crearCaso(obraKey, problemaNuevo, user?.email));
    setProblemaNuevo("");
  };

  const agregarSeguimiento = () => {
    if (!seguimientoNuevo.trim() || !caso) return;
    setEstado(agregarEntrada(obraKey, caso.id, { tipo: TIPO_ENTRADA.SEGUIMIENTO, texto: seguimientoNuevo, autor: user?.email }));
    setSeguimientoNuevo("");
  };

  const cerrar = () => {
    if (!caso) return;
    setEstado(cerrarCaso(obraKey, caso.id));
  };

  const guardar = () => {
    onGuardar({
      estatus: estado.casos.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: caso
        ? `Caso abierto: ${caso.problema.slice(0, 40)}${caso.problema.length > 40 ? "…" : ""}`
        : estado.casos.length > 0
          ? `${estado.casos.length} caso${estado.casos.length === 1 ? "" : "s"} registrado${estado.casos.length === 1 ? "" : "s"}`
          : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-4">
      {caso ? (
        <>
          <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(217,119,6,0.15)", color: "#92400e" }}>
                Caso abierto
              </span>
              <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>desde {formatearFechaHora(caso.fechaCreacion)}</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{caso.problema}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Bitácora</p>
            {caso.entradas.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: "var(--ink-faint)" }}>Aún no hay seguimientos en este caso.</p>
            ) : (
              <div className="space-y-2">
                {caso.entradas.map((e) => <Entrada key={e.id} e={e} />)}
              </div>
            )}
          </div>

          <div>
            <textarea
              value={seguimientoNuevo}
              onChange={(e) => setSeguimientoNuevo(e.target.value)}
              rows={3}
              placeholder="Agregar seguimiento — qué se hizo, con quién se habló, próximos pasos..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
              style={{ border: "1px solid var(--border)" }}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={agregarSeguimiento} disabled={!seguimientoNuevo.trim()}>Agregar seguimiento</Button>
            </div>
          </div>

          <button
            type="button"
            onClick={cerrar}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ border: "1px solid var(--verde)", color: "var(--verde)" }}
          >
            ✓ Marcar caso como resuelto
          </button>
        </>
      ) : (
        <div className="rounded-xl px-3.5 py-3 space-y-2.5" style={{ border: "1px solid var(--border)" }}>
          <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Describe el problema</label>
          <textarea
            autoFocus
            value={problemaNuevo}
            onChange={(e) => setProblemaNuevo(e.target.value)}
            rows={3}
            placeholder="Ej. Vecinos de la colonia bloquean el acceso a la obra por inconformidad con el ruido..."
            className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
            style={{ border: "1px solid var(--border)" }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={abrirCaso} disabled={!problemaNuevo.trim()}>Abrir caso</Button>
          </div>
        </div>
      )}

      {cerrados.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setMostrarHistorial((v) => !v)}
            className="text-xs font-bold flex items-center gap-1.5"
            style={{ color: "var(--guinda)" }}
          >
            {mostrarHistorial ? "Ocultar" : "Ver"} historial de casos resueltos ({cerrados.length})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: mostrarHistorial ? "rotate(90deg)" : "none" }}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          {mostrarHistorial && (
            <div className="mt-2 space-y-2">
              {cerrados.map((c) => (
                <div key={c.id} className="rounded-xl px-3.5 py-2.5" style={{ border: "1px solid var(--border-soft)", opacity: 0.85 }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{c.problema}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                    Resuelto el {formatearFechaHora(c.fechaCierre)} · {c.entradas.length} entrada{c.entradas.length === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
