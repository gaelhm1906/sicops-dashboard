/**
 * pages/CoberturaAlcances/ReporteCobertura.jsx
 * Modal institucional de Reporte Ejecutivo — Control de Cobertura.
 * PDF jerárquico: Portada → Resumen → DG → Programas → Obras → Rankings
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coberturaAPI } from "../../utils/api";
import { openPrintWindow } from "../../utils/reportExport";
import { getReportLogoDataUrl } from "../../utils/reportBranding";

/* ── helpers ── */
function esc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtFecha(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function cobColors(pct) {
  if (pct >= 70) return { bg: "#ECFDF5", text: "#15803D", border: "#DCFCE7" };
  if (pct >= 40) return { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };
  return           { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" };
}
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || "SIN CLASIFICAR";
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

const KPI_COLORS = {
  conAlcances:    { bg: "#ECFDF5", text: "#15803D", border: "#DCFCE7" },
  sinAlcances:    { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
  cobertura:      { bg: "#EFF6FF", text: "#2563EB", border: "#DBEAFE" },
  totalAlcances:  { bg: "#EEF2FF", text: "#3730A3", border: "#E0E7FF" },
  totalConceptos: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  dgs:            { bg: "#F3E8EC", text: "#691C32", border: "#E8C4CC" },
};
const SL = { fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 6px" };

/* ════════════════════════════════
   SUB-COMPONENTES PDF
════════════════════════════════ */

/** Encabezado institucional reutilizable */
function PdfHeader({ logoUrl, subtitle, generatedAt, filtros }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, borderBottom: "3px solid #691C32", marginBottom: 20, paddingBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 320px", minWidth: 0 }}>
        {logoUrl && <img src={logoUrl} alt="Logo SOBSE" style={{ height: 46, width: "auto", objectFit: "contain", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        <div>
          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 3px" }}>CONTROL DE COBERTURA · SOBSE</p>
          <h1 style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: "#111827", margin: 0 }}>Reporte Ejecutivo</h1>
          {subtitle && <p style={{ fontSize: 12, fontWeight: 700, color: "#691C32", margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10, color: "#6b7280" }}>
        <p style={{ margin: 0 }}>{generatedAt}</p>
        {filtros?.programa && <p style={{ margin: "2px 0 0", color: "#2563EB", fontWeight: 700 }}>Programa: {esc(filtros.programa)}</p>}
        {filtros?.dg       && <p style={{ margin: "2px 0 0", color: "#691C32", fontWeight: 700 }}>DG: {esc(filtros.dg)}</p>}
        {filtros?.alcaldia && <p style={{ margin: "2px 0 0", color: "#15803D", fontWeight: 700 }}>Alcaldía: {esc(filtros.alcaldia)}</p>}
      </div>
    </div>
  );
}

/** Banda de encabezado de sección */
function SeccionHeader({ titulo, subtitulo, color = "#691C32" }) {
  return (
    <div style={{ background: color, borderRadius: 10, padding: "10px 18px", marginBottom: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
      <p style={{ fontSize: 13, fontWeight: 900, color: "white", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{titulo}</p>
      {subtitulo && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", margin: 0 }}>{subtitulo}</p>}
    </div>
  );
}

/** Fila de KPI compacta para PDF */
function KpiRow({ items }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {items.map(({ label, value, bg, text, border }) => (
        <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "9px 14px", minWidth: 90 }}>
          <p style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.16em", color: text, margin: "0 0 2px", opacity: 0.8 }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

/** Tabla genérica compacta para PDF */
function PdfTabla({ headers, rows, headerBg = "#F9FAFB", rowBg = ["white", "#FAFAFA"] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB", fontSize: 10 }}>
      <thead>
        <tr style={{ background: headerBg }}>
          {headers.map(({ label, align = "center", width }) => (
            <th key={label} style={{ padding: "7px 10px", fontSize: 7, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", fontWeight: 900, textAlign: align, borderBottom: "1px solid #E5E7EB", ...(width ? { width } : {}) }}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i} style={{ background: rowBg[i % 2], borderBottom: "1px solid #F3F4F6", pageBreakInside: "avoid" }}>
            {cells}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sección de programa con sus obras */
function ProgramaSection({ programa, obras, conAlcances }) {
  const cc = conAlcances ? cobColors(obras.length ? 100 : 0) : null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ background: conAlcances ? "#F0FDF4" : "#FFF5F5", border: `1px solid ${conAlcances ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "7px 14px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", pageBreakAfter: "avoid", breakAfter: "avoid" }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: conAlcances ? "#15803D" : "#B91C1C", margin: 0, textTransform: "uppercase" }}>{esc(programa)}</p>
        <span style={{ background: conAlcances ? "#DCFCE7" : "#FECACA", color: conAlcances ? "#15803D" : "#B91C1C", padding: "2px 10px", borderRadius: 99, fontSize: 9, fontWeight: 900 }}>
          {obras.length} {obras.length === 1 ? "obra" : "obras"}
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
        <thead>
          <tr style={{ background: conAlcances ? "#F0FDF4" : "#FFF5F5" }}>
            {["#", "Obra / Sitio", "Alcaldía", ...(conAlcances ? ["Alc.", "Conc.", "Tipo", "Últ. Captura"] : [])].map((h) => (
              <th key={h} style={{ padding: "5px 8px", fontSize: 7, textTransform: "uppercase", letterSpacing: "0.12em", color: conAlcances ? "#15803D" : "#B91C1C", fontWeight: 900, textAlign: h === "#" ? "right" : "left", borderBottom: `1px solid ${conAlcances ? "#BBF7D0" : "#FECACA"}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {obras.map((o, i) => {
            const tipo = o.tipo_alcance_obra;
            const tipoCfg = tipo === "PROYECTADO" ? { bg: "#EFF6FF", color: "#2563EB" } : tipo === "EJECUTADO" ? { bg: "#ECFDF5", color: "#15803D" } : null;
            return (
              <tr key={o.clave_unica || i} style={{ background: i % 2 === 0 ? "white" : (conAlcances ? "#F0FDF4" : "#FFF5F5"), borderBottom: `1px solid ${conAlcances ? "#DCFCE7" : "#FEE2E2"}`, pageBreakInside: "avoid" }}>
                <td style={{ padding: "5px 8px", color: "#9ca3af", fontWeight: 700, textAlign: "right", width: 24 }}>{i + 1}</td>
                <td style={{ padding: "5px 8px", fontWeight: 700, color: "#1A1A1A", maxWidth: conAlcances ? 220 : 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{esc(o.nombre_obra)}</td>
                <td style={{ padding: "5px 8px", color: "#6b7280", width: 110 }}>{esc(o.alcaldia)}</td>
                {conAlcances && <>
                  <td style={{ padding: "5px 8px", fontWeight: 900, color: "#2563EB", textAlign: "center", width: 40 }}>{o.total_alcances}</td>
                  <td style={{ padding: "5px 8px", color: "#374151", textAlign: "center", width: 44 }}>{o.total_conceptos}</td>
                  <td style={{ padding: "5px 8px", width: 72 }}>
                    {tipoCfg ? <span style={{ background: tipoCfg.bg, color: tipoCfg.color, padding: "1px 6px", borderRadius: 99, fontSize: 7, fontWeight: 900 }}>{tipo}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ padding: "5px 8px", color: "#6b7280", whiteSpace: "nowrap", width: 80 }}>{fmtFecha(o.ultima_captura)}</td>
                </>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════ */
export default function ReporteCoberturaModal({ open, onClose, obrasData, filtros = {}, generatedAt }) {
  const [logoUrl,     setLogoUrl]     = useState("");
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [copyLabel,   setCopyLabel]   = useState("Copiar");
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => { getReportLogoDataUrl().then((url) => setLogoUrl(url || "")); }, []);

  /* ── Cuando se pasa obrasData desde el panel, construir reportData
     directamente (misma fuente que el panel → SEGUIMIENTO correcto).
     No se llama al backend → no hay discrepancias de agrupación. ── */
  const reportDataFromObras = useMemo(() => {
    if (!obrasData || !obrasData.length) return null;

    const pct = (c, t) => t ? parseFloat(((c / t) * 100).toFixed(1)) : 0;
    const con = obrasData.filter((o) => o.tiene_alcances);
    const sin = obrasData.filter((o) => !o.tiene_alcances);

    const totalAlcances  = con.reduce((s, o) => s + (o.total_alcances  || 0), 0);
    const totalConceptos = con.reduce((s, o) => s + (o.total_conceptos || 0), 0);
    const ultimaAct = con.length
      ? con.reduce((mx, o) => (o.ultima_captura && o.ultima_captura > mx ? o.ultima_captura : mx), con[0].ultima_captura)
      : null;

    /* Agregaciones por DG (usando obra.dg = SEGUIMIENTO correcto) */
    const dgMap = {};
    for (const o of obrasData) {
      const dg = o.dg || "SIN SEGUIMIENTO";
      if (!dgMap[dg]) dgMap[dg] = { dg, total: 0, con: 0, sin: 0, alcances: 0, conceptos: 0, progs: new Set() };
      dgMap[dg].total++;
      if (o.tiene_alcances) { dgMap[dg].con++; dgMap[dg].alcances += o.total_alcances || 0; dgMap[dg].conceptos += o.total_conceptos || 0; }
      else dgMap[dg].sin++;
      if (o.programa) dgMap[dg].progs.add(o.programa);
    }
    const porDG = Object.values(dgMap).map((d) => ({
      dg: d.dg, obras_total: d.total, obras_con_alcances: d.con, obras_sin_alcances: d.sin,
      cobertura_pct: pct(d.con, d.total),
      total_alcances: d.alcances, total_conceptos: d.conceptos,
      programas_count: d.progs.size, programas: [...d.progs].sort(),
    })).sort((a, b) => b.cobertura_pct - a.cobertura_pct);

    /* Agregaciones por Programa */
    const progMap = {};
    for (const o of obrasData) {
      const prog = o.programa || "SIN PROGRAMA";
      if (!progMap[prog]) progMap[prog] = { programa: prog, dg: o.dg, total: 0, con: 0, sin: 0, alcances: 0, conceptos: 0, ultima: null };
      progMap[prog].total++;
      if (o.tiene_alcances) {
        progMap[prog].con++;
        progMap[prog].alcances  += o.total_alcances  || 0;
        progMap[prog].conceptos += o.total_conceptos || 0;
        if (o.ultima_captura && (!progMap[prog].ultima || o.ultima_captura > progMap[prog].ultima)) progMap[prog].ultima = o.ultima_captura;
      } else progMap[prog].sin++;
    }
    const porPrograma = Object.values(progMap).map((p) => ({
      programa: p.programa, dg: p.dg,
      obras_total: p.total, obras_con_alcances: p.con, obras_sin_alcances: p.sin,
      cobertura_pct: pct(p.con, p.total),
      total_alcances: p.alcances, total_conceptos: p.conceptos,
      ultima_captura: p.ultima,
    })).sort((a, b) => b.cobertura_pct - a.cobertura_pct);

    return {
      success:     true,
      generado_en: new Date().toLocaleString("es-MX"),
      filtros,
      kpis: {
        total_obras:             obrasData.length,
        obras_con_alcances:      con.length,
        obras_sin_alcances:      sin.length,
        cobertura_pct:           pct(con.length, obrasData.length),
        total_alcances:          totalAlcances,
        total_conceptos:         totalConceptos,
        dgs_participantes:       new Set(obrasData.map((o) => o.dg).filter(Boolean)).size,
        programas_participantes: new Set(obrasData.map((o) => o.programa).filter(Boolean)).size,
        ultima_actualizacion:    ultimaAct,
      },
      por_dg:             porDG,
      por_programa:       porPrograma,
      obras_con_alcances: con,
      obras_sin_alcances: sin,
    };
  }, [obrasData, filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;

    if (reportDataFromObras) {
      /* Datos ya disponibles desde el panel — sin llamada al backend */
      setReportData(reportDataFromObras);
      setLoading(false);
      return;
    }

    /* Fallback: llamar API cuando no se pasa obrasData */
    setLoading(true); setError(null); setReportData(null);
    coberturaAPI.getReporte(filtros)
      .then((res) => setReportData(res))
      .catch((e)  => setError(e.message || "Error al generar el reporte."))
      .finally(() => setLoading(false));
  }, [open, reportDataFromObras]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* ── Datos derivados ── */
  const kpis              = reportData?.kpis            || null;
  const porDG             = reportData?.por_dg          || [];
  const porPrograma       = reportData?.por_programa    || [];
  const obrasConAlcances  = reportData?.obras_con_alcances || [];
  const obrasSinAlcances  = reportData?.obras_sin_alcances || [];

  /* Agrupaciones para PDF jerárquico */
  const conPorPrograma  = useMemo(() => groupBy(obrasConAlcances,  "programa"), [obrasConAlcances]);
  const sinPorPrograma  = useMemo(() => groupBy(obrasSinAlcances,  "programa"), [obrasSinAlcances]);
  const progPorDG       = useMemo(() => groupBy(porPrograma,       "dg"),       [porPrograma]);


  /* Texto plano para copiar */
  const reportText = useMemo(() => {
    if (!reportData) return "";
    const { kpis: k, filtros: f } = reportData;
    return [
      "GOBIERNO DE LA CIUDAD DE MÉXICO",
      "SOBSE · Control de Cobertura",
      "",
      "REPORTE EJECUTIVO — ALCANCES REGISTRADOS POR OBRA",
      `Generado: ${generatedAt || new Date().toLocaleDateString("es-MX")}`,
      "",
      ...(f.programa ? [`PROGRAMA: ${f.programa}`] : []),
      ...(f.dg       ? [`DG: ${f.dg}`]             : []),
      ...(f.alcaldia ? [`ALCALDÍA: ${f.alcaldia}`]  : []),
      "",
      "RESUMEN GENERAL",
      `Total de obras:      ${k.total_obras}`,
      `Con alcances:        ${k.obras_con_alcances}`,
      `Sin alcances:        ${k.obras_sin_alcances}`,
      `Cobertura:           ${k.cobertura_pct}%`,
      `Total de alcances:   ${k.total_alcances}`,
      `Total de conceptos:  ${k.total_conceptos}`,
      `DGs participantes:   ${k.dgs_participantes}`,
      `Programas:           ${k.programas_participantes}`,
      "",
      "OBRAS SIN ALCANCES:",
      ...obrasSinAlcances.map((o, i) => `  ${i + 1}. ${o.nombre_obra} | ${o.programa || "—"} | ${o.dg || "—"} | ${o.alcaldia || "—"}`),
    ].join("\n");
  }, [reportData, generatedAt, obrasSinAlcances]);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(reportText); }
      else {
        const ta = document.createElement("textarea");
        ta.value = reportText; ta.style.cssText = "position:fixed;left:-9999px;top:0;"; ta.setAttribute("aria-hidden", "true");
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      }
      setCopyLabel("¡Copiado!");
    } catch { setCopyLabel("Error"); }
    finally { window.setTimeout(() => setCopyLabel("Copiar"), 2000); }
  }, [reportText]);

  const handleDownload = useCallback(async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try { await openPrintWindow(pdfRef.current.innerHTML, "Reporte Ejecutivo · Control de Cobertura · SOBSE"); }
    catch { /* ignore */ }
    finally { setDownloading(false); }
  }, []);

  if (!open) return null;

  const btnBase = { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid", transition: "opacity 0.15s" };
  const now = generatedAt || new Date().toLocaleDateString("es-MX");

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <>
      {/* ─── DIV OCULTO — contenido PDF jerárquico ─── */}
      <div
        ref={pdfRef}
        aria-hidden="true"
        style={{ position: "fixed", top: 0, left: "-9999px", width: "794px", background: "white", padding: "24px", boxSizing: "border-box", fontFamily: "Arial, Helvetica, sans-serif", color: "#111827", zIndex: -1 }}
      >
        {reportData && kpis && (
          <>
            {/* ══ 1. PORTADA EJECUTIVA ══ */}
            <div>
              {/* Logo y título */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  {logoUrl && <img src={logoUrl} alt="Logo SOBSE" style={{ height: 60, width: "auto", objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  <div style={{ borderLeft: "3px solid #691C32", paddingLeft: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 4px" }}>GOBIERNO DE LA CIUDAD DE MÉXICO</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#691C32", margin: 0 }}>SECRETARÍA DE OBRAS Y SERVICIOS — SOBSE</p>
                  </div>
                </div>

                <div style={{ borderBottom: "4px solid #691C32", paddingBottom: 16, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 8px" }}>SICOPS · PLATAFORMA DE SEGUIMIENTO</p>
                  <h1 style={{ fontSize: 38, fontWeight: 900, color: "#111827", margin: "0 0 6px", lineHeight: 1.1 }}>Reporte Ejecutivo</h1>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#691C32", margin: "0 0 4px" }}>Control de Cobertura de Alcances</h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Alcances registrados por obra · Análisis por Dirección General y Programa</p>
                </div>

                {/* Filtros aplicados */}
                {(reportData.filtros.programa || reportData.filtros.dg || reportData.filtros.alcaldia) && (
                  <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 18px", marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <p style={{ ...SL, margin: 0, marginRight: 4 }}>Filtros activos:</p>
                    {reportData.filtros.programa && <span style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE", padding: "3px 12px", borderRadius: 99, fontSize: 9, fontWeight: 900 }}>Programa: {esc(reportData.filtros.programa)}</span>}
                    {reportData.filtros.dg       && <span style={{ background: "#F3E8EC", color: "#691C32", border: "1px solid #E8C4CC", padding: "3px 12px", borderRadius: 99, fontSize: 9, fontWeight: 900 }}>DG: {esc(reportData.filtros.dg)}</span>}
                    {reportData.filtros.alcaldia && <span style={{ background: "#ECFDF5", color: "#15803D", border: "1px solid #DCFCE7", padding: "3px 12px", borderRadius: 99, fontSize: 9, fontWeight: 900 }}>Alcaldía: {esc(reportData.filtros.alcaldia)}</span>}
                  </div>
                )}

                {/* KPIs portada */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Obras totales",     value: kpis.total_obras,                              ...KPI_COLORS.dgs },
                    { label: "Con alcances",       value: kpis.obras_con_alcances,                       ...KPI_COLORS.conAlcances },
                    { label: "Sin alcances",       value: kpis.obras_sin_alcances,                       ...KPI_COLORS.sinAlcances },
                    { label: "Cobertura",          value: `${kpis.cobertura_pct}%`,                      ...cobColors(kpis.cobertura_pct) },
                    { label: "Total alcances",     value: kpis.total_alcances.toLocaleString("es-MX"),   ...KPI_COLORS.totalAlcances },
                    { label: "Total conceptos",    value: kpis.total_conceptos.toLocaleString("es-MX"),  ...KPI_COLORS.totalConceptos },
                    { label: "DG participantes",   value: kpis.dgs_participantes,                        ...KPI_COLORS.dgs },
                    { label: "Programas",          value: kpis.programas_participantes,                  ...KPI_COLORS.cobertura },
                  ].map(({ label, value, bg, text, border }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "14px 20px", flex: "1 1 120px" }}>
                      <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.18em", color: text, margin: "0 0 4px", opacity: 0.8 }}>{label}</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: text, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>

              {/* Pie de portada */}
              <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 20, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 2px" }}>Generado el</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{now}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 2px" }}>Última actualización registrada</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#691C32", margin: 0 }}>{fmtFecha(kpis.ultima_actualizacion)}</p>
                </div>
              </div>
            </div>

            {/* ══ 2. RESUMEN POR DG ══ */}
            {porDG.length > 0 && (
              <div style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 4 }}>
                <PdfHeader logoUrl={logoUrl} subtitle="Resumen por Dirección General" generatedAt={now} filtros={reportData.filtros} />
                <SeccionHeader titulo={`2. Resumen por Dirección General`} subtitulo={`${porDG.length} DG participantes`} />
                <PdfTabla
                  headers={[
                    { label: "Dirección General", align: "left", width: "34%" },
                    { label: "Obras Total", width: "9%" },
                    { label: "Con Alc.", width: "9%" },
                    { label: "Sin Alc.", width: "9%" },
                    { label: "Cobertura", width: "11%" },
                    { label: "Alcances", width: "9%" },
                    { label: "Conceptos", width: "10%" },
                    { label: "Prog.", width: "9%" },
                  ]}
                  rows={porDG.map((d) => {
                    const cc = cobColors(d.cobertura_pct);
                    return [
                      <td key="dg"  style={{ padding: "7px 10px", fontWeight: 700, color: "#1A1A1A", fontSize: 10 }}>{esc(d.dg)}</td>,
                      <td key="tot" style={{ padding: "7px 10px", textAlign: "center", color: "#374151" }}>{d.obras_total}</td>,
                      <td key="con" style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#15803D" }}>{d.obras_con_alcances}</td>,
                      <td key="sin" style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#B91C1C" }}>{d.obras_sin_alcances}</td>,
                      <td key="cob" style={{ padding: "7px 10px", textAlign: "center" }}>
                        <span style={{ background: cc.bg, color: cc.text, padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 900 }}>{d.cobertura_pct}%</span>
                      </td>,
                      <td key="alc" style={{ padding: "7px 10px", textAlign: "center", color: "#374151" }}>{d.total_alcances.toLocaleString("es-MX")}</td>,
                      <td key="con2" style={{ padding: "7px 10px", textAlign: "center", color: "#374151" }}>{d.total_conceptos.toLocaleString("es-MX")}</td>,
                      <td key="prog" style={{ padding: "7px 10px", textAlign: "center", color: "#374151" }}>{d.programas_count}</td>,
                    ];
                  })}
                />
              </div>
            )}

            {/* ══ 4. RESUMEN POR PROGRAMA DENTRO DE CADA DG ══ */}
            {porDG.some((dg) => (progPorDG[dg.dg] || []).length > 0) && (
              <div style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 4 }}>
                <PdfHeader logoUrl={logoUrl} subtitle="Programas por Dirección General" generatedAt={now} filtros={reportData.filtros} />
                <SeccionHeader titulo="3. Programas dentro de cada Dirección General" subtitulo={`${porDG.filter(dg => (progPorDG[dg.dg]||[]).length > 0).length} DG con programas`} />
                {porDG.map((dg) => {
              const progs = progPorDG[dg.dg] || [];
              if (progs.length === 0) return null;
              const cc = cobColors(dg.cobertura_pct);
              return (
                <div key={`dg-${dg.dg}`} style={{ marginBottom: 24 }}>
                  {/* Encabezado DG */}
                  <div style={{ background: "#691C32", borderRadius: 12, padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", margin: "0 0 3px" }}>DIRECCIÓN GENERAL</p>
                      <p style={{ fontSize: 16, fontWeight: 900, color: "white", margin: 0 }}>{esc(dg.dg)}</p>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[
                        { l: "Total", v: dg.obras_total, c: "rgba(255,255,255,0.9)" },
                        { l: "Con Alc.", v: dg.obras_con_alcances, c: "#86EFAC" },
                        { l: "Sin Alc.", v: dg.obras_sin_alcances, c: "#FCA5A5" },
                        { l: "Cobertura", v: `${dg.cobertura_pct}%`, c: cc.text === "#15803D" ? "#86EFAC" : cc.text === "#92400E" ? "#FDE68A" : "#FCA5A5" },
                      ].map(({ l, v, c }) => (
                        <div key={l} style={{ textAlign: "center", minWidth: 55 }}>
                          <p style={{ fontSize: 7, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.12em" }}>{l}</p>
                          <p style={{ fontSize: 18, fontWeight: 900, color: c, margin: 0 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p style={{ ...SL, marginBottom: 10 }}>3. Programas dentro de {esc(dg.dg)} — {progs.length} programa{progs.length !== 1 ? "s" : ""}</p>
                  <PdfTabla
                    headers={[
                      { label: "Programa", align: "left", width: "40%" },
                      { label: "Total", width: "8%" },
                      { label: "Con Alc.", width: "9%" },
                      { label: "Sin Alc.", width: "9%" },
                      { label: "Cobertura", width: "11%" },
                      { label: "Alcances", width: "9%" },
                      { label: "Conceptos", width: "9%" },
                      { label: "Últ. Captura", width: "10%" },
                    ]}
                    rows={progs.map((p) => {
                      const pc = cobColors(p.cobertura_pct);
                      return [
                        <td key="prog" style={{ padding: "6px 10px", fontWeight: 700, color: "#1A1A1A", fontSize: 9 }}>{esc(p.programa)}</td>,
                        <td key="tot"  style={{ padding: "6px 10px", textAlign: "center" }}>{p.obras_total}</td>,
                        <td key="con"  style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: "#15803D" }}>{p.obras_con_alcances}</td>,
                        <td key="sin"  style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: "#B91C1C" }}>{p.obras_sin_alcances}</td>,
                        <td key="cob"  style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span style={{ background: pc.bg, color: pc.text, padding: "2px 7px", borderRadius: 99, fontSize: 7.5, fontWeight: 900 }}>{p.cobertura_pct}%</span>
                        </td>,
                        <td key="alc"  style={{ padding: "6px 10px", textAlign: "center" }}>{p.total_alcances.toLocaleString("es-MX")}</td>,
                        <td key="con2" style={{ padding: "6px 10px", textAlign: "center" }}>{p.total_conceptos.toLocaleString("es-MX")}</td>,
                        <td key="ult"  style={{ padding: "6px 10px", textAlign: "center", color: "#6b7280", fontSize: 8 }}>{fmtFecha(p.ultima_captura)}</td>,
                      ];
                    })}
                  />
                </div>
              );
            })}
              </div>
            )}

            {/* ══ 5. COBERTURA POR PROGRAMA (global) ══ */}
            {porPrograma.length > 0 && (
              <div style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 4 }}>
                <PdfHeader logoUrl={logoUrl} subtitle="Cobertura por Programa" generatedAt={now} filtros={reportData.filtros} />
                <SeccionHeader titulo={`4. Cobertura por Programa`} subtitulo={`${porPrograma.length} programas`} />
                <PdfTabla
                  headers={[
                    { label: "#", width: "4%" },
                    { label: "Programa", align: "left", width: "38%" },
                    { label: "DG", align: "left", width: "14%" },
                    { label: "Total", width: "7%" },
                    { label: "Con Alc.", width: "8%" },
                    { label: "Sin Alc.", width: "8%" },
                    { label: "Cobertura", width: "9%" },
                    { label: "Alcances", width: "7%" },
                    { label: "Conceptos", width: "8%" },
                  ]}
                  rows={porPrograma.map((p, i) => {
                    const pc = cobColors(p.cobertura_pct);
                    return [
                      <td key="#"    style={{ padding: "5px 8px", textAlign: "right", color: "#9ca3af", fontSize: 8 }}>{i + 1}</td>,
                      <td key="prog" style={{ padding: "5px 8px", fontWeight: 700, color: "#1A1A1A", fontSize: 9 }}>{esc(p.programa)}</td>,
                      <td key="dg"   style={{ padding: "5px 8px", fontSize: 8, color: "#374151" }}>{esc(p.dg)}</td>,
                      <td key="tot"  style={{ padding: "5px 8px", textAlign: "center" }}>{p.obras_total}</td>,
                      <td key="con"  style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "#15803D" }}>{p.obras_con_alcances}</td>,
                      <td key="sin"  style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "#B91C1C" }}>{p.obras_sin_alcances}</td>,
                      <td key="cob"  style={{ padding: "5px 8px", textAlign: "center" }}>
                        <span style={{ background: pc.bg, color: pc.text, padding: "2px 6px", borderRadius: 99, fontSize: 7.5, fontWeight: 900 }}>{p.cobertura_pct}%</span>
                      </td>,
                      <td key="alc"  style={{ padding: "5px 8px", textAlign: "center" }}>{p.total_alcances}</td>,
                      <td key="con2" style={{ padding: "5px 8px", textAlign: "center" }}>{p.total_conceptos}</td>,
                    ];
                  })}
                />
              </div>
            )}

            {/* ══ 6. OBRAS CON ALCANCES AGRUPADAS POR PROGRAMA ══ */}
            {obrasConAlcances.length > 0 && (
              <div style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 4 }}>
                <PdfHeader logoUrl={logoUrl} subtitle="Obras con Alcances" generatedAt={now} filtros={reportData.filtros} />
                <SeccionHeader titulo={`5. Obras con Alcances Registrados`} subtitulo={`${obrasConAlcances.length} obras · agrupadas por programa`} color="#15803D" />
                {Object.entries(conPorPrograma).sort(([a], [b]) => a.localeCompare(b)).map(([prog, obras]) => (
                  <ProgramaSection key={prog} programa={prog} obras={obras} conAlcances />
                ))}
              </div>
            )}

            {/* ══ 7. OBRAS SIN ALCANCES AGRUPADAS POR PROGRAMA ══ */}
            {obrasSinAlcances.length > 0 && (
              <div style={{ pageBreakBefore: "always", breakBefore: "page", paddingTop: 4 }}>
                <PdfHeader logoUrl={logoUrl} subtitle="Obras sin Alcances — Rezago" generatedAt={now} filtros={reportData.filtros} />
                {/* Banner alerta */}
                <div style={{ background: "#B91C1C", borderRadius: 12, padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <p style={{ fontSize: 26, margin: 0, color: "white", flexShrink: 0 }}>⚠</p>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 900, color: "white", margin: "0 0 3px", textTransform: "uppercase" }}>Rezago de Captura — Atención Requerida</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", margin: 0 }}>{obrasSinAlcances.length} obras no tienen ningún alcance registrado en el sistema</p>
                  </div>
                  <p style={{ fontSize: 36, fontWeight: 900, color: "white", margin: 0, flexShrink: 0 }}>{obrasSinAlcances.length}</p>
                </div>
                <SeccionHeader titulo={`6. Obras sin Alcances — Requieren Captura`} subtitulo={`${obrasSinAlcances.length} obras · agrupadas por programa`} color="#7F1D1D" />
                {Object.entries(sinPorPrograma).sort(([a], [b]) => a.localeCompare(b)).map(([prog, obras]) => (
                  <ProgramaSection key={prog} programa={prog} obras={obras} conAlcances={false} />
                ))}
              </div>
            )}

          </>
        )}
      </div>

      {/* ═══════════════════════════════════════
          MODAL VISIBLE
      ═══════════════════════════════════════ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(3px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />

      <div style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 960, maxHeight: "90vh", background: "white", borderRadius: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header modal */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #E5E7EB", padding: "20px 24px", flexShrink: 0, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 4px" }}>CONTROL DE COBERTURA</p>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1.2 }}>Reporte Ejecutivo</h2>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#691C32", margin: "4px 0 0" }}>Alcances Registrados por Obra · Estructura Jerárquica</p>
              {generatedAt && <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>{generatedAt}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button type="button" onClick={handleCopy} style={{ ...btnBase, background: "white", borderColor: "#E5E7EB", color: "#374151" }}>📋 {copyLabel}</button>
              <button type="button" onClick={handleDownload} disabled={!reportData || downloading}
                style={{ ...btnBase, background: !reportData || downloading ? "#9ca3af" : "#691C32", borderColor: "transparent", color: "white", opacity: !reportData ? 0.6 : 1, cursor: !reportData ? "not-allowed" : "pointer" }}>
                ↓ {downloading ? "Abriendo..." : "Descargar PDF"}
              </button>
              <button type="button" onClick={onClose} style={{ ...btnBase, background: "white", borderColor: "#E5E7EB", color: "#6b7280" }}>✕</button>
            </div>
          </div>

          {/* Cuerpo scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 0" }}>
                <div style={{ width: 36, height: 36, border: "4px solid #691C32", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 14, color: "#6b7280" }}>Generando reporte…</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {error && !loading && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 16, padding: "24px", textAlign: "center" }}>
                <p style={{ fontWeight: 700, color: "#B91C1C", margin: "0 0 6px", fontSize: 14 }}>Error al generar el reporte</p>
                <p style={{ color: "#B91C1C", margin: 0, fontSize: 13 }}>{error}</p>
              </div>
            )}

            {reportData && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Filtros */}
                {(reportData.filtros.programa || reportData.filtros.dg || reportData.filtros.alcaldia) && (
                  <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>Filtros:</p>
                    {reportData.filtros.programa && <span style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE", padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>Programa: {reportData.filtros.programa}</span>}
                    {reportData.filtros.dg       && <span style={{ background: "#F3E8EC", color: "#691C32", border: "1px solid #E8C4CC", padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>DG: {reportData.filtros.dg}</span>}
                    {reportData.filtros.alcaldia && <span style={{ background: "#ECFDF5", color: "#15803D", border: "1px solid #DCFCE7", padding: "3px 12px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>Alcaldía: {reportData.filtros.alcaldia}</span>}
                  </div>
                )}

                {/* KPI Grid modal */}
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 24, padding: 20 }}>
                  <div style={{ display: "flex", gap: 20, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 6px" }}>Resumen General</p>
                      <p style={{ fontSize: 36, fontWeight: 900, color: "#111827", margin: "0 0 2px" }}>{kpis.total_obras}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 16px" }}>obras totales</p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                          { label: "Con Alcances",    value: kpis.obras_con_alcances,                           ...KPI_COLORS.conAlcances },
                          { label: "Sin Alcances",    value: kpis.obras_sin_alcances,                           ...KPI_COLORS.sinAlcances },
                          { label: "Cobertura",       value: `${kpis.cobertura_pct}%`,                          ...cobColors(kpis.cobertura_pct) },
                          { label: "Total Alcances",  value: kpis.total_alcances.toLocaleString("es-MX"),        ...KPI_COLORS.totalAlcances },
                          { label: "Total Conceptos", value: kpis.total_conceptos.toLocaleString("es-MX"),       ...KPI_COLORS.totalConceptos },
                          { label: "DG Participantes",value: kpis.dgs_participantes,                            ...KPI_COLORS.dgs },
                        ].map(({ label, value, bg, text, border }) => (
                          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 18px" }}>
                            <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.18em", color: text, opacity: 0.75, margin: "0 0 3px" }}>{label}</p>
                            <p style={{ fontSize: 22, fontWeight: 900, color: text, margin: 0 }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 16, padding: "18px 20px", minWidth: 190, flexShrink: 0 }}>
                      <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 8px" }}>Última captura</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: "#691C32", margin: "0 0 4px", lineHeight: 1.2 }}>{fmtFecha(kpis.ultima_actualizacion)}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 10px" }}>Corte de registro</p>
                      <p style={{ fontSize: 10, fontWeight: 700, margin: 0, color: kpis.obras_con_alcances > 0 ? "#15803d" : "#b91c1c" }}>
                        {kpis.obras_con_alcances > 0 ? "🟢 Con registros" : "🔴 Sin registros"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Por DG modal */}
                {porDG.length > 0 && (
                  <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 24, overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#F9FAFB" }}>
                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: 0 }}>Resumen por Dirección General — {porDG.length} DG</p>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#F9FAFB" }}>
                            {["Dirección General","Total","Con Alc.","Sin Alc.","Cobertura","Alcances","Conceptos","Programas"].map((h) => (
                              <th key={h} style={{ padding: "10px 14px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", fontWeight: 900, textAlign: h === "Dirección General" ? "left" : "center", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {porDG.map((d, i) => {
                            const cc = cobColors(d.cobertura_pct);
                            return (
                              <tr key={d.dg} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                                <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1A1A1A" }}>{d.dg}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>{d.obras_total}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#15803D" }}>{d.obras_con_alcances}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#B91C1C" }}>{d.obras_sin_alcances}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                  <span style={{ background: cc.bg, color: cc.text, padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 900 }}>{d.cobertura_pct}%</span>
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>{d.total_alcances.toLocaleString("es-MX")}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>{d.total_conceptos.toLocaleString("es-MX")}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>{d.programas_count}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Obras con alcances agrupadas por programa — modal */}
                {obrasConAlcances.length > 0 && (
                  <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 24, overflow: "hidden" }}>
                    <div style={{ background: "#F0FDF4", padding: "14px 20px", borderBottom: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#15803D", fontSize: 14 }}>✓</span>
                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#15803D", margin: 0 }}>
                        {obrasConAlcances.length} obras con alcances — agrupadas por programa
                      </p>
                    </div>
                    <div style={{ padding: "16px 20px" }}>
                      {Object.entries(conPorPrograma).sort(([a], [b]) => a.localeCompare(b)).map(([prog, obras]) => (
                        <div key={prog} style={{ marginBottom: 16 }}>
                          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "6px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontSize: 11, fontWeight: 900, color: "#15803D", margin: 0 }}>{prog}</p>
                            <span style={{ background: "#DCFCE7", color: "#15803D", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 900 }}>{obras.length} obras</span>
                          </div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: "#F9FAFB" }}>
                                  {["#","Obra / Sitio","Alcaldía","Alc.","Conc.","Tipo","Últ. Captura"].map((h) => (
                                    <th key={h} style={{ padding: "6px 10px", fontSize: 8, textTransform: "uppercase", color: "#9ca3af", fontWeight: 900, textAlign: h === "#" ? "right" : "left", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {obras.map((o, i) => {
                                  const tipo = o.tipo_alcance_obra;
                                  const tc = tipo === "PROYECTADO" ? { bg: "#EFF6FF", color: "#2563EB" } : tipo === "EJECUTADO" ? { bg: "#ECFDF5", color: "#15803D" } : null;
                                  return (
                                    <tr key={o.clave_unica || i} style={{ background: i % 2 === 0 ? "white" : "#F0FDF4", borderBottom: "1px solid #DCFCE7" }}>
                                      <td style={{ padding: "6px 10px", color: "#9ca3af", fontWeight: 700, textAlign: "right" }}>{i + 1}</td>
                                      <td style={{ padding: "6px 10px", fontWeight: 700, color: "#1A1A1A", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre_obra}</td>
                                      <td style={{ padding: "6px 10px", color: "#6b7280" }}>{o.alcaldia}</td>
                                      <td style={{ padding: "6px 10px", fontWeight: 900, color: "#2563EB", textAlign: "center" }}>{o.total_alcances}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "center", color: "#374151" }}>{o.total_conceptos}</td>
                                      <td style={{ padding: "6px 10px" }}>{tc ? <span style={{ background: tc.bg, color: tc.color, padding: "2px 7px", borderRadius: 99, fontSize: 8, fontWeight: 900 }}>{tipo}</span> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                                      <td style={{ padding: "6px 10px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtFecha(o.ultima_captura)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Obras sin alcances agrupadas por programa — modal */}
                {obrasSinAlcances.length > 0 && (
                  <div style={{ background: "white", border: "1px solid #FECACA", borderRadius: 24, overflow: "hidden" }}>
                    <div style={{ background: "#FEE2E2", padding: "14px 20px", borderBottom: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>⚠</span>
                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#B91C1C", margin: 0 }}>
                        {obrasSinAlcances.length} obras sin alcances — rezago de captura · agrupadas por programa
                      </p>
                    </div>
                    <div style={{ padding: "16px 20px" }}>
                      {Object.entries(sinPorPrograma).sort(([a], [b]) => a.localeCompare(b)).map(([prog, obras]) => (
                        <div key={prog} style={{ marginBottom: 16 }}>
                          <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontSize: 11, fontWeight: 900, color: "#B91C1C", margin: 0 }}>{prog}</p>
                            <span style={{ background: "#FECACA", color: "#B91C1C", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 900 }}>{obras.length} obras</span>
                          </div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: "#FFF5F5" }}>
                                  {["#","Obra / Sitio","Alcaldía"].map((h) => (
                                    <th key={h} style={{ padding: "6px 10px", fontSize: 8, textTransform: "uppercase", color: "#B91C1C", fontWeight: 900, textAlign: h === "#" ? "right" : "left", borderBottom: "1px solid #FECACA" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {obras.map((o, i) => (
                                  <tr key={o.clave_unica || i} style={{ background: i % 2 === 0 ? "white" : "#FFF5F5", borderBottom: "1px solid #FEE2E2" }}>
                                    <td style={{ padding: "6px 10px", color: "#9ca3af", fontWeight: 700, textAlign: "right" }}>{i + 1}</td>
                                    <td style={{ padding: "6px 10px", fontWeight: 700, color: "#1A1A1A", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre_obra}</td>
                                    <td style={{ padding: "6px 10px", color: "#6b7280" }}>{o.alcaldia}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
