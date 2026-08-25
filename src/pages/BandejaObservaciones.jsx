import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import { useAuth } from "../context/AuthContext";
import { listarBandejaPara, marcarLeida, ESTADO_EVALUACION_INFO } from "../utils/evaluaciones";
import { REQUERIMIENTOS } from "../data/seguimientoCatalogo";
import { formatearFechaHora } from "../utils/formatters";

const REQ_POR_ID = Object.fromEntries(REQUERIMIENTOS.map((r) => [r.id, r]));

function IconObservacion() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* Tarjeta de una observación — al expandirla se marca como leída (misma
   semántica que abrir un correo). El `estado` (No atendido/Atendido
   parcial/Atendido) es el veredicto del Secretario, no algo que el
   destinatario pueda cambiar aquí: para atenderla, va a la captura real
   del requerimiento — esta bandeja es de lectura. */
function TarjetaObservacion({ evaluacion, expandido, onAbrir, onIrAObra }) {
  const requerimiento = REQ_POR_ID[evaluacion.reqId];
  const info = ESTADO_EVALUACION_INFO[evaluacion.estado];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-shadow"
      style={{
        border: `1.5px solid ${!evaluacion.leida ? "var(--guinda)" : "var(--border)"}`,
        backgroundColor: !evaluacion.leida ? "rgba(105,28,50,0.03)" : "var(--surface)",
      }}
    >
      <button type="button" onClick={() => onAbrir(evaluacion)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)" }}
        >
          <IconObservacion />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {!evaluacion.leida && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--guinda)" }} aria-hidden="true" />
            )}
            <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{evaluacion.obraNombre || evaluacion.obraKey}</p>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
            {requerimiento?.nombre || evaluacion.reqId} · {evaluacion.dg || "Sin DG"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: info?.color }}>
            {info?.label || evaluacion.estado}
          </span>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--ink-faint)" }}>{formatearFechaHora(evaluacion.fecha)}</p>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 pt-0.5 space-y-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <p className="text-sm pt-3" style={{ color: "var(--ink)" }}>{evaluacion.observacion}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Enviada por {evaluacion.evaluadoPor}</p>
            <button
              type="button"
              onClick={() => onIrAObra(evaluacion, requerimiento)}
              className="text-xs font-bold flex items-center gap-1 shrink-0"
              style={{ color: "var(--guinda)" }}
            >
              Ir a la obra
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BandejaObservaciones() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [expandidoKey, setExpandidoKey] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer las evaluaciones guardadas en localStorage
  const bandeja = useMemo(() => listarBandejaPara(user), [user, version]);

  const filtrada = useMemo(() => {
    if (filtro === "no_leidas") return bandeja.filter((e) => !e.leida);
    return bandeja;
  }, [bandeja, filtro]);

  const noLeidas = bandeja.filter((e) => !e.leida).length;

  const abrir = useCallback((evaluacion) => {
    const key = `${evaluacion.obraKey}::${evaluacion.reqId}`;
    const yaAbierto = expandidoKey === key;
    setExpandidoKey(yaAbierto ? null : key);
    if (!yaAbierto && !evaluacion.leida) {
      marcarLeida(evaluacion.obraKey, evaluacion.reqId);
      setVersion((v) => v + 1);
    }
  }, [expandidoKey]);

  const irAObra = useCallback((evaluacion, requerimiento) => {
    navigate("/obras", { state: { buscarTarea: requerimiento?.nombre || evaluacion.obraNombre } });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-3xl mx-auto w-full space-y-4">

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "#8C6B41" }}>Bandeja de entrada</p>
                <h1 className="text-2xl font-black" style={{ color: "var(--guinda)" }}>Observaciones del Secretario</h1>
              </div>
              {noLeidas > 0 && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--guinda)", color: "#fff" }}>
                  {noLeidas} sin leer
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {[{ id: "todas", label: "Todas" }, { id: "no_leidas", label: "Sin leer" }].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setFiltro(op.id)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold"
                  style={filtro === op.id
                    ? { backgroundColor: "var(--guinda)", color: "#fff" }
                    : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {filtrada.length === 0 ? (
              <div className="card bg-blueprint text-center py-14 px-6">
                <p className="text-sm font-black" style={{ color: "var(--ink)" }}>
                  {filtro === "no_leidas" ? "No tienes observaciones sin leer." : "Aún no tienes observaciones del Secretario."}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  Cuando el Secretario deje una observación sobre un requerimiento tuyo, aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtrada.map((evaluacion) => {
                  const key = `${evaluacion.obraKey}::${evaluacion.reqId}`;
                  return (
                    <TarjetaObservacion
                      key={key}
                      evaluacion={evaluacion}
                      expandido={expandidoKey === key}
                      onAbrir={abrir}
                      onIrAObra={irAObra}
                    />
                  );
                })}
              </div>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
