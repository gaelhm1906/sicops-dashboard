import React, { useState, useMemo, useCallback, memo, useRef } from "react";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import ModalAlcances    from "../components/Modal/ModalAlcances";
import ModalInfoGeneral from "../components/Modal/ModalInfoGeneral";
import { useObras } from "../context/ObraContext";
import { useAuth }  from "../context/AuthContext";
import { estadoLabel, colorHexAvance } from "../utils/formatters";
import { infoGeneralAPI } from "../utils/api";

const ALCANCES_THEME = {
  pageBg:     "linear-gradient(180deg, #eef6f1 0%, #e4efe8 100%)",
  heroBg:     "linear-gradient(135deg, #0f5132 0%, #166534 52%, #2f7d57 100%)",
  heroBorder: "1px solid rgba(26, 99, 67, 0.24)",
  heroShadow: "0 16px 34px rgba(15,81,50,0.18)",
  panelBg:    "#f8fcf9",
  panelBorder:"1px solid rgba(39, 104, 72, 0.14)",
  panelShadow:"0 10px 26px rgba(15,81,50,0.08)",
  cardBg:     "linear-gradient(180deg, #ffffff 0%, #f4faf6 100%)",
  cardBorder: "1px solid rgba(28, 92, 61, 0.16)",
  cardShadow: "0 8px 20px rgba(18, 74, 48, 0.06)",
  softBg:     "#edf7f0",
  softBorder: "1px solid rgba(47, 109, 74, 0.12)",
  title:      "#0f3d29",
  subtitle:   "#4f6b5a",
  accent:     "#166534",
  accentStrong:"#0f5132",
  accentSoft: "#dcefe3",
  inputBg:    "#f4fbf6",
  inputBorder:"#bfd8c7",
  inputText:  "#193a2a",
  statBg:     "rgba(255,255,255,0.18)",
  statBorder: "1px solid rgba(255,255,255,0.20)",
};

function getObraKey(obra, index) {
  return `${obra.direccion_general || "sin-dir"}-${obra.programa || "sin-prog"}-${obra.id_obra || obra.id || index}`;
}

function getProgramaResumen(obras) {
  const total = obras.length;
  const est   = (o) => String(o.estatus || o.estado || "").toUpperCase();
  const terminadas = obras.filter((o) => {
    const estado = est(o);
    return estado === "TERMINADA" || estado === "TERMINADO" || estado === "INAUGURADA" || estado === "ENTREGADO";
  }).length;
  const promedio = total > 0
    ? Math.round(obras.reduce((acc, o) => acc + Number(o.avance_real ?? o.avance ?? o.porcentaje ?? 0), 0) / total)
    : 0;
  return { total, actualizadas: terminadas, promedio };
}

function normalizarEstatus(estatus) {
  const s = String(estatus || "").toUpperCase().trim();
  if (s === "EN PROCESO")  return "EN PROCESO";
  if (s === "TERMINADA" || s === "TERMINADO") return "TERMINADA";
  if (s.includes("INAUGUR") || s.includes("ENTREGAD")) return "INAUGURADA";
  if (s === "CANCELADA"  || s === "CANCELADO") return "CANCELADO";
  return "SIN INICIAR";
}

function getReferenciaGeneral(obra, direccionVisible) {
  return [
    obra.alcaldia || null,
    obra.colonia   || null,
    direccionVisible || obra.dg || obra.direccion_general || null,
  ].filter(Boolean).join(" • ");
}

/* ── Botón indicador de Información General ── */
function BtnInfoGeneral({ capturaInfo, onClick }) {
  const [hovered, setHovered] = useState(false);

  /* capturaInfo = null → aún no cargado (mostrar sin contador) */
  /* capturaInfo.total = 0 → sin indicadores configurados (ocultar) */
  if (capturaInfo !== null && capturaInfo !== undefined && capturaInfo.total === 0) return null;

  let dotColor = "#9ca3af";   // gris — sin datos / no cargado
  let btnBg    = "#4b5563";
  let btnHover = "#374151";
  let counter  = "";

  if (capturaInfo && capturaInfo.total > 0) {
    const { capturados, total } = capturaInfo;
    counter = ` ${capturados}/${total}`;
    if (capturados === 0) {
      dotColor = "#ef4444"; btnBg = "#7f1d1d"; btnHover = "#6b1212";
    } else if (capturados < total) {
      dotColor = "#f59e0b"; btnBg = "#78350f"; btnHover = "#633009";
    } else {
      dotColor = "#22c55e"; btnBg = "#14532d"; btnHover = "#0f3d29";
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="shrink-0 text-sm font-semibold px-3 py-2 rounded-xl transition-colors w-full lg:w-auto flex items-center justify-center gap-1.5"
      style={{
        backgroundColor: hovered ? btnHover : btnBg,
        color:  "#fff",
        border: "1px solid rgba(0,0,0,0.12)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: hovered ? "0 10px 18px rgba(0,0,0,0.18)" : "0 6px 14px rgba(0,0,0,0.12)",
      }}
    >
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        backgroundColor: dotColor, flexShrink: 0 }} />
      Información General{counter}
    </button>
  );
}

/* ════════════════════════════════════════════════
   ObraCardAlcances
════════════════════════════════════════════════ */
const ObraCardAlcances = memo(function ObraCardAlcances({
  obra, onAbrirAlcances, onAbrirInfoGeneral, capturaInfo, direccionVisible,
}) {
  const estatus   = estadoLabel(obra.estatus || obra.estado);
  const avance    = Number(obra.avance_real ?? obra.avance ?? obra.porcentaje ?? 0);
  const referencia= getReferenciaGeneral(obra, direccionVisible);

  return (
    <div
      className="rounded-xl p-3 transition-all duration-200"
      style={{ background: ALCANCES_THEME.cardBg, border: ALCANCES_THEME.cardBorder, boxShadow: ALCANCES_THEME.cardShadow }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`badge ${estatus.clase} text-xs font-semibold`}>
              {estatus.icono} {estatus.label}
            </span>
            {obra.clave_unica && (
              <span className="text-xs font-mono font-bold shrink-0 px-2 py-0.5 rounded"
                style={{ backgroundColor: "#e8f4ec", color: "#21543a", border: "1px solid rgba(33,84,58,0.24)" }}>
                {obra.clave_unica}
              </span>
            )}
          </div>

          <p className="font-semibold text-sm leading-snug" style={{ color: ALCANCES_THEME.title }}>
            {obra.nombre_obra || obra.nombre || "SIN NOMBRE"}
          </p>
          {referencia && (
            <p className="mt-0.5 text-xs" style={{ color: ALCANCES_THEME.subtitle }}>{referencia}</p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: "6px", backgroundColor: "#dcebe2" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${avance}%`, backgroundColor: colorHexAvance(avance) }} />
            </div>
            <span className="text-xs font-bold shrink-0" style={{ color: ALCANCES_THEME.accentStrong }}>{avance}%</span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-1.5 lg:flex-row shrink-0">
          {/* Alcances */}
          <button
            type="button"
            onClick={() => onAbrirAlcances(obra)}
            className="shrink-0 text-sm font-semibold px-3 py-2 rounded-xl transition-colors w-full lg:w-auto"
            style={{
              backgroundColor: "#166534", color: "#fff",
              border: "1px solid rgba(18,74,48,0.18)", cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 6px 14px rgba(15,81,50,0.12)",
            }}
          >
            📋 Alcances
          </button>

          {/* Información General */}
          {onAbrirInfoGeneral && (
            <BtnInfoGeneral capturaInfo={capturaInfo} onClick={() => onAbrirInfoGeneral(obra)} />
          )}
        </div>
      </div>
    </div>
  );
});

const GRUPOS_ESTATUS_CONFIG = [
  { key: "EN PROCESO",  label: "En proceso",  color: "#d97706", bg: "#fffbeb", border: "#fde68a",  defaultOpen: false },
  { key: "SIN INICIAR", label: "Sin iniciar", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb",  defaultOpen: false },
  { key: "TERMINADA",   label: "Terminadas",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",  defaultOpen: false },
  { key: "INAUGURADA",  label: "Inauguradas", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",  defaultOpen: false },
  { key: "CANCELADO",   label: "Canceladas",  color: "#b91c1c", bg: "#fff1f2", border: "#fecdd3",  defaultOpen: false },
];

const GrupoEstatus = memo(function GrupoEstatus({ config, obras, obraCardProps }) {
  const [expanded, setExpanded] = useState(config.defaultOpen);
  if (obras.length === 0) return null;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${config.border}` }}>
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: config.bg, cursor: "pointer", border: "none" }}
        aria-expanded={expanded}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-bold uppercase tracking-widest flex-1 text-left" style={{ color: config.color }}>
          {config.label}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: config.color, color: "#fff" }}>{obras.length}</span>
        <span className="text-xs font-bold ml-1 shrink-0" style={{ color: config.color }}>
          {expanded ? "−" : "+"}
        </span>
      </button>
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="space-y-1.5 p-2 transition-opacity duration-200"
            style={{ backgroundColor: "#f6fbf8", opacity: expanded ? 1 : 0 }}>
            {obras.map((obra, index) => (
              <ObraCardAlcances key={getObraKey(obra, index)} obra={obra} {...obraCardProps(obra)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function ListaObrasPorEstatus({ obras, obraCardProps }) {
  const grupos = useMemo(() => {
    const map = {};
    for (const obra of obras) {
      const key = normalizarEstatus(obra.estatus || obra.estado);
      if (!map[key]) map[key] = [];
      map[key].push(obra);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) =>
        Number(b.avance_real ?? b.avance ?? b.porcentaje ?? 0) -
        Number(a.avance_real ?? a.avance ?? a.porcentaje ?? 0)
      );
    }
    return map;
  }, [obras]);
  return (
    <div className="pt-2 space-y-1.5">
      {GRUPOS_ESTATUS_CONFIG.map((config) => (
        <GrupoEstatus key={config.key} config={config} obras={grupos[config.key] || []} obraCardProps={obraCardProps} />
      ))}
    </div>
  );
}

function ProgramaAccordion({ programaKey, prog, programaAbierto, togglePrograma, obraCardProps }) {
  return (
    <section className="rounded-2xl overflow-hidden"
      style={{ border: ALCANCES_THEME.softBorder, backgroundColor: "#ffffff", boxShadow: "0 8px 18px rgba(15,81,50,0.05)" }}>
      <button type="button"
        onClick={() => togglePrograma(programaKey, prog.obras, prog.programa)}
        className="w-full text-left px-4 py-3"
        style={{ background: "linear-gradient(180deg, #edf7f0 0%, #ffffff 100%)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ALCANCES_THEME.accent }}>Programa</p>
            <h3 className="mt-0.5 text-sm font-bold truncate" style={{ color: ALCANCES_THEME.title }}>{prog.programa}</h3>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: ALCANCES_THEME.accent }}>
            <span>{prog.resumen.total} obras · {prog.resumen.promedio}%</span>
            <span className="font-bold">{programaAbierto === programaKey ? "−" : "+"}</span>
          </div>
        </div>
      </button>
      {programaAbierto === programaKey && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: "rgba(22,101,52,0.12)" }}>
          <ListaObrasPorEstatus obras={prog.obras} obraCardProps={obraCardProps} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════════ */
export default function AgregarAlcances() {
  const { obrasRaw, obras, loading } = useObras();
  const { user }  = useAuth();
  const base      = obrasRaw || obras;

  const [busqueda,       setBusqueda]       = useState("");
  const [alcancesObra,   setAlcancesObra]   = useState(null);
  const [infoGeneralObra,setInfoGeneralObra]= useState(null);
  const [dgAbierta,      setDgAbierta]      = useState(null);
  const [programaAbierto,setProgramaAbierto]= useState(null);
  const [capturaMap,     setCapturaMap]     = useState({});   // { [clave_unica]: { capturados, total } }
  const loadedRef = useRef(new Set());                        // programaKeys ya cargados (sin re-render)

  const searchMode   = busqueda.trim().length > 0;
  const vistaPorDG   = !user?.dg;

  const resultadosBusqueda = useMemo(() => {
    if (!searchMode) return [];
    const q = busqueda.toLowerCase().trim();
    return base.filter((o) =>
      (o.nombre_obra || o.nombre || "").toLowerCase().includes(q) ||
      (o.programa    || "").toLowerCase().includes(q) ||
      (o.clave_unica || "").toLowerCase().includes(q) ||
      (o.alcaldia    || "").toLowerCase().includes(q)
    );
  }, [base, busqueda, searchMode]);

  const groupedData = useMemo(() => {
    if (searchMode) return {};
    return base.reduce((acc, obra) => {
      const dir  = obra.direccion_general || "SIN DIRECCION";
      const prog = obra.programa          || "SIN PROGRAMA";
      if (!acc[dir])       acc[dir]       = {};
      if (!acc[dir][prog]) acc[dir][prog] = [];
      acc[dir][prog].push(obra);
      return acc;
    }, {});
  }, [base, searchMode]);

  const direcciones = useMemo(() => {
    if (searchMode) return [];
    return Object.entries(groupedData)
      .map(([direccion, programasMap]) => {
        const programas = Object.entries(programasMap)
          .map(([programa, obrasPrograma]) => ({
            programa,
            obras: obrasPrograma,
            resumen: getProgramaResumen(obrasPrograma),
          }))
          .sort((a, b) => a.programa.localeCompare(b.programa));
        return { direccion, programas,
          totalObras:    programas.reduce((a, p) => a + p.obras.length, 0),
          totalProgramas: programas.length };
      })
      .sort((a, b) => a.direccion.localeCompare(b.direccion));
  }, [groupedData, searchMode]);

  const programasDeUsuario = useMemo(() => {
    if (searchMode || vistaPorDG) return [];
    return Object.entries(groupedData)
      .flatMap(([, programasMap]) =>
        Object.entries(programasMap).map(([programa, obrasPrograma]) => ({
          programa, obras: obrasPrograma, resumen: getProgramaResumen(obrasPrograma),
        }))
      )
      .sort((a, b) => a.programa.localeCompare(b.programa));
  }, [groupedData, searchMode, vistaPorDG]);

  /* ── Carga lazy de contadores por programa ── */
  const cargarCaptura = useCallback(async (key, obras, programa) => {
    if (!obras.length || loadedRef.current.has(key)) return;
    loadedRef.current.add(key);
    const isOA = programa === "OBRAS ADICIONALES";

    console.time(`[InfoGeneral] cargarCaptura ${key} (${obras.length} obras)`);
    try {
      if (!isOA) {
        /* 1 llamada para el catálogo del programa */
        console.time(`[InfoGeneral] getCatalogo ${programa}`);
        const catalogRes = await infoGeneralAPI.getCatalogo(programa);
        console.timeEnd(`[InfoGeneral] getCatalogo ${programa}`);
        const total = (catalogRes.data || []).length;

        if (total === 0) {
          /* Sin indicadores → ocultar el botón para todas las obras */
          setCapturaMap((prev) => {
            const next = { ...prev };
            for (const o of obras) { if (o.clave_unica) next[o.clave_unica] = { capturados: 0, total: 0 }; }
            return next;
          });
          return;
        }

        /* 1 llamada batch en lugar de N — reemplaza el Promise.all anterior */
        const claves = obras.map((o) => o.clave_unica).filter(Boolean);
        console.time(`[InfoGeneral] conteos batch ${claves.length} claves`);
        const conteosRes = await infoGeneralAPI.conteos(claves);
        console.timeEnd(`[InfoGeneral] conteos batch ${claves.length} claves`);
        const conteosMap = conteosRes.data || {};

        setCapturaMap((prev) => {
          const next = { ...prev };
          for (const o of obras) {
            if (!o.clave_unica) continue;
            next[o.clave_unica] = { capturados: conteosMap[o.clave_unica] ?? 0, total };
          }
          return next;
        });

      } else {
        /* OBRAS ADICIONALES: catálogo específico por area (nombre_obra).
           Cantidad pequeña de obras → se mantiene el Promise.all original. */
        const results = await Promise.all(
          obras.map(async (o) => {
            if (!o.clave_unica) return null;
            const nombre = o.nombre_obra || o.nombre || "";
            try {
              const [catR, obraR] = await Promise.all([
                infoGeneralAPI.getCatalogo("OBRAS ADICIONALES", nombre),
                infoGeneralAPI.getObra(o.clave_unica),
              ]);
              const total = (catR.data  || []).length;
              const cap   = (obraR.data || []).filter((d) => d.valor !== null || d.valor_texto !== null).length;
              return { clave: o.clave_unica, capturados: cap, total };
            } catch { return { clave: o.clave_unica, capturados: 0, total: 0 }; }
          })
        );

        setCapturaMap((prev) => {
          const next = { ...prev };
          for (const r of results) { if (r) next[r.clave] = { capturados: r.capturados, total: r.total }; }
          return next;
        });
      }
    } catch { /* silently ignore */ }
    finally {
      console.timeEnd(`[InfoGeneral] cargarCaptura ${key} (${obras.length} obras)`);
    }
  }, []);

  const toggleDg = useCallback((direccion) => {
    setDgAbierta((prev) => (prev === direccion ? null : direccion));
    setProgramaAbierto(null);
  }, []);

  const togglePrograma = useCallback((key, obras = [], programa = "") => {
    setProgramaAbierto((prev) => {
      const opening = prev !== key;
      if (opening) cargarCaptura(key, obras, programa);
      return opening ? key : null;
    });
  }, [cargarCaptura]);

  /* Cierre del modal: refrescar contador de esa obra */
  const handleCloseInfoGeneral = useCallback(async () => {
    const obra = infoGeneralObra;
    setInfoGeneralObra(null);
    if (!obra?.clave_unica) return;
    const isOA   = obra.programa === "OBRAS ADICIONALES";
    const nombre = obra.nombre_obra || obra.nombre || "";
    try {
      const [catR, obraR] = await Promise.all([
        infoGeneralAPI.getCatalogo(obra.programa, isOA ? nombre : undefined),
        infoGeneralAPI.getObra(obra.clave_unica),
      ]);
      const total = (catR.data  || []).length;
      const cap   = (obraR.data || []).filter((d) => d.valor !== null || d.valor_texto !== null).length;
      setCapturaMap((prev) => ({ ...prev, [obra.clave_unica]: { capturados: cap, total } }));
    } catch { /* silently ignore */ }
  }, [infoGeneralObra]);

  const buildObraCardProps = useCallback((obra) => ({
    onAbrirAlcances:    setAlcancesObra,
    onAbrirInfoGeneral: setInfoGeneralObra,
    capturaInfo:        capturaMap[obra.clave_unica] ?? null,
    direccionVisible:   obra.direccion_general,
  }), [capturaMap]);

  const buildObraCardPropsDG = useCallback((obra) => ({
    onAbrirAlcances:    setAlcancesObra,
    onAbrirInfoGeneral: setInfoGeneralObra,
    capturaInfo:        capturaMap[obra.clave_unica] ?? null,
    direccionVisible:   user?.dg || obra.direccion_general,
  }), [capturaMap, user?.dg]);

  const totalTarjetaSecundaria = vistaPorDG ? base.length : programasDeUsuario.length;
  const sinResultados          = vistaPorDG ? direcciones.length === 0 : programasDeUsuario.length === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ALCANCES_THEME.pageBg }}>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto w-full">

          {/* Hero */}
          <div className="mb-4">
            <div className="rounded-2xl px-5 py-4"
              style={{ background: ALCANCES_THEME.heroBg, border: ALCANCES_THEME.heroBorder, boxShadow: ALCANCES_THEME.heroShadow }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "rgba(230,247,236,0.72)" }}>
                    Flujo de Actualizacion · Alcances operativos
                  </p>
                  <h1 className="mt-1 text-2xl lg:text-3xl font-bold" style={{ color: "#ffffff" }}>
                    📌 Agregar Alcances
                  </h1>
                  <p className="mt-0.5 text-xs" style={{ color: "rgba(239,249,243,0.78)" }}>
                    {user?.dg
                      ? `${base.length} obras · DG ${user.dg}`
                      : `${base.length} obras · ${direcciones.length} direcciones generales`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="rounded-xl px-3 py-2"
                    style={{ backgroundColor: ALCANCES_THEME.statBg, border: ALCANCES_THEME.statBorder, backdropFilter: "blur(6px)" }}>
                    <p className="text-xs" style={{ color: "rgba(235,248,240,0.76)" }}>{user?.dg ? "Direccion" : "Direcciones"}</p>
                    <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{user?.dg || direcciones.length}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2"
                    style={{ backgroundColor: ALCANCES_THEME.statBg, border: ALCANCES_THEME.statBorder, backdropFilter: "blur(6px)" }}>
                    <p className="text-xs" style={{ color: "rgba(235,248,240,0.76)" }}>{user?.dg ? "Programas" : "Obras"}</p>
                    <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{totalTarjetaSecundaria}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="rounded-2xl px-4 py-3 mb-4"
            style={{ backgroundColor: ALCANCES_THEME.panelBg, border: ALCANCES_THEME.panelBorder, boxShadow: ALCANCES_THEME.panelShadow }}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none" style={{ color: "#6f8a79" }}>🔍</span>
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, programa, clave o alcaldia..."
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166634]"
                style={{ border: `1px solid ${ALCANCES_THEME.inputBorder}`, backgroundColor: ALCANCES_THEME.inputBg, color: ALCANCES_THEME.inputText }} />
              {busqueda && (
                <button type="button" onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                  style={{ color: "#6f8a79", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              )}
            </div>
            {searchMode && (
              <p className="text-xs mt-2" style={{ color: ALCANCES_THEME.subtitle }}>
                {resultadosBusqueda.length === 0
                  ? `Sin resultados para "${busqueda}"`
                  : `${resultadosBusqueda.length} resultado${resultadosBusqueda.length !== 1 ? "s" : ""} para "${busqueda}"`}
              </p>
            )}
          </div>

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#166534", borderTopColor: "transparent" }} />
            </div>
          ) : searchMode ? (
            resultadosBusqueda.length === 0 ? (
              <div className="text-center py-14 rounded-3xl shadow-md"
                style={{ color: ALCANCES_THEME.subtitle, border: ALCANCES_THEME.panelBorder, backgroundColor: "#fbfefc", boxShadow: ALCANCES_THEME.panelShadow }}>
                No se encontraron obras con esa búsqueda.
              </div>
            ) : (
              <ListaObrasPorEstatus obras={resultadosBusqueda} obraCardProps={buildObraCardProps} />
            )
          ) : sinResultados ? (
            <div className="text-center py-14 text-sm rounded-3xl shadow-md"
              style={{ color: ALCANCES_THEME.subtitle, border: ALCANCES_THEME.panelBorder, backgroundColor: "#fbfefc", boxShadow: ALCANCES_THEME.panelShadow }}>
              No se encontraron obras disponibles para alcances.
            </div>
          ) : (
            <div className="space-y-3">
              {vistaPorDG && direcciones.map((dir) => (
                <section key={dir.direccion} className="rounded-2xl overflow-hidden shadow-md"
                  style={{ border: ALCANCES_THEME.panelBorder, backgroundColor: "#ffffff", boxShadow: ALCANCES_THEME.panelShadow }}>
                  <button type="button" onClick={() => toggleDg(dir.direccion)}
                    className="w-full text-left px-4 py-3"
                    style={{ background: "linear-gradient(135deg, #0f5132 0%, #166534 58%, #2f7d57 100%)", color: "#f5fff8" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Direccion General</p>
                        <h2 className="mt-0.5 text-base lg:text-lg font-bold truncate">{dir.direccion}</h2>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-white/70">{dir.totalProgramas} prog. · {dir.totalObras} obras</span>
                        <span className="text-white/80 font-bold text-lg">{dgAbierta === dir.direccion ? "−" : "+"}</span>
                      </div>
                    </div>
                  </button>
                  {dgAbierta === dir.direccion && (
                    <div className="p-3 space-y-2" style={{ background: "linear-gradient(180deg, #f6fbf8 0%, #edf6f0 100%)" }}>
                      {dir.programas.map((prog) => {
                        const programaKey = `${dir.direccion}::${prog.programa}`;
                        return (
                          <ProgramaAccordion key={programaKey} programaKey={programaKey} prog={prog}
                            programaAbierto={programaAbierto} togglePrograma={togglePrograma}
                            obraCardProps={buildObraCardProps} />
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}

              {!vistaPorDG && programasDeUsuario.map((prog) => {
                const programaKey = `dg::${prog.programa}`;
                return (
                  <ProgramaAccordion key={programaKey} programaKey={programaKey} prog={prog}
                    programaAbierto={programaAbierto} togglePrograma={togglePrograma}
                    obraCardProps={buildObraCardPropsDG} />
                );
              })}
            </div>
          )}
        </main>
      </div>
      <Footer />

      <ModalAlcances
        open={!!alcancesObra}
        obra={alcancesObra}
        onClose={() => setAlcancesObra(null)}
      />

      <ModalInfoGeneral
        open={!!infoGeneralObra}
        obra={infoGeneralObra}
        onClose={handleCloseInfoGeneral}
      />
    </div>
  );
}
