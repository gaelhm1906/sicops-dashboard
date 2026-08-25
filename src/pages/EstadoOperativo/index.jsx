/**
 * pages/EstadoOperativo/index.jsx
 * Centro de Estado Operativo — diagnóstico institucional del ecosistema SICOPS.
 * Solo accesible para ADMIN.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../../components/Layout/Sidebar";
import Footer  from "../../components/Layout/Footer";
import { useAuth }             from "../../context/AuthContext";
import { estadoOperativoAPI }  from "../../utils/api";

/* ── Paleta institucional ── */
const T = {
  pageBg:  "linear-gradient(180deg, #f1f5f9 0%, #e8ecf0 100%)",
  heroBg:  "linear-gradient(135deg, #1e293b 0%, #334155 60%, #475569 100%)",
  card:    "#ffffff",
  border:  "rgba(0,0,0,0.08)",
  shadow:  "0 2px 8px rgba(0,0,0,0.06)",
};

const ESTADO_CFG = {
  DISPONIBLE: { bg: "#f0fdf4", text: "#15803d", border: "#86efac", dot: "#22c55e", label: "Disponible"  },
  CERRADO:    { bg: "#f8fafc", text: "#64748b", border: "#cbd5e1", dot: "#94a3b8", label: "Cerrado"     },
  ERROR:      { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", dot: "#ef4444", label: "Error"       },
};

const INTEGRIDAD_CFG = {
  INTEGRA:    { bg: "#f0fdf4", text: "#15803d", border: "#86efac", icon: "✓", label: "Datos íntegros"       },
  ADVERTENCIA:{ bg: "#fffbeb", text: "#92400e", border: "#fde68a", icon: "⚠", label: "Revisar advertencias" },
  PROBLEMAS:  { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", icon: "✗", label: "Problemas detectados" },
};

const NIVEL_CFG = {
  CRITICO:    { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", label: "CRÍTICO"     },
  ADVERTENCIA:{ bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "ADVERTENCIA" },
};

const MODULO_ICON = {
  actualizacion_obras:   "✏️",
  alcances:              "📋",
  informacion_general:   "📄",
  cobertura:             "📊",
  utopias:               "🏗️",
  geoestadistica:        "🗺️",
};

/* ── Tarjeta de módulo ── */
function ModuloCard({ modulo }) {
  const cfg = ESTADO_CFG[modulo.error ? "ERROR" : modulo.estado] || ESTADO_CFG.DISPONIBLE;
  const icon = MODULO_ICON[modulo.id] || "⬡";

  return (
    <div className="rounded-2xl p-4 transition-all"
      style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-2xl shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#1e293b" }}>
              {modulo.nombre}
            </p>
            {modulo.detalle && (
              <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{modulo.detalle}</p>
            )}
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
          <span style={{ marginRight: 4 }}>●</span>{cfg.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2.5 text-xs" style={{ color: "#94a3b8" }}>
        {modulo.ultima_actividad && (
          <span>
            <span className="font-semibold" style={{ color: "#64748b" }}>Última act.:</span>{" "}
            {modulo.ultima_actividad}
          </span>
        )}
        {modulo.ultimo_usuario && (
          <span>
            <span className="font-semibold" style={{ color: "#64748b" }}>Usuario:</span>{" "}
            {modulo.ultimo_usuario}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Fila de validación de integridad ── */
function ValidacionRow({ val, expandida, onToggle }) {
  const cfg   = NIVEL_CFG[val.nivel] || NIVEL_CFG.ADVERTENCIA;
  const ok    = val.total === 0;
  const hasMuestra = val.muestra?.length > 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ok ? "#e2e8f0" : cfg.border}` }}>
      <button type="button"
        onClick={() => hasMuestra && onToggle(val.clave)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ backgroundColor: ok ? "#f8fafc" : cfg.bg,
          cursor: hasMuestra ? "pointer" : "default", border: "none" }}>
        <span className="text-sm font-bold shrink-0"
          style={{ color: ok ? "#15803d" : cfg.text }}>
          {ok ? "✓" : "✗"}
        </span>
        <span className="flex-1 text-sm font-semibold" style={{ color: ok ? "#15803d" : "#1e293b" }}>
          {val.label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!ok && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
          )}
          <span className="text-sm font-black"
            style={{ color: ok ? "#15803d" : cfg.text }}>
            {val.total.toLocaleString("es-MX")}
          </span>
          {hasMuestra && (
            <span className="text-xs" style={{ color: "#94a3b8" }}>
              {expandida ? "▲" : "▼"}
            </span>
          )}
        </div>
      </button>
      {expandida && hasMuestra && (
        <div className="px-4 pb-3 pt-1" style={{ backgroundColor: "#fafafa" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#64748b" }}>
            Registros afectados ({val.muestra.length}{val.total > val.muestra.length ? ` de ${val.total.toLocaleString("es-MX")}` : ""}):
          </p>
          <div className="space-y-1.5">
            {val.muestra.map((item, i) => (
              <div key={i} className="rounded-lg overflow-hidden"
                style={{ border: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
                <div className="flex items-start gap-2 px-2.5 py-2 text-xs">
                  <span className="font-mono shrink-0 mt-0.5" style={{ color: "#94a3b8", minWidth: "3rem" }}>
                    id:{item.id ?? "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-snug" style={{ color: "#1e293b" }}>
                      {item.nombre_obra || item.clave_unica || "—"}
                    </p>
                    {(item.programa || item.alcaldia) && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: "#64748b" }}>
                        {[item.programa, item.alcaldia].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                    {item.ocurrencias && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                        ×{item.ocurrencias} duplicado{item.ocurrencias > 2 ? "s" : ""}
                      </span>
                    )}
                    {item.tabla && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: "#e2e8f0", color: "#475569" }}>
                        {item.tabla.replace("obras_", "")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {val.total > val.muestra.length && (
            <p className="text-xs mt-2" style={{ color: "#94a3b8" }}>
              … y {(val.total - val.muestra.length).toLocaleString("es-MX")} registros más sin mostrar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   PANEL — Modos de cálculo de avance por programa
════════════════════════════════════════════════ */
function ProgramasModoPanel() {
  const [programas,   setProgramas]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [confirmando, setConfirmando] = useState(null); // { programa, modo }
  const [aplicando,   setAplicando]   = useState(null); // programa en proceso
  const [feedback,    setFeedback]    = useState({});   // { [programa]: { ok, msg } }
  const timeoutRef = useRef({});

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await estadoOperativoAPI.getProgramasModo();
      setProgramas(r.programas || []);
    } catch (e) {
      setError(e.message || "Error al cargar programas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const iniciarCambio = (programa, modoActual) => {
    const nuevoModo = modoActual === "FRENTES" ? "GENERAL" : "FRENTES";
    setConfirmando({ programa, modo: nuevoModo });
  };

  const confirmarCambio = async () => {
    if (!confirmando) return;
    const { programa, modo } = confirmando;
    setConfirmando(null);
    setAplicando(programa);
    try {
      const r = await estadoOperativoAPI.setProgramaModo(programa, modo);
      const msg = `${r.obras_actualizadas} obra${r.obras_actualizadas !== 1 ? "s" : ""} → ${modo}`;
      setFeedback((p) => ({ ...p, [programa]: { ok: true, msg } }));
      await cargar();
    } catch (e) {
      setFeedback((p) => ({ ...p, [programa]: { ok: false, msg: e.message } }));
    } finally {
      setAplicando(null);
      // limpiar feedback después de 4s
      clearTimeout(timeoutRef.current[programa]);
      timeoutRef.current[programa] = setTimeout(
        () => setFeedback((p) => { const n = { ...p }; delete n[programa]; return n; }),
        4000
      );
    }
  };

  if (loading) return (
    <div className="py-6 text-center text-xs" style={{ color: "#94a3b8" }}>Cargando programas…</div>
  );
  if (error) return (
    <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}>
      {error}
    </div>
  );

  return (
    <>
      {/* Diálogo de confirmación */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm font-bold mb-1" style={{ color: "#1e293b" }}>
              ¿Cambiar modo del programa?
            </p>
            <p className="text-xs mb-1" style={{ color: "#64748b" }}>
              <span className="font-semibold">{confirmando.programa}</span>
            </p>
            <p className="text-xs mb-4" style={{ color: "#64748b" }}>
              Todas las obras de este programa pasarán a modo{" "}
              <span className="font-bold" style={{ color: confirmando.modo === "FRENTES" ? "#1D4ED8" : "#475569" }}>
                {confirmando.modo}
              </span>.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmando(null)}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                Cancelar
              </button>
              <button
                onClick={confirmarCambio}
                className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
                style={{ backgroundColor: confirmando.modo === "FRENTES" ? "#1D4ED8" : "#475569" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
        Cambia el modo de cálculo de avance para todas las obras de un programa de una sola vez.
        Modo <strong>FRENTES</strong>: el avance se calcula como promedio ponderado de los frentes en frentes_obra.
        Modo <strong>GENERAL</strong>: cada obra tiene su propio avance independiente.
      </p>

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
        {/* Header tabla */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: "#f8fafc", color: "#94a3b8", borderBottom: `1px solid ${T.border}` }}>
          <span className="col-span-5">Programa</span>
          <span className="col-span-2 text-center">Total obras</span>
          <span className="col-span-2 text-center">Modo actual</span>
          <span className="col-span-3 text-center">Acción</span>
        </div>

        {programas.length === 0 && (
          <div className="px-4 py-6 text-center text-xs" style={{ color: "#94a3b8" }}>
            No se encontraron programas.
          </div>
        )}

        {programas.map((p, i) => {
          const modoActual = p.n_frentes > 0 && p.n_general === 0 ? "FRENTES"
            : p.n_frentes === 0 ? "GENERAL"
            : "MIXTO";
          const fb = feedback[p.programa];
          const enProceso = aplicando === p.programa;

          return (
            <div key={p.programa}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
              style={{
                borderBottom: i < programas.length - 1 ? `1px solid ${T.border}` : "none",
                backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafafa",
              }}>

              {/* Nombre */}
              <div className="col-span-5 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#1e293b" }}>
                  {p.programa}
                </p>
                {fb && (
                  <p className="text-[10px] mt-0.5 font-medium"
                    style={{ color: fb.ok ? "#15803d" : "#b91c1c" }}>
                    {fb.ok ? "✓" : "✗"} {fb.msg}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="col-span-2 text-center">
                <span className="text-xs font-bold" style={{ color: "#334155" }}>{p.total}</span>
              </div>

              {/* Modo badge */}
              <div className="col-span-2 text-center">
                {modoActual === "FRENTES" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                    FRENTES
                  </span>
                )}
                {modoActual === "GENERAL" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                    GENERAL
                  </span>
                )}
                {modoActual === "MIXTO" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                    MIXTO ({p.n_frentes}F/{p.n_general}G)
                  </span>
                )}
              </div>

              {/* Acción */}
              <div className="col-span-3 flex justify-center gap-1.5">
                {enProceso ? (
                  <span className="text-[10px] text-gray-400">Aplicando…</span>
                ) : (
                  <>
                    {modoActual !== "FRENTES" && (
                      <button
                        onClick={() => iniciarCambio(p.programa, modoActual)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                        → FRENTES
                      </button>
                    )}
                    {modoActual !== "GENERAL" && (
                      <button
                        onClick={() => iniciarCambio(p.programa, modoActual)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                        → GENERAL
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════ */
export default function EstadoOperativo() {
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN";

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [expandidas, setExpandidas] = useState({});

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await estadoOperativoAPI.getEstado();
      setData(r);
    } catch (e) {
      setError(e.message || "Error al cargar el estado operativo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) cargar(); }, [cargar, isAdmin]);

  /* Auto-expandir filas con problemas al cargar datos */
  useEffect(() => {
    if (!data) return;
    const autoExpand = {};
    data.integridad.validaciones.forEach((v) => {
      if (v.total > 0 && v.muestra?.length > 0) autoExpand[v.clave] = true;
    });
    setExpandidas(autoExpand);
  }, [data]);

  const toggleExpandida = (clave) =>
    setExpandidas((p) => ({ ...p, [clave]: !p[clave] }));

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
        <div className="flex flex-1"><Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-red-600">
              Acceso restringido — Solo ADMIN.
            </p>
          </main>
        </div><Footer />
      </div>
    );
  }

  const intCfg = data ? INTEGRIDAD_CFG[data.integridad?.resumen] || INTEGRIDAD_CFG.INTEGRA : null;
  const modulosOk = data ? data.modulos.filter((m) => !m.error && m.estado === "DISPONIBLE").length : 0;
  const modulosTotal = data ? data.modulos.length : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-5xl mx-auto w-full">

          {/* Hero */}
          <div className="rounded-2xl px-5 py-4 mb-5"
            style={{ background: T.heroBg, border: "1px solid rgba(0,0,0,0.15)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] font-semibold"
                  style={{ color: "rgba(255,255,255,0.55)" }}>
                  Panel Administrativo · SICOPS/SIG-SOBSE
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white">
                  🖥️ Centro de Estado Operativo
                </h1>
                {data && (
                  <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Generado el {data.generado_en}
                  </p>
                )}
              </div>
              <button type="button" onClick={cargar} disabled={loading}
                className="text-sm font-semibold px-4 py-2 rounded-xl shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.28)", cursor: loading ? "wait" : "pointer" }}>
                {loading ? "Actualizando…" : "↺ Actualizar"}
              </button>
            </div>
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#334155", borderTopColor: "transparent" }} />
            </div>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          {data && (
            <>
              {/* ── Indicadores rápidos ── */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {/* Sistema */}
                <div className="rounded-2xl p-4 text-center"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "#94a3b8" }}>Sistema</p>
                  <p className="text-lg font-black"
                    style={{ color: data.sistema.activo ? "#15803d" : "#b91c1c" }}>
                    {data.sistema.activo ? "● ABIERTO" : "● CERRADO"}
                  </p>
                </div>
                {/* Semana */}
                <div className="rounded-2xl p-4 text-center"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "#94a3b8" }}>Semana</p>
                  <p className="text-lg font-black" style={{ color: "#1e293b" }}>
                    {data.sistema.semana ? `${data.sistema.semana} · ${data.sistema.anio}` : "—"}
                  </p>
                </div>
                {/* Módulos */}
                <div className="rounded-2xl p-4 text-center"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "#94a3b8" }}>Módulos</p>
                  <p className="text-lg font-black"
                    style={{ color: modulosOk === modulosTotal ? "#15803d" : "#d97706" }}>
                    {modulosOk} / {modulosTotal} OK
                  </p>
                </div>
              </div>

              {/* ── Módulos operativos ── */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "#94a3b8" }}>Módulos Operativos</p>
                  <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
                </div>
                <div className="space-y-2">
                  {data.modulos.map((m) => (
                    <ModuloCard key={m.id} modulo={m} />
                  ))}
                </div>
              </div>

              {/* ── Modos de cálculo de avance ── */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "#94a3b8" }}>Modos de Cálculo de Avance</p>
                  <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
                </div>
                <ProgramasModoPanel />
              </div>

              {/* ── Integridad de datos ── */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "#94a3b8" }}>Integridad de Datos</p>
                  <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
                  {intCfg && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: intCfg.bg, color: intCfg.text,
                        border: `1px solid ${intCfg.border}` }}>
                      {intCfg.icon} {intCfg.label}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
                  Validación automática sobre obras_puntos · obras_lineas · obras_poligonos.
                  Haz clic en una fila con problemas para ver la muestra.
                </p>
                <div className="space-y-2">
                  {data.integridad.validaciones.map((val) => (
                    <ValidacionRow key={val.clave} val={val}
                      expandida={!!expandidas[val.clave]}
                      onToggle={toggleExpandida} />
                  ))}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
      <Footer />
    </div>
  );
}
