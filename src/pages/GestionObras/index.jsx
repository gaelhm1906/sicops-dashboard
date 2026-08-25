/**
 * pages/GestionObras/index.jsx
 * Módulo: Gestión Controlada de Obras — ROL_GEOESTADISTICA
 *
 * Jerarquía: SEGUIMIENTO → PROGRAMA → ESTATUS → OBRAS
 * Carga única (limit 2000), filtrado client-side, acordeones expandibles.
 * Sin paginación — idéntico al patrón de Actualizar Obras y Agregar Alcances.
 */
import React, { useState, useCallback, useMemo, useEffect, memo } from "react";
import Sidebar               from "../../components/Layout/Sidebar";
import Footer                from "../../components/Layout/Footer";
import { useAuth }           from "../../context/AuthContext";
import { geoestadisticaAPI } from "../../utils/api";
import FormularioAlta        from "./FormularioAlta";
import ImportacionCSV        from "./ImportacionCSV";
import BajaLogicaModal       from "./BajaLogicaModal";
import RegistroAuditoria     from "./RegistroAuditoria";
import ModalEdicion          from "./ModalEdicion";

/* ── Paleta ── */
const T = {
  pageBg:     "linear-gradient(180deg, #f0f4f8 0%, #e8ecf0 100%)",
  heroBg:     "linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)",
  accent:     "#2563eb",
  accentDark: "#1e40af",
  title:      "#1e293b",
  subtitle:   "#475569",
  border:     "rgba(37,99,235,0.14)",
};

/* ── Normalización de estatus (idéntico a AgregarAlcances) ── */
function normalizarEstatus(estatus) {
  const s = String(estatus || "").toUpperCase().trim();
  if (s === "EN PROCESO")                              return "EN PROCESO";
  if (s === "TERMINADA" || s === "TERMINADO")          return "TERMINADA";
  if (s.includes("INAUGUR") || s.includes("ENTREGAD")) return "INAUGURADA";
  if (s === "CANCELADA"  || s === "CANCELADO")         return "CANCELADO";
  return "SIN INICIAR";
}

const GRUPOS_ESTATUS = [
  { key: "EN PROCESO",  label: "En proceso",  color: "#d97706", bg: "#fffbeb", border: "#fde68a"  },
  { key: "SIN INICIAR", label: "Sin iniciar", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb"  },
  { key: "TERMINADA",   label: "Terminadas",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0"  },
  { key: "INAUGURADA",  label: "Inauguradas", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe"  },
  { key: "CANCELADO",   label: "Canceladas",  color: "#b91c1c", bg: "#fff1f2", border: "#fecdd3"  },
];

const TIPO_ICON  = { PUNTO: "⬤", LINEA: "—", POLIGONO: "⬡" };
const TIPO_COLOR = { PUNTO: "#3b82f6", LINEA: "#8b5cf6", POLIGONO: "#10b981" };

function CountBadge({ n, color = "#2563eb", bg = "#eff6ff", border = "#bfdbfe" }) {
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}>
      {n}
    </span>
  );
}

/* ── ObraCard ── */
const ObraCard = memo(function ObraCard({ obra, onBaja, onReactivar, onAudit, onEditar, isGeo }) {
  const inactiva  = obra.estatus_registro === "INACTIVO";
  const tipoIcon  = TIPO_ICON[obra.tipo_geometria]  || "○";
  const tipoColor = TIPO_COLOR[obra.tipo_geometria] || "#94a3b8";

  return (
    <div className="rounded-xl p-3"
      style={{ backgroundColor: "#ffffff",
        border: `1px solid ${inactiva ? "#fecaca" : "rgba(37,99,235,0.12)"}`,
        boxShadow: "0 1px 4px rgba(37,99,235,0.05)", opacity: inactiva ? 0.85 : 1 }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {inactiva && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                INACTIVA
              </span>
            )}
            <span title={obra.tipo_geometria} style={{ color: tipoColor, fontSize: 11 }}>{tipoIcon}</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
              {obra.clave_unica}
            </span>
          </div>
          <p className="text-sm font-bold leading-snug" style={{ color: T.title }} title={obra.nombre_obra}>
            {obra.nombre_obra || "SIN NOMBRE"}
          </p>
        </div>
        <div className="flex gap-1 shrink-0 flex-col items-end">
          {isGeo && (
            <button type="button" onClick={() => onEditar(obra)}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
              style={{ backgroundColor: "#fefce8", color: "#854d0e",
                border: "1px solid #fef08a", cursor: "pointer", whiteSpace: "nowrap" }}>
              ✏ Editar
            </button>
          )}
          <button type="button" onClick={() => onAudit(obra.clave_unica)}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{ backgroundColor: "#eff6ff", color: "#2563eb",
              border: "1px solid #bfdbfe", cursor: "pointer" }}>
            Auditoría
          </button>
          {!inactiva ? (
            <button type="button" onClick={() => onBaja(obra)}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
              style={{ backgroundColor: "#fef2f2", color: "#b91c1c",
                border: "1px solid #fecaca", cursor: "pointer" }}>
              Dar de baja
            </button>
          ) : (
            <button type="button" onClick={() => onReactivar(obra)}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
              style={{ backgroundColor: "#f0fdf4", color: "#15803d",
                border: "1px solid #86efac", cursor: "pointer" }}>
              Reactivar
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: T.subtitle }}>
        {obra.dg && (
          <span><span className="font-semibold">DG:</span> {obra.dg}</span>
        )}
        {obra.seguimiento && obra.seguimiento !== obra.dg && (
          <span><span className="font-semibold">Seg:</span> {obra.seguimiento}</span>
        )}
        {obra.alcaldia && (
          <span><span className="font-semibold">Alc:</span> {obra.alcaldia}</span>
        )}
        {obra.tipo && (
          <span><span className="font-semibold">Tipo:</span> {obra.tipo}</span>
        )}
      </div>
    </div>
  );
});

/* ── Grupo de estatus (tercer nivel) ── */
const GrupoEstatus = memo(function GrupoEstatus({
  config, obras, onBaja, onReactivar, onAudit, onEditar, isGeo
}) {
  const [open, setOpen] = useState(false);
  if (!obras.length) return null;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${config.border}` }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: config.bg, border: "none", cursor: "pointer" }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-bold uppercase tracking-widest flex-1 text-left"
          style={{ color: config.color }}>{config.label}</span>
        <CountBadge n={obras.length} color={config.color} bg={config.bg} border={config.border} />
        <span className="text-xs font-bold ml-1" style={{ color: config.color }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1.5" style={{ backgroundColor: "#fafafa" }}>
          {obras.map((o) => (
            <ObraCard key={o.clave_unica}
              obra={o} onBaja={onBaja} onReactivar={onReactivar}
              onAudit={onAudit} onEditar={onEditar} isGeo={isGeo} />
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Acordeón de programa (segundo nivel) ── */
function ProgramaAccordion({
  programa, obras, progKey, abierto, onToggle,
  onBaja, onReactivar, onAudit, onEditar, isGeo
}) {
  const grupos = useMemo(() => {
    const map = {};
    for (const o of obras) {
      const k = normalizarEstatus(o.estatus);
      if (!map[k]) map[k] = [];
      map[k].push(o);
    }
    return map;
  }, [obras]);

  const inactivas = obras.filter((o) => o.estatus_registro === "INACTIVO").length;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(37,99,235,0.16)", backgroundColor: "#ffffff",
        boxShadow: "0 2px 8px rgba(37,99,235,0.05)" }}>
      <button type="button" onClick={() => onToggle(progKey)}
        className="w-full text-left px-4 py-2.5"
        style={{ background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
          border: "none", cursor: "pointer" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.accent }}>
              Programa
            </p>
            <h3 className="mt-0.5 text-sm font-bold truncate" style={{ color: T.title }}>{programa}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CountBadge n={`${obras.length} obras`} />
            {inactivas > 0 && (
              <CountBadge n={`${inactivas} inact.`} color="#b91c1c" bg="#fef2f2" border="#fecaca" />
            )}
            <span className="text-xs font-bold" style={{ color: T.accent }}>
              {abierto === progKey ? "−" : "+"}
            </span>
          </div>
        </div>
      </button>
      {abierto === progKey && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t"
          style={{ borderColor: "rgba(37,99,235,0.12)" }}>
          {GRUPOS_ESTATUS.map((cfg) => (
            <GrupoEstatus key={cfg.key} config={cfg} obras={grupos[cfg.key] || []}
              onBaja={onBaja} onReactivar={onReactivar}
              onAudit={onAudit} onEditar={onEditar} isGeo={isGeo} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Acordeón de seguimiento (primer nivel) ── */
function SeguimientoAccordion({
  seg, obras, dgAbierto, onToggleDg,
  programaAbierto, onTogglePrograma,
  onBaja, onReactivar, onAudit, onEditar, isGeo
}) {
  const porPrograma = useMemo(() => {
    const map = {};
    for (const o of obras) {
      const p = o.programa || "SIN PROGRAMA";
      if (!map[p]) map[p] = [];
      map[p].push(o);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [obras]);

  const activas   = obras.filter((o) => (o.estatus_registro || "ACTIVO") === "ACTIVO").length;
  const inactivas = obras.length - activas;
  const isOpen    = dgAbierto === seg;

  return (
    <section className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(37,99,235,0.20)", backgroundColor: "#ffffff",
        boxShadow: "0 4px 16px rgba(37,99,235,0.08)" }}>
      <button type="button" onClick={() => onToggleDg(seg)}
        className="w-full text-left px-4 py-3"
        style={{ background: T.heroBg, color: "#f0f9ff", border: "none", cursor: "pointer" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">Seguimiento</p>
            <h2 className="mt-0.5 text-base font-bold truncate">{seg}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className="text-xs text-white/70">
              {porPrograma.length} prog. · {obras.length} obras
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(22,101,52,0.35)", color: "#86efac" }}>
              {activas} activas
            </span>
            {inactivas > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(185,28,28,0.30)", color: "#fca5a5" }}>
                {inactivas} inact.
              </span>
            )}
            <span className="text-white/80 font-bold text-lg">{isOpen ? "−" : "+"}</span>
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="p-3 space-y-2"
          style={{ background: "linear-gradient(180deg, #f0f4f8 0%, #e8ecf0 100%)" }}>
          {porPrograma.map(([prog, obrasP]) => {
            const progKey = `${seg}::${prog}`;
            return (
              <ProgramaAccordion key={progKey} programa={prog} obras={obrasP}
                progKey={progKey} abierto={programaAbierto} onToggle={onTogglePrograma}
                onBaja={onBaja} onReactivar={onReactivar}
                onAudit={onAudit} onEditar={onEditar} isGeo={isGeo} />
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════ */
export default function GestionObras() {
  const { user } = useAuth();
  const isGeo    = user?.rol === "GEOESTADISTICA" || user?.rol === "ADMIN";

  /* ── Carga única de TODAS las obras ── */
  const [todasObras,  setTodasObras]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  /* ── Filtros client-side ── */
  const [busqueda,    setBusqueda]    = useState("");
  const [filtEstatus, setFiltEstatus] = useState("");  /* '' | 'ACTIVO' | 'INACTIVO' */

  /* ── Acordeones ── */
  const [dgAbierto,       setDgAbierto]       = useState(null);
  const [programaAbierto, setProgramaAbierto] = useState(null);

  /* ── Modales ── */
  const [showAlta,        setShowAlta]        = useState(false);
  const [showImportacion, setShowImportacion] = useState(false);
  const [bajaObra,   setBajaObra]   = useState(null);
  const [showAudit,  setShowAudit]  = useState(false);
  const [auditClave, setAuditClave] = useState(null);
  const [editObra,   setEditObra]   = useState(null);

  /* ── Carga única al montar — sin paginación ── */
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await geoestadisticaAPI.getObras({ limit: 2000 });
      setTodasObras(r.data || []);
    } catch (e) {
      setError(e.message || "Error al cargar obras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isGeo) cargar(); }, [cargar, isGeo]);

  /* ── Filtrado client-side instantáneo ── */
  const obrasFiltradas = useMemo(() => {
    let lista = todasObras;
    if (filtEstatus) {
      lista = lista.filter((o) => (o.estatus_registro || "ACTIVO") === filtEstatus);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter((o) =>
        (o.nombre_obra   || "").toLowerCase().includes(q) ||
        (o.clave_unica   || "").toLowerCase().includes(q) ||
        (o.programa      || "").toLowerCase().includes(q) ||
        (o.alcaldia      || "").toLowerCase().includes(q)
      );
    }
    return lista;
  }, [todasObras, filtEstatus, busqueda]);

  /* ── Agrupación SEGUIMIENTO → PROGRAMA (client-side) ── */
  const porSeguimiento = useMemo(() => {
    const map = {};
    for (const o of obrasFiltradas) {
      const seg = o.seguimiento || o.dg || "SIN SEGUIMIENTO";
      if (!map[seg]) map[seg] = [];
      map[seg].push(o);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [obrasFiltradas]);

  /* ── Contadores de resumen ── */
  const totalActivas   = useMemo(() => obrasFiltradas.filter((o) => (o.estatus_registro || "ACTIVO") === "ACTIVO").length, [obrasFiltradas]);
  const totalInactivas = obrasFiltradas.length - totalActivas;

  /* ── Callbacks ── */
  const handleToggleDg   = useCallback((seg) => setDgAbierto((p)  => p === seg ? null : seg), []);
  const handleToggleProg = useCallback((k)   => setProgramaAbierto((p) => p === k ? null : k), []);
  const handleBaja       = useCallback((obra)  => setBajaObra(obra), []);
  const handleAudit      = useCallback((clave) => { setAuditClave(clave); setShowAudit(true); }, []);
  const handleEditar     = useCallback((obra)  => setEditObra(obra), []);

  const handleReactivar = useCallback(async (obra) => {
    if (!window.confirm(`¿Reactivar "${obra.nombre_obra}"?`)) return;
    try {
      await geoestadisticaAPI.reactivarObra(obra.clave_unica, { motivo: "Reactivación manual" });
      cargar();
    } catch (e) { alert(e.message || "Error al reactivar."); }
  }, [cargar]);

  if (!isGeo) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
        <div className="flex flex-1"><Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-red-600">
              Acceso restringido — Solo ROL_GEOESTADISTICA y ADMIN.
            </p>
          </main>
        </div><Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.pageBg }}>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto w-full">

          {/* Hero */}
          <div className="rounded-2xl px-5 py-4 mb-4"
            style={{ background: T.heroBg, border: "1px solid rgba(37,99,235,0.24)",
              boxShadow: "0 16px 34px rgba(37,99,235,0.18)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] font-semibold"
                  style={{ color: "rgba(219,234,254,0.72)" }}>
                  Gestión Controlada · Módulo Geoestadística
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white">🗺️ Gestión de Obras</h1>
                {!loading && (
                  <p className="mt-0.5 text-xs" style={{ color: "rgba(219,234,254,0.78)" }}>
                    {obrasFiltradas.length.toLocaleString("es-MX")} obras
                    {obrasFiltradas.length < todasObras.length && ` (filtradas de ${todasObras.length.toLocaleString("es-MX")})`}
                    {" · "}{porSeguimiento.length} seguimientos
                    {totalInactivas > 0 && ` · ${totalInactivas} inactivas`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setShowAlta(true)}
                  className="text-sm font-bold px-4 py-2 rounded-xl"
                  style={{ backgroundColor: "#ffffff", color: T.accentDark,
                    border: "1px solid rgba(255,255,255,0.8)", cursor: "pointer" }}>
                  + Nueva Obra
                </button>
                <button type="button" onClick={() => setShowImportacion(true)}
                  className="text-sm font-semibold px-4 py-2 rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.28)", cursor: "pointer" }}>
                  ⬆ Importar CSV
                </button>
                <button type="button" onClick={() => { setAuditClave(null); setShowAudit(true); }}
                  className="text-sm font-semibold px-4 py-2 rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.28)", cursor: "pointer" }}>
                  📋 Auditoría
                </button>
              </div>
            </div>
          </div>

          {/* Filtros — client-side, instantáneos */}
          <div className="rounded-2xl px-4 py-3 mb-4"
            style={{ backgroundColor: "#ffffff", border: `1px solid ${T.border}`,
              boxShadow: "0 2px 12px rgba(37,99,235,0.07)" }}>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="text" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, clave, programa o alcaldía…"
                className="flex-1 min-w-[240px] px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ border: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }} />
              <select value={filtEstatus}
                onChange={(e) => setFiltEstatus(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border focus:outline-none"
                style={{ border: "1px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                <option value="">Activas e inactivas</option>
                <option value="ACTIVO">Solo activas</option>
                <option value="INACTIVO">Solo inactivas</option>
              </select>
              {(busqueda || filtEstatus) && (
                <button type="button"
                  onClick={() => { setBusqueda(""); setFiltEstatus(""); }}
                  className="px-3 py-2 text-xs font-semibold rounded-xl"
                  style={{ backgroundColor: "#f1f5f9", color: T.subtitle,
                    border: "1px solid #e2e8f0", cursor: "pointer" }}>
                  ✕ Limpiar
                </button>
              )}
              {!loading && busqueda && (
                <span className="text-xs" style={{ color: T.subtitle }}>
                  {obrasFiltradas.length} resultado{obrasFiltradas.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 mb-3 text-sm font-medium"
              style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          {/* Contenido jerárquico */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: T.accent, borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: T.subtitle }}>Cargando obras…</p>
            </div>
          ) : obrasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-sm rounded-2xl"
              style={{ backgroundColor: "#ffffff", border: `1px solid ${T.border}`, color: T.subtitle }}>
              {todasObras.length === 0
                ? "No hay obras registradas."
                : "No se encontraron obras con los filtros actuales."}
            </div>
          ) : (
            <div className="space-y-3">
              {porSeguimiento.map(([seg, obrasD]) => (
                <SeguimientoAccordion key={seg} seg={seg} obras={obrasD}
                  dgAbierto={dgAbierto} onToggleDg={handleToggleDg}
                  programaAbierto={programaAbierto} onTogglePrograma={handleToggleProg}
                  onBaja={handleBaja} onReactivar={handleReactivar}
                  onAudit={handleAudit} onEditar={handleEditar} isGeo={isGeo} />
              ))}
            </div>
          )}

        </main>
      </div>
      <Footer />

      {showAlta && (
        <FormularioAlta onClose={() => setShowAlta(false)}
          onSuccess={() => { setShowAlta(false); cargar(); }} />
      )}
      {showImportacion && (
        <ImportacionCSV
          onClose={() => setShowImportacion(false)}
          onSuccess={() => cargar()} />
      )}
      {bajaObra && (
        <BajaLogicaModal obra={bajaObra}
          onClose={() => setBajaObra(null)}
          onSuccess={() => { setBajaObra(null); cargar(); }} />
      )}
      {showAudit && (
        <RegistroAuditoria clave={auditClave}
          onClose={() => { setShowAudit(false); setAuditClave(null); }} />
      )}
      {editObra && (
        <ModalEdicion obra={editObra}
          onClose={() => setEditObra(null)}
          onSuccess={() => { setEditObra(null); cargar(); }} />
      )}
    </div>
  );
}
