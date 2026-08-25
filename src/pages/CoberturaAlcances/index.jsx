/**
 * pages/CoberturaAlcances/index.jsx
 * Panel admin: DG → Programa → Obras (OBRAS ADICIONALES agrega nivel AREA).
 * Solo accesible para ADMIN.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Sidebar from "../../components/Layout/Sidebar";
import Footer  from "../../components/Layout/Footer";
import { useAuth }              from "../../context/AuthContext";
import { useObras }             from "../../context/ObraContext";
import { coberturaAPI }         from "../../utils/api";
import ModalConsultaAlcances    from "../../components/Modal/ModalConsultaAlcances";
import ReporteCoberturaModal    from "./ReporteCobertura";
import ReporteDGModal           from "./ReporteDGModal";
import ReporteBalon             from "./ReporteBalon";

/* ── Colores turquesa profesional (panel, KPIs) ── */
const TC = {
  primary:     "#0e7490",
  primaryDark: "#0c4a63",
  primarySoft: "#cffafe",
  primaryPale: "#ecfeff",
  border:      "rgba(14,116,144,0.16)",
};

/* ── Helpers ── */
function fmtFecha(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* Agrupa obras por seguimiento (un nivel) */
function groupByDG(obras) {
  const result = {};
  for (const r of obras) {
    const dg = r.dg || "SIN SEGUIMIENTO";
    if (!result[dg]) result[dg] = [];
    result[dg].push(r);
  }
  return result;
}

/* Agrupa obras por programa (dentro de un DG ya conocido) */
function groupByPrograma(obras) {
  const result = {};
  for (const r of obras) {
    const prog = r.programa || "SIN PROGRAMA";
    if (!result[prog]) result[prog] = [];
    result[prog].push(r);
  }
  return result;
}

/* ── Exportar CSV ── */
function exportCSV(data, filename) {
  const headers = ["CLAVE_UNICA","NOMBRE_OBRA","PROGRAMA","DG","ALCALDIA","AREA",
                   "TOTAL_ALCANCES","TIPO_OBRA","ULTIMA_CAPTURA","ULTIMO_USUARIO"];
  const filas = data.map((r) => [
    r.clave_unica, r.nombre_obra, r.programa, r.dg, r.alcaldia, r.area || "",
    r.total_alcances, r.tipo_alcance_obra || "",
    r.ultima_captura ? new Date(r.ultima_captura).toLocaleDateString("es-MX") : "",
    r.ultimo_usuario || "",
  ]);
  const csv = [headers.join(","), ...filas.map((f) =>
    f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── KPI chip ── */
function KpiChip({ label, value, color, sub }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col"
      style={{ background: "#fff", border: TC.border, boxShadow: "0 2px 8px rgba(14,116,144,0.07)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#94a3b8" }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: color || TC.primary }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{sub}</p>}
    </div>
  );
}

/* ── Badge tipo obra ── */
function TipoBadge({ tipo }) {
  if (!tipo) return null;
  const c = tipo === "PROYECTADO"
    ? { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
    : { bg: "#f0fdf4", color: "#166534", border: "#86efac" };
  return (
    <span style={{ display:"inline-block", fontSize:"0.625rem", fontWeight:700, padding:"2px 7px",
      borderRadius:"999px", backgroundColor:c.bg, color:c.color, border:`1px solid ${c.border}`,
      textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {tipo}
    </span>
  );
}

/* ── Fila de obra CON alcances (clickeable) ── */
function ObraConRow({ obra, onClick, inArea = false }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 cursor-pointer group"
      style={{ border: "1px solid rgba(14,116,144,0.14)", backgroundColor: "#fff",
        boxShadow: "0 1px 4px rgba(14,116,144,0.05)", transition: "box-shadow 0.15s, border-color 0.15s" }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(14,116,144,0.35)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(14,116,144,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(14,116,144,0.14)"; e.currentTarget.style.boxShadow="0 1px 4px rgba(14,116,144,0.05)"; }}
    >
      <div className="flex-1 min-w-0">
        {/* Si está dentro de un acordeón de área, nombre_obra ya aparece en el header — mostrar solo clave */}
        {!inArea && (
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight group-hover:text-[#0e7490]"
            title={obra.nombre_obra} style={{ transition:"color 0.15s" }}>
            {obra.nombre_obra || "—"}
          </p>
        )}
        <p className={`font-mono ${inArea ? "text-sm font-semibold text-gray-700" : "text-xs mt-0.5"}`}
          style={{ color: inArea ? "#1e293b" : "#94a3b8" }}>
          {obra.clave_unica || "—"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <TipoBadge tipo={obra.tipo_alcance_obra} />
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor:"rgba(14,116,144,0.10)", color:TC.primary, border:`1px solid ${TC.border}` }}>
          {obra.total_alcances} alcances
        </span>
        {obra.ultima_captura && (
          <span className="text-xs hidden sm:inline" style={{ color:"#94a3b8" }}>{fmtFecha(obra.ultima_captura)}</span>
        )}
        {obra.ultimo_usuario && (
          <span className="text-xs font-medium hidden md:inline truncate max-w-[120px]" style={{ color:"#64748b" }}>
            {obra.ultimo_usuario}
          </span>
        )}
        <span className="text-xs font-bold ml-1" style={{ color: TC.primary }}>›</span>
      </div>
    </div>
  );
}

/* ── Fila de obra SIN alcances ── */
function ObraSinRow({ obra }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5"
      style={{ border:"1px solid rgba(239,68,68,0.14)", backgroundColor:"#fff", boxShadow:"0 1px 4px rgba(239,68,68,0.04)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate leading-tight" title={obra.nombre_obra}>
          {obra.nombre_obra || "—"}
        </p>
        <p className="text-xs font-mono mt-0.5" style={{ color:"#94a3b8" }}>{obra.clave_unica || "—"}</p>
      </div>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor:"#fee2e2", color:"#991b1b", border:"1px solid #fecaca" }}>
        0 alcances
      </span>
    </div>
  );
}

/* ── Acordeón de AREA (solo OBRAS ADICIONALES) ── */
function AreaAccordion({ areaKey, area, obras, tipo, areaAbierta, onToggleArea, onObraClick }) {
  const isOpen = areaAbierta === areaKey;
  return (
    <div className="rounded-xl overflow-hidden mb-1.5"
      style={{ border:`1px solid ${TC.border}`, backgroundColor:"#fff" }}>
      <button type="button" onClick={() => onToggleArea(areaKey)}
        className="w-full flex items-center gap-2 px-4 py-2.5"
        style={{ background:`linear-gradient(180deg, rgba(14,116,144,0.07) 0%, #fff 100%)`, border:"none", cursor:"pointer" }}>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:TC.primary }}>Área</p>
          <h4 className="mt-0.5 text-sm font-bold truncate" style={{ color:"#1e293b" }}>{area || "SIN ÁREA"}</h4>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: tipo==="con" ? "rgba(14,116,144,0.10)" : "rgba(239,68,68,0.10)",
            color: tipo==="con" ? TC.primary : "#991b1b", border:`1px solid ${tipo==="con" ? TC.border : "rgba(239,68,68,0.20)"}` }}>
          {obras.length} obras
        </span>
        <span className="text-sm font-bold shrink-0" style={{ color:TC.primary }}>{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="px-3 pt-1.5 pb-2.5" style={{ backgroundColor:"#f8fbfc" }}>
          {obras.map((obra) =>
            tipo === "con"
              ? <ObraConRow key={obra.clave_unica} obra={obra} inArea onClick={() => onObraClick(obra)} />
              : <ObraSinRow key={obra.clave_unica} obra={obra} />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Acordeón de Programa ── */
function ProgramaAccordion({ progKey, programa, obras, tipo, programaAbierto, onTogglePrograma, areaAbierta, onToggleArea, onObraClick }) {
  const isOpen = programaAbierto === progKey;
  const isObrasAdicionales = programa === "OBRAS ADICIONALES";

  /* Agrupar por nombre_obra si es OBRAS ADICIONALES.
     En este programa nombre_obra actúa como identificador de área
     (varias obras pueden compartir el mismo nombre representando el mismo sub-proyecto). */
  const byArea = useMemo(() => {
    if (!isObrasAdicionales) return null;
    const result = {};
    for (const r of obras) {
      const a = r.nombre_obra || "SIN ÁREA";
      if (!result[a]) result[a] = [];
      result[a].push(r);
    }
    return result;
  }, [obras, isObrasAdicionales]);

  return (
    <section className="rounded-2xl overflow-hidden mb-1.5"
      style={{ border:"1px solid rgba(201,166,107,0.28)", backgroundColor:"#fff" }}>
      <button type="button" onClick={() => onTogglePrograma(progKey)}
        className="w-full flex items-center gap-2 px-4 py-3"
        style={{ background:"linear-gradient(180deg, rgba(201,166,107,0.12) 0%, #fff 100%)", border:"none", cursor:"pointer" }}>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#8C6B41" }}>Programa</p>
          <h3 className="mt-0.5 text-sm font-bold truncate" style={{ color:"#2C2C2C" }}>{programa}</h3>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: tipo==="con" ? "rgba(22,101,52,0.10)" : "rgba(239,68,68,0.10)",
            color: tipo==="con" ? "#166534" : "#991b1b",
            border:`1px solid ${tipo==="con" ? "rgba(22,101,52,0.20)" : "rgba(239,68,68,0.20)"}` }}>
          {obras.length} obras
        </span>
        <span className="text-sm font-bold shrink-0" style={{ color:"#8C6B41" }}>{isOpen ? "−" : "+"}</span>
      </button>
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-3 pt-2 pb-3" style={{ backgroundColor:"#fafafa", opacity: isOpen ? 1 : 0, transition:"opacity 0.2s" }}>
            {isObrasAdicionales && byArea ? (
              /* OBRAS ADICIONALES: nivel adicional AREA */
              Object.entries(byArea).sort(([a],[b]) => a.localeCompare(b)).map(([area, obrasPorArea]) => {
                const areaKey = `${progKey}::${area}`;
                return (
                  <AreaAccordion key={areaKey} areaKey={areaKey} area={area}
                    obras={obrasPorArea} tipo={tipo}
                    areaAbierta={areaAbierta} onToggleArea={onToggleArea}
                    onObraClick={onObraClick} />
                );
              })
            ) : (
              /* Otros programas: directamente las obras */
              obras.map((obra) =>
                tipo === "con"
                  ? <ObraConRow key={obra.clave_unica} obra={obra} onClick={() => onObraClick(obra)} />
                  : <ObraSinRow key={obra.clave_unica} obra={obra} />
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mini divider interno (dentro de un acordeón de seguimiento) ── */
function MiniDivider({ label, count, color }) {
  return (
    <div className="flex items-center gap-2 my-2 px-1">
      <div className="flex-1 h-px" style={{ backgroundColor: `${color}25` }} />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor:`${color}12`, color, border:`1px solid ${color}28` }}>
        {label} · {count}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: `${color}25` }} />
    </div>
  );
}

const SEG_DG_BALON = "DGPEST";
/* Comparación sin tildes — cubre "EL BALON..." y "EL BALÓN..." */
function esProgramaBalon(prog) {
  return String(prog || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .includes("BALON VUELVE AL BARRIO");
}

/* ── Acordeón de Seguimiento — UNA tarjeta por DG con Con/Sin adentro ── */
function SeguimientoAccordion({ dg, obras, dgAbierta, onToggleDG, programaAbierto, onTogglePrograma, areaAbierta, onToggleArea, onObraClick, onReporteDG, onReporteBalon }) {
  const isOpen = dgAbierta === dg;

  /* Obras de EL BALÓN VUELVE AL BARRIO — para el botón especial */
  const obrasBalonAll = useMemo(() => {
    if (dg !== SEG_DG_BALON) return [];
    return obras.filter((o) => esProgramaBalon(o.programa));
  }, [dg, obras]);

  const conAlcances = useMemo(() => obras.filter((o) => o.tiene_alcances),  [obras]);
  const sinAlcances = useMemo(() => obras.filter((o) => !o.tiene_alcances), [obras]);

  const coberturaPct = obras.length
    ? parseFloat(((conAlcances.length / obras.length) * 100).toFixed(1))
    : 0;

  const groupedCon = useMemo(() => groupByPrograma(conAlcances), [conAlcances]);
  const groupedSin = useMemo(() => groupByPrograma(sinAlcances), [sinAlcances]);

  const programasCon = useMemo(() => Object.entries(groupedCon).sort(([a],[b]) => a.localeCompare(b)), [groupedCon]);
  const programasSin = useMemo(() => Object.entries(groupedSin).sort(([a],[b]) => a.localeCompare(b)), [groupedSin]);

  const totalProgramas = useMemo(
    () => new Set([...Object.keys(groupedCon), ...Object.keys(groupedSin)]).size,
    [groupedCon, groupedSin],
  );

  /* Color del badge de cobertura */
  const cobColor = coberturaPct >= 70 ? "#15803D" : coberturaPct >= 40 ? "#d97706" : "#b91c1c";
  const cobBg    = coberturaPct >= 70 ? "rgba(22,101,52,0.18)" : coberturaPct >= 40 ? "rgba(217,119,6,0.18)" : "rgba(185,28,28,0.18)";

  return (
    <section className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border:"1px solid rgba(201,166,107,0.20)", backgroundColor:"#fff" }}>

      {/* ── Cabecera burdeos ── */}
      <button type="button" onClick={() => onToggleDG(dg)}
        className="w-full text-left px-4 py-3"
        style={{ background:"linear-gradient(135deg, #691C32 0%, #7E2843 60%, #4F0E21 100%)", border:"none", cursor:"pointer", color:"#FFF8F1" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"rgba(255,248,241,0.60)" }}>Seguimiento</p>
            <h2 className="mt-0.5 text-base font-bold truncate">{dg}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className="text-xs" style={{ color:"rgba(255,248,241,0.70)" }}>
              {totalProgramas} prog. · {obras.length} obras
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor:"rgba(22,101,52,0.35)", color:"#86efac" }}>
              {conAlcances.length} ✓
            </span>
            {sinAlcances.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor:"rgba(239,68,68,0.30)", color:"#fca5a5" }}>
                {sinAlcances.length} ✗
              </span>
            )}
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: cobBg, color: cobColor }}>
              {coberturaPct}%
            </span>
            {onReporteDG && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onReporteDG(dg); }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.28)", cursor:"pointer", whiteSpace:"nowrap" }}>
                📄 Reporte
              </button>
            )}
            {obrasBalonAll.length > 0 && onReporteBalon && (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onReporteBalon(obrasBalonAll); }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor:"rgba(6,95,70,0.55)", color:"#d1fae5", border:"1px solid rgba(110,231,183,0.50)", cursor:"pointer", whiteSpace:"nowrap" }}>
                ⚽ Por DG Responsable
              </button>
            )}
            <span className="text-lg font-bold" style={{ color:"rgba(255,248,241,0.80)" }}>{isOpen ? "−" : "+"}</span>
          </div>
        </div>
      </button>

      {/* ── Cuerpo expandible ── */}
      {isOpen && (
        <div className="px-3 pt-2 pb-3" style={{ background:"linear-gradient(180deg, #FFFDFC 0%, #F7F3EE 100%)" }}>

          {/* CON ALCANCES */}
          {conAlcances.length > 0 && (
            <>
              <MiniDivider label="Con alcances" count={conAlcances.length} color="#166534" />
              <div className="space-y-1 mb-1">
                {programasCon.map(([programa, obrasP]) => {
                  const progKey = `con::${dg}::${programa}`;
                  return (
                    <ProgramaAccordion key={progKey} progKey={progKey} programa={programa} obras={obrasP} tipo="con"
                      programaAbierto={programaAbierto} onTogglePrograma={onTogglePrograma}
                      areaAbierta={areaAbierta} onToggleArea={onToggleArea}
                      onObraClick={onObraClick} />
                  );
                })}
              </div>
            </>
          )}

          {/* SIN ALCANCES */}
          {sinAlcances.length > 0 && (
            <>
              <MiniDivider label="Sin alcances" count={sinAlcances.length} color="#b91c1c" />
              <div className="space-y-1">
                {programasSin.map(([programa, obrasP]) => {
                  const progKey = `sin::${dg}::${programa}`;
                  return (
                    <ProgramaAccordion key={progKey} progKey={progKey} programa={programa} obras={obrasP} tipo="sin"
                      programaAbierto={programaAbierto} onTogglePrograma={onTogglePrograma}
                      areaAbierta={areaAbierta} onToggleArea={onToggleArea}
                      onObraClick={onObraClick} />
                  );
                })}
              </div>
            </>
          )}

          {conAlcances.length === 0 && sinAlcances.length === 0 && (
            <p className="text-center py-4 text-xs" style={{ color:"#94a3b8" }}>Sin obras para los filtros seleccionados.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Separador de sección ── */
function SectionDivider({ label, count, color, borderColor }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
      <span className="text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full shrink-0"
        style={{ backgroundColor:`${color}18`, color, border:`1px solid ${color}30` }}>
        {label} ({count})
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: borderColor }} />
    </div>
  );
}

/* ════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════ */
export default function CoberturaAlcances() {
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN" || user?.role === "admin";

  /* Modal reporte global */
  const [reporteOpen, setReporteOpen] = useState(false);

  /* Modal reporte por DG */
  const [reporteDGOpen,   setReporteDGOpen]   = useState(false);
  const [reporteDGNombre, setReporteDGNombre] = useState(null);
  const [reporteDGObras,  setReporteDGObras]  = useState([]);

  /* Modal reporte Balón — exclusivo para EL BALÓN VUELVE AL BARRIO */
  const [reporteBalonOpen,  setReporteBalonOpen]  = useState(false);
  const [reporteBalonObras, setReporteBalonObras] = useState([]);

  /* Ref para leer dataFiltrada sincrónicamente al hacer click
     (evita condición de carrera con useEffect) */
  const dataFiltradaRef = React.useRef([]);

  const abrirReporteDG = useCallback((dg) => {
    /* Filtrar obras usando el ref — acceso síncrono sin depender del orden de hooks */
    setReporteDGObras(dataFiltradaRef.current.filter((o) => o.dg === dg));
    setReporteDGNombre(dg);
    setReporteDGOpen(true);
  }, []);

  const abrirReporteBalon = useCallback((obrasDelPrograma) => {
    setReporteBalonObras(obrasDelPrograma);
    setReporteBalonOpen(true);
  }, []);

  /* ── Obras desde ObraContext — MISMA FUENTE que Actualizar Obras y Agregar Alcances ── */
  const {
    obrasRaw, obras: obrasCtx,
    loading: loadingObras, error: errorObras, refreshObras,
  } = useObras();

  /* ── Mapa de alcances — solo lee alcances_obras (sin tablas de obras) ── */
  const [alcancesMapa,    setAlcancesMapa]    = useState({});
  const [loadingAlcances, setLoadingAlcances] = useState(true);
  const [errorAlcances,   setErrorAlcances]   = useState(null);

  const loading = loadingObras || loadingAlcances;
  const error   = errorObras   || errorAlcances;

  const fetchAlcances = useCallback(async () => {
    setLoadingAlcances(true); setErrorAlcances(null);
    try {
      const r = await coberturaAPI.getAlcancesMapa();
      setAlcancesMapa(r.data || {});
    } catch (e) {
      setErrorAlcances(e.message || "Error al cargar alcances.");
    } finally {
      setLoadingAlcances(false);
    }
  }, []);

  useEffect(() => { fetchAlcances(); }, [fetchAlcances]);

  const fetchData = useCallback(() => {
    fetchAlcances();
    refreshObras?.();
  }, [fetchAlcances, refreshObras]);

  /* ── Universo unificado — mismas obras que Actualizar Obras / Agregar Alcances ──
     obra.dg = obra.direccion_general = SEGUIMIENTO correcto desde ObraContext.
     KPIs calculados sobre este mismo array → conteos idénticos en los 3 módulos. */
  const data = useMemo(() => {
    const base = obrasRaw || obrasCtx || [];
    return base
      .filter((o) => o.clave_unica)
      .map((o) => {
        const clave = String(o.clave_unica).trim();
        const info  = alcancesMapa[clave];
        return {
          clave_unica:      clave,
          nombre_obra:      o.nombre_obra || o.nombre || "SIN NOMBRE",
          programa:         o.programa    || "SIN PROGRAMA",
          dg:               o.direccion_general || o.dg || "SIN SEGUIMIENTO",
          dg_responsable:   o.dg_responsable || null,
          alcaldia:         o.alcaldia    || "",
          area:             "",
          tiene_alcances:   !!info,
          total_alcances:   info?.total_alcances   || 0,
          total_conceptos:  info?.total_conceptos  || 0,
          ultima_captura:   info?.ultima_captura   || null,
          ultimo_usuario:   info?.ultimo_usuario   || null,
          tipo_alcance_obra:info?.tipo_alcance     || null,
        };
      });
  }, [obrasRaw, obrasCtx, alcancesMapa]);

  /* Filtros */
  const [busqueda,     setBusqueda]     = useState("");
  const [filtPrograma, setFiltPrograma] = useState("");
  const [filtDG,       setFiltDG]       = useState("");
  const [filtAlcaldia, setFiltAlcaldia] = useState("");
  const [filtTipo,     setFiltTipo]     = useState("");

  /* Acordeones */
  const [dgAbierta,       setDgAbierta]       = useState(null);
  const [programaAbierto, setProgramaAbierto] = useState(null);
  const [areaAbierta,     setAreaAbierta]     = useState(null);

  /* Modal detalle */
  const [obraConsulta, setObraConsulta] = useState(null);

  const toggleDg      = useCallback((d) => { setDgAbierta((p) => p === d ? null : d); setProgramaAbierto(null); setAreaAbierta(null); }, []);
  const togglePrograma= useCallback((k) => { setProgramaAbierto((p) => p === k ? null : k); setAreaAbierta(null); }, []);
  const toggleArea    = useCallback((k) => { setAreaAbierta((p) => p === k ? null : k); }, []);

  /* Opciones de filtros */
  const opcionesProgramas = useMemo(() => [...new Set(data.map((r) => r.programa).filter(Boolean))].sort(), [data]);
  const opcionesDG        = useMemo(() => [...new Set(data.map((r) => r.dg).filter(Boolean))].sort(), [data]);
  const opcionesAlcaldia  = useMemo(() => [...new Set(data.map((r) => r.alcaldia).filter(Boolean))].sort(), [data]);

  /* Filtrado client-side */
  const dataFiltrada = useMemo(() => {
    const bq = busqueda.trim().toUpperCase();
    return data.filter((r) => {
      if (bq && !((r.nombre_obra||"").toUpperCase().includes(bq) || (r.clave_unica||"").toUpperCase().includes(bq))) return false;
      if (filtPrograma && r.programa  !== filtPrograma)  return false;
      if (filtDG       && r.dg        !== filtDG)        return false;
      if (filtAlcaldia && r.alcaldia  !== filtAlcaldia)  return false;
      if (filtTipo && r.tiene_alcances && r.tipo_alcance_obra !== filtTipo) return false;
      return true;
    });
  }, [data, busqueda, filtPrograma, filtDG, filtAlcaldia, filtTipo]);

  const conAlcances = useMemo(() => dataFiltrada.filter((r) =>  r.tiene_alcances), [dataFiltrada]);
  const sinAlcances = useMemo(() => dataFiltrada.filter((r) => !r.tiene_alcances), [dataFiltrada]);

  /* Mantiene el ref siempre actualizado con dataFiltrada vigente */
  useEffect(() => { dataFiltradaRef.current = dataFiltrada; }, [dataFiltrada]);

  const coberturaPct   = dataFiltrada.length ? parseFloat(((conAlcances.length / dataFiltrada.length) * 100).toFixed(1)) : 0;
  const obrasProyectado= conAlcances.filter((r) => r.tipo_alcance_obra === "PROYECTADO").length;
  const obrasEjecutado = conAlcances.filter((r) => r.tipo_alcance_obra === "EJECUTADO").length;
  const obrasSinTipo   = conAlcances.filter((r) => !r.tipo_alcance_obra).length;

  /* Agrupación por seguimiento */
  const groupedAll = useMemo(() => groupByDG(dataFiltrada), [dataFiltrada]);
  const dgsAll     = useMemo(() => Object.entries(groupedAll).sort(([a],[b]) => a.localeCompare(b)), [groupedAll]);

  const hayFiltros = busqueda || filtPrograma || filtDG || filtAlcaldia || filtTipo;

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f0f9ff" }}>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto w-full">

          {/* Encabezado turquesa */}
          <div className="mb-4 rounded-2xl px-5 py-5 relative overflow-hidden"
            style={{ background:`linear-gradient(135deg, ${TC.primaryDark} 0%, ${TC.primary} 55%, #0891b2 100%)` }}>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color:"rgba(207,250,254,0.75)" }}>
                  Panel Administrativo · Alcances
                </p>
                <h1 className="mt-1 text-2xl lg:text-3xl font-bold text-white">Control de Cobertura</h1>
                <p className="mt-0.5 text-xs" style={{ color:"rgba(207,250,254,0.75)" }}>
                  {dataFiltrada.length} obras · {conAlcances.length} con alcances · {sinAlcances.length} sin alcances
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button type="button" onClick={() => setReporteOpen(true)}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.30)", cursor:"pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Reporte Ejecutivo
                </button>
                <button type="button" onClick={() => exportCSV(conAlcances, `cobertura_con_alcances_${new Date().toISOString().slice(0,10)}.csv`)}
                  disabled={loading || conAlcances.length === 0}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor:"rgba(255,255,255,0.12)", color:"#fff", border:"1px solid rgba(255,255,255,0.20)", cursor:"pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Exportar CSV
                </button>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-40 h-full opacity-10 pointer-events-none"
              style={{ background:"radial-gradient(circle at 80% 50%, rgba(255,255,255,0.8) 0%, transparent 70%)" }} />
          </div>

          {/* KPIs */}
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
              <KpiChip label="Total obras"    value={dataFiltrada.length}  sub={hayFiltros ? "filtrado" : "global"} />
              <KpiChip label="Con alcances"   value={conAlcances.length}   color="#166534" />
              <KpiChip label="Sin alcances"   value={sinAlcances.length}   color="#b91c1c" />
              <KpiChip label="Cobertura"      value={`${coberturaPct}%`}   color={coberturaPct>=70?"#166534":coberturaPct>=40?"#d97706":"#b91c1c"} />
              <KpiChip label="Proyectadas"    value={obrasProyectado}      color="#1d4ed8" sub="obras" />
              <KpiChip label="Ejecutadas"     value={obrasEjecutado}       color="#166534" sub="obras" />
              <KpiChip label="Sin clasificar" value={obrasSinTipo}         color="#94a3b8" sub="con alcances" />
            </div>
          )}

          {/* Filtros */}
          {!loading && !error && (
            <div className="rounded-2xl px-4 py-3 mb-4" style={{ backgroundColor:"#fff", border:TC.border }}>
              <div className="flex flex-col lg:flex-row gap-2 flex-wrap">
                <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o clave…"
                  className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded-xl focus:outline-none"
                  style={{ border:TC.border, color:"#2C2C2C" }} />
                {[
                  { label:"Programa",  value:filtPrograma, set:setFiltPrograma, opts:opcionesProgramas },
                  { label:"DG",        value:filtDG,       set:setFiltDG,       opts:opcionesDG },
                  { label:"Alcaldía",  value:filtAlcaldia, set:setFiltAlcaldia, opts:opcionesAlcaldia },
                ].map(({ label, value, set, opts }) => (
                  <select key={label} value={value} onChange={(e) => set(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none"
                    style={{ border:TC.border, color:"#2C2C2C" }}>
                    <option value="">Todos {label === "Alcaldía" ? "las" : "los"} {label.toLowerCase()}s</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                <select value={filtTipo} onChange={(e) => setFiltTipo(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none"
                  style={{ border:TC.border, color:"#2C2C2C" }}>
                  <option value="">Todos los tipos</option>
                  <option value="PROYECTADO">Proyectado</option>
                  <option value="EJECUTADO">Ejecutado</option>
                </select>
                {hayFiltros && (
                  <button type="button" onClick={() => { setBusqueda(""); setFiltPrograma(""); setFiltDG(""); setFiltAlcaldia(""); setFiltTipo(""); }}
                    className="text-xs font-semibold px-3 py-2 rounded-xl"
                    style={{ backgroundColor:TC.primaryPale, color:TC.primary, border:TC.border, cursor:"pointer" }}>
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cargando */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-9 h-9 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor:TC.primary, borderTopColor:"transparent" }} />
              <span className="text-sm" style={{ color:"#64748b" }}>Cargando datos de cobertura…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-10 rounded-2xl text-sm"
              style={{ backgroundColor:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c" }}>
              <p className="font-semibold mb-1">Error al cargar datos</p>
              <p className="mb-3">{error}</p>
              <button type="button" onClick={fetchData} className="rounded-xl px-4 py-1.5 text-xs font-bold text-white"
                style={{ background:TC.primary }}>Reintentar</button>
            </div>
          )}

          {/* Acordeones — UNA tarjeta por Seguimiento */}
          {!loading && !error && (
            <div className="space-y-2">
              {dgsAll.length === 0 ? (
                <div className="text-center py-10 text-sm rounded-2xl"
                  style={{ color:"#94a3b8", backgroundColor:"#fff", border:TC.border }}>
                  No hay obras para los filtros seleccionados.
                </div>
              ) : (
                dgsAll.map(([dg, obras]) => (
                  <SeguimientoAccordion
                    key={dg}
                    dg={dg}
                    obras={obras}
                    dgAbierta={dgAbierta}
                    onToggleDG={toggleDg}
                    programaAbierto={programaAbierto}
                    onTogglePrograma={togglePrograma}
                    areaAbierta={areaAbierta}
                    onToggleArea={toggleArea}
                    onObraClick={(obra) => setObraConsulta(obra)}
                    onReporteDG={abrirReporteDG}
                    onReporteBalon={abrirReporteBalon}
                  />
                ))
              )}
            </div>
          )}

        </main>
      </div>

      <Footer />

      {/* Modal de detalle de alcances */}
      <ModalConsultaAlcances
        open={!!obraConsulta}
        obra={obraConsulta}
        onClose={() => setObraConsulta(null)}
      />

      {/* Reporte Ejecutivo global — usa dataFiltrada del panel (misma fuente, SEGUIMIENTO correcto) */}
      <ReporteCoberturaModal
        open={reporteOpen}
        onClose={() => setReporteOpen(false)}
        obrasData={dataFiltrada}
        filtros={{
          programa: filtPrograma || undefined,
          dg:       filtDG       || undefined,
          alcaldia: filtAlcaldia || undefined,
        }}
        generatedAt={new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
      />

      {/* Reporte por DG — usa obras del panel filtradas por ese DG (SEGUIMIENTO correcto) */}
      <ReporteDGModal
        open={reporteDGOpen}
        onClose={() => { setReporteDGOpen(false); setReporteDGNombre(null); }}
        dg={reporteDGNombre}
        obrasData={reporteDGObras}
        generatedAt={new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
      />

      {/* Reporte EL BALÓN VUELVE AL BARRIO — agrupa por DG responsable (ejecutora) */}
      <ReporteBalon
        open={reporteBalonOpen}
        onClose={() => { setReporteBalonOpen(false); setReporteBalonObras([]); }}
        obrasData={reporteBalonObras}
        generatedAt={new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
      />
    </div>
  );
}
