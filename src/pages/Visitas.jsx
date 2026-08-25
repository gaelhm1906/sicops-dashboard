import React, { useState, useCallback, useMemo } from "react";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Input from "../components/Shared/Input";
import RingProgress from "../components/Shared/RingProgress";
import AnimatedNumber from "../components/Shared/AnimatedNumber";
import BandejaTareasObra from "../components/Seguimiento/BandejaTareasObra";
import { useObras } from "../context/ObraContext";
import { useAuth } from "../context/AuthContext";
import { getVisitaObligadaPorRol } from "../data/seguimientoCatalogo";
import { getVisitasHoyPorRolGlobal, getObraKey } from "../utils/seguimiento";
import { formatearHora } from "../utils/formatters";
import { esVistaEjecutiva } from "../utils/roles";
import { esObraPrioritaria, toggleObraPrioritaria, getObrasPrioritarias } from "../utils/prioridadVisitas";

function IconEstrella({ activa }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={activa ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   FilaObraVisita — una obra en la lista, con su único botón de
   acción: registrar la visita de hoy (Design System v2 — un botón,
   una decisión, sin menús intermedios).
   ══════════════════════════════════════════════════════════ */
function FilaObraVisita({ obra, registrada, prioritaria, puedeMarcarPrioridad, onTogglePrioridad, onAbrir, delayMs = 0 }) {
  return (
    <div
      className="task-row card animate-row-in px-4 py-3 flex items-center gap-3"
      style={{ borderLeftColor: registrada ? "var(--verde)" : prioritaria ? "var(--oro)" : "transparent", animationDelay: `${delayMs}ms` }}
    >
      {puedeMarcarPrioridad && (
        <button
          type="button"
          onClick={() => onTogglePrioridad(obra)}
          aria-label={prioritaria ? "Quitar prioridad" : "Marcar como prioritaria"}
          aria-pressed={prioritaria}
          className="shrink-0 p-1.5 rounded-lg transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.9]"
          style={{ color: prioritaria ? "var(--oro)" : "var(--ink-faint)" }}
        >
          <IconEstrella activa={prioritaria} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{obra.nombre_obra || obra.nombre}</p>
          {prioritaria && !puedeMarcarPrioridad && (
            <span className="shrink-0" style={{ color: "var(--oro)" }} title="Obra prioritaria del Secretario">
              <IconEstrella activa />
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>{obra.programa || obra.clave_unica || ""}</p>
      </div>
      {registrada && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(0,99,65,0.10)", color: "var(--verde)" }}>
          ✓ Visitada hoy
        </span>
      )}
      <button
        type="button"
        onClick={() => onAbrir(obra)}
        className="px-3 py-2 rounded-xl text-xs font-bold text-white shrink-0 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
        style={{ backgroundColor: "var(--guinda)" }}
      >
        📍 Registrar visita
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Visitas — módulo dedicado a la visita obligada diaria: cuánto
   llevas hoy, la bitácora de dónde ya estuviste, y a qué obra ir
   después. Antes solo vivía escondido dentro de la Bandeja de cada
   obra; ahora es su propio destino en la barra lateral.
   ══════════════════════════════════════════════════════════ */
export default function Visitas() {
  const { obrasFiltradas, loading } = useObras();
  const { user } = useAuth();
  const rol = user?.rol || "";
  const isAdmin = esVistaEjecutiva(rol);

  const [busqueda, setBusqueda] = useState("");
  const [obraModal, setObraModal] = useState(null);
  const [version, setVersion] = useState(0);
  const [prioridadVersion, setPrioridadVersion] = useState(0);

  const visitaObligada = useMemo(() => getVisitaObligadaPorRol(rol), [rol]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer localStorage tras registrar una visita
  const visitasHoy = useMemo(() => getVisitasHoyPorRolGlobal(rol), [rol, version]);

  const obraPorKey = useMemo(() => {
    const map = {};
    for (const o of obrasFiltradas) map[getObraKey(o)] = o;
    return map;
  }, [obrasFiltradas]);

  const obraKeysVisitadasHoy = useMemo(
    () => new Set(visitasHoy.map((v) => v.obraKey)),
    [visitasHoy]
  );

  const obrasFiltradasPorBusqueda = useMemo(() => {
    if (!busqueda.trim()) return obrasFiltradas;
    const q = busqueda.toLowerCase();
    return obrasFiltradas.filter((o) =>
      [o.nombre_obra, o.nombre, o.programa, o.clave_unica].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    );
  }, [obrasFiltradas, busqueda]);

  /* Ajuste de minuta (sesión de revisión #1): las obras que el Secretario
     marcó como prioritarias van primero, para que se salten la búsqueda
     visual del resto de la lista. */
  const obrasBuscadas = useMemo(() => {
    const prioritarias = new Set(getObrasPrioritarias());
    return [...obrasFiltradasPorBusqueda].sort((a, b) => {
      const pa = prioritarias.has(getObraKey(a)) ? 1 : 0;
      const pb = prioritarias.has(getObraKey(b)) ? 1 : 0;
      return pb - pa;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `prioridadVersion` fuerza releer localStorage tras marcar/desmarcar
  }, [obrasFiltradasPorBusqueda, prioridadVersion]);

  const puedeMarcarPrioridad = isAdmin;

  const abrirModal = useCallback((obra) => setObraModal(obra), []);
  const cerrarModal = useCallback(() => { setObraModal(null); setVersion((v) => v + 1); }, []);
  const togglePrioridad = useCallback((obra) => {
    toggleObraPrioritaria(getObraKey(obra));
    setPrioridadVersion((v) => v + 1);
  }, []);

  const meta = visitaObligada?.visitasPorDia || 0;
  const completadas = visitasHoy.length;
  const pct = meta > 0 ? Math.min(100, Math.round((completadas / meta) * 100)) : 0;
  const faltan = Math.max(0, meta - completadas);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #F8F5F2 0%, #ECE9E2 100%)" }}>

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-3xl mx-auto w-full space-y-4">

          {/* ── Cuota del día ── */}
          {meta > 0 ? (
            <div className="card-hero px-6 py-5 flex items-center gap-5">
              <RingProgress size={76} pct={pct}>
                <div className="rounded-full flex items-center justify-center" style={{ width: 62, height: 62, backgroundColor: "var(--guinda)" }}>
                  <span className="text-base font-black text-white">
                    <AnimatedNumber value={completadas} />/{meta}
                  </span>
                </div>
              </RingProgress>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-widest font-black text-white/70">Visitas de hoy</p>
                <h1 className="mt-0.5 text-lg font-black text-white truncate">{visitaObligada.label}</h1>
                <p className="mt-1 text-xs text-white/75">
                  {faltan === 0
                    ? "Cuota cumplida — buen trabajo."
                    : `Te falta${faltan === 1 ? "" : "n"} ${faltan} visita${faltan === 1 ? "" : "s"} por registrar.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="card bg-blueprint text-center py-8 px-6">
              <p className="text-sm font-black" style={{ color: "var(--ink)" }}>
                {isAdmin
                  ? "Como administrador no tienes una cuota de visitas asignada."
                  : "No tienes una cuota de visitas obligada asignada a tu rol."}
              </p>
            </div>
          )}

          {/* ── Bitácora de hoy ── */}
          {completadas > 0 && (
            <section className="card overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#8C6B41" }}>
                  Bitácora de hoy
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                {visitasHoy.map((v, i) => {
                  const obra = obraPorKey[v.obraKey];
                  return (
                    <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
                          {obra?.nombre_obra || obra?.nombre || v.obraKey}
                        </p>
                        {v.observaciones && (
                          <p className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>{v.observaciones}</p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--ink-faint)" }}>
                        {formatearHora(v.hora)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Buscador ── */}
          <div className="card px-4 py-3">
            <Input
              id="busqueda-visitas"
              placeholder="Buscar obra por nombre, programa o clave..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar obra para registrar visita"
            />
          </div>

          {/* ── Lista de obras ── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
            </div>
          ) : obrasBuscadas.length === 0 ? (
            <div className="card bg-blueprint text-center py-14 text-sm" style={{ color: "var(--ink-faint)" }}>
              No se encontraron obras con este criterio.
            </div>
          ) : (
            <div className="space-y-2">
              {obrasBuscadas.map((obra, i) => (
                <FilaObraVisita
                  key={obra.uid || obra.id_obra || obra.id || i}
                  obra={obra}
                  registrada={obraKeysVisitadasHoy.has(getObraKey(obra))}
                  prioritaria={esObraPrioritaria(getObraKey(obra))}
                  puedeMarcarPrioridad={puedeMarcarPrioridad}
                  onTogglePrioridad={togglePrioridad}
                  onAbrir={abrirModal}
                  delayMs={Math.min(i, 12) * 25}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />

      {obraModal && (
        <BandejaTareasObra obra={obraModal} modoInicial="visita" onClose={cerrarModal} />
      )}
    </div>
  );
}
