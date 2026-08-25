/**
 * pages/CoberturaAlcances/ReporteDGModal.jsx
 * Reporte Ejecutivo por Dirección General — obras agrupadas por Programa.
 *
 * Formato idéntico al Centro de Mando (ReporteProgramaModal.tsx):
 *  • Doble rendering: pdfRef oculto (inline styles) + modal visible
 *  • PDF: openPrintWindow() → nueva ventana → window.print()
 *  • Logo base64 institucional
 *  • Por cada Programa: mini-header KPI + tabla de obras
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coberturaAPI, infoGeneralAPI } from "../../utils/api";
import { openPrintWindow } from "../../utils/reportExport";
import { getReportLogoDataUrl } from "../../utils/reportBranding";

/* ── Helpers ── */
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

const TIPO_CFG = {
  PROYECTADO: { bg: "#EFF6FF", text: "#2563EB", border: "#DBEAFE" },
  EJECUTADO:  { bg: "#ECFDF5", text: "#15803D", border: "#DCFCE7" },
};

const SL = {
  fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "#9ca3af", margin: "0 0 6px",
};

/* ── Colores para badge SI / NO ── */
const INFO_CFG = {
  si: { bg: "#ECFDF5", text: "#15803D", border: "#DCFCE7" },
  no: { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
};

/* ── Badge Información General (SI / NO / — mientras carga) ── */
function InfoBadge({ clave, infoMap }) {
  if (!(clave in infoMap)) {
    return <span style={{ color: "#d1d5db", fontSize: 9 }}>—</span>;
  }
  const cfg = infoMap[clave] ? INFO_CFG.si : INFO_CFG.no;
  return (
    <span style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 900 }}>
      {infoMap[clave] ? "SI" : "NO"}
    </span>
  );
}

/* ── Agrupa todas las obras por programa ── */
function agruparPorPrograma(obrasConAlcances, obrasSinAlcances) {
  const map = {};
  const add = (obra, tieneAlcances) => {
    const prog = obra.programa || "SIN PROGRAMA";
    if (!map[prog]) map[prog] = { programa: prog, conAlcances: [], sinAlcances: [] };
    if (tieneAlcances) map[prog].conAlcances.push(obra);
    else               map[prog].sinAlcances.push(obra);
  };
  for (const o of obrasConAlcances) add(o, true);
  for (const o of obrasSinAlcances)  add(o, false);
  return Object.values(map).sort((a, b) => a.programa.localeCompare(b.programa, "es"));
}

/* ── Sección de programa: cabecera + tabla (para PDF) ── */
function ProgramaSectionPdf({ prog, showPageBreak, infoMap = {} }) {
  const total = prog.conAlcances.length + prog.sinAlcances.length;
  const pct   = total ? parseFloat(((prog.conAlcances.length / total) * 100).toFixed(1)) : 0;
  const cc    = cobColors(pct);
  const todas = [
    ...prog.conAlcances.map((o) => ({ ...o, _tieneAlcances: true })),
    ...prog.sinAlcances.map((o) => ({ ...o, _tieneAlcances: false })),
  ].sort((a, b) => (a.nombre_obra || "").localeCompare(b.nombre_obra || "", "es"));

  return (
    <div style={{ pageBreakBefore: showPageBreak ? "always" : "auto", breakBefore: showPageBreak ? "page" : "auto", marginBottom: 24 }}>
      {/* Cabecera de programa */}
      <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 16, padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ ...SL, marginBottom: 3 }}>Programa</p>
            <p style={{ fontSize: 14, fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1.3 }}>{esc(prog.programa)}</p>
          </div>
          {/* KPIs mini */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>{total}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Total</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#15803D", margin: 0 }}>{prog.conAlcances.length}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Con alc.</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#B91C1C", margin: 0 }}>{prog.sinAlcances.length}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Sin alc.</p>
            </div>
            <div style={{ background: cc.bg, border: `1px solid ${cc.border}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: cc.text, margin: 0 }}>{pct}%</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: cc.text, opacity: 0.7, margin: 0 }}>Cobertura</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de obras */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            {["#","Obra / Sitio","Clasificación","Alcances","Inf. General","Alcaldía","Últ. Captura"].map((h) => (
              <th key={h} style={{ padding: "9px 12px", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: "#9ca3af", fontWeight: 900, textAlign: h === "#" ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {todas.map((o, i) => {
            const tc = o.tipo_alcance_obra ? TIPO_CFG[o.tipo_alcance_obra] : null;
            return (
              <tr key={o.clave_unica || i} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6", pageBreakInside: "avoid" }}>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#9ca3af", fontWeight: 700, textAlign: "right" }}>{i + 1}</td>
                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#1A1A1A", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.nombre_obra}>{esc(o.nombre_obra)}</td>
                <td style={{ padding: "8px 12px" }}>
                  {tc ? (
                    <span style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 900, textTransform: "uppercase" }}>
                      {esc(o.tipo_alcance_obra)}
                    </span>
                  ) : (
                    <span style={{ color: o._tieneAlcances ? "#d97706" : "#d1d5db", fontSize: 9, fontWeight: 700 }}>
                      {o._tieneAlcances ? "SIN CLASIFICAR" : "—"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 900, textAlign: "center", color: o._tieneAlcances ? "#2563EB" : "#d1d5db" }}>
                  {o._tieneAlcances ? o.total_alcances : "0"}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <InfoBadge clave={o.clave_unica} infoMap={infoMap} />
                </td>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280" }}>{esc(o.alcaldia)}</td>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtFecha(o.ultima_captura)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════ */
export default function ReporteDGModal({ open, onClose, dg, obrasData, generatedAt }) {
  const [logoUrl,    setLogoUrl]    = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [copyLabel,      setCopyLabel]      = useState("Copiar");
  const [downloading,    setDownloading]    = useState(false);
  const [infoGeneralMap, setInfoGeneralMap] = useState({}); /* { [clave]: boolean } SI/NO */
  const pdfRef = useRef(null);

  useEffect(() => {
    getReportLogoDataUrl().then((url) => setLogoUrl(url || ""));
  }, []);

  /* Cuando se pasa obrasData (ya filtradas por DG desde el panel),
     construir reportData directamente — sin llamada al backend.
     Garantiza uso de SEGUIMIENTO correcto desde ObraContext. */
  const reportDataFromObras = useMemo(() => {
    if (!obrasData || !obrasData.length) return null;
    const con = obrasData.filter((o) => o.tiene_alcances);
    const sin = obrasData.filter((o) => !o.tiene_alcances);
    const totalAlcances  = con.reduce((s, o) => s + (o.total_alcances  || 0), 0);
    const totalConceptos = con.reduce((s, o) => s + (o.total_conceptos || 0), 0);
    const ultimaAct = con.length
      ? con.reduce((mx, o) => (o.ultima_captura && o.ultima_captura > mx ? o.ultima_captura : mx), con[0].ultima_captura)
      : null;
    const pct = obrasData.length
      ? parseFloat(((con.length / obrasData.length) * 100).toFixed(1))
      : 0;
    return {
      success: true,
      kpis: {
        total_obras:             obrasData.length,
        obras_con_alcances:      con.length,
        obras_sin_alcances:      sin.length,
        cobertura_pct:           pct,
        total_alcances:          totalAlcances,
        total_conceptos:         totalConceptos,
        ultima_actualizacion:    ultimaAct,
        programas_participantes: new Set(obrasData.map((o) => o.programa).filter(Boolean)).size,
      },
      obras_con_alcances: con,
      obras_sin_alcances: sin,
    };
  }, [obrasData]);

  useEffect(() => {
    if (!open || !dg) return;

    if (reportDataFromObras) {
      /* Datos ya disponibles desde el panel — sin llamada al backend */
      setReportData(reportDataFromObras);
      setLoading(false);
      return;
    }

    /* Fallback: llamar API cuando no se pasa obrasData */
    setLoading(true); setError(null); setReportData(null);
    coberturaAPI.getReporte({ dg })
      .then((res) => setReportData(res))
      .catch((e)  => setError(e.message || "Error al generar el reporte."))
      .finally(() => setLoading(false));
  }, [open, dg, reportDataFromObras]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* Consulta estado de Información General para las obras del reporte */
  useEffect(() => {
    if (!obrasData || !obrasData.length) { setInfoGeneralMap({}); return; }
    const claves = obrasData.map((o) => o.clave_unica).filter(Boolean);
    infoGeneralAPI.conteos(claves)
      .then((r) => {
        const m = {};
        for (const [clave, capturados] of Object.entries(r.data || {})) {
          m[clave] = capturados > 0;
        }
        setInfoGeneralMap(m);
      })
      .catch(() => setInfoGeneralMap({}));
  }, [obrasData]);

  const kpis             = reportData?.kpis || null;
  const obrasConAlcances = reportData?.obras_con_alcances || [];
  const obrasSinAlcances = reportData?.obras_sin_alcances || [];

  const programas = useMemo(
    () => agruparPorPrograma(obrasConAlcances, obrasSinAlcances),
    [obrasConAlcances, obrasSinAlcances],
  );

  const reportText = useMemo(() => {
    if (!reportData) return "";
    const { kpis: k } = reportData;
    const lines = [
      "GOBIERNO DE LA CIUDAD DE MÉXICO",
      "SOBSE · Control de Cobertura",
      "",
      `DIRECCIÓN GENERAL: ${dg}`,
      `Generado: ${generatedAt || new Date().toLocaleDateString("es-MX")}`,
      "",
      `Total de obras:    ${k.total_obras}`,
      `Con alcances:      ${k.obras_con_alcances}`,
      `Sin alcances:      ${k.obras_sin_alcances}`,
      `Cobertura:         ${k.cobertura_pct}%`,
      `Total alcances:    ${k.total_alcances}`,
      `Programas:         ${k.programas_participantes}`,
      "",
      ...programas.flatMap((p) => {
        const total = p.conAlcances.length + p.sinAlcances.length;
        const pct = total ? ((p.conAlcances.length / total) * 100).toFixed(1) : 0;
        return [
          `PROGRAMA: ${p.programa}`,
          `  ${total} obras · ${p.conAlcances.length} con alcances · ${p.sinAlcances.length} sin alcances · ${pct}% cobertura`,
          ...p.sinAlcances.map((o) => `  ⚠ SIN ALCANCES: ${o.nombre_obra || o.clave_unica}`),
          "",
        ];
      }),
    ];
    return lines.join("\n");
  }, [reportData, dg, generatedAt, programas]);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(reportText);
      else {
        const ta = document.createElement("textarea");
        ta.value = reportText;
        ta.style.cssText = "position:fixed;left:-9999px;top:0;";
        ta.setAttribute("aria-hidden", "true");
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyLabel("¡Copiado!");
    } catch { setCopyLabel("Error"); }
    finally { window.setTimeout(() => setCopyLabel("Copiar"), 2000); }
  }, [reportText]);

  const handleDownload = useCallback(async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await openPrintWindow(
        pdfRef.current.innerHTML,
        `Reporte DG ${dg} · Control de Cobertura · SOBSE`,
      );
    } catch { /* silently ignore */ }
    finally { setDownloading(false); }
  }, [dg]);

  if (!open) return null;

  const btnBase = {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "1px solid", transition: "opacity 0.15s",
  };

  return (
    <>
      {/* ── DIV OCULTO PARA PDF ── */}
      <div ref={pdfRef} aria-hidden="true"
        style={{ position:"fixed", top:0, left:"-9999px", width:"794px", background:"white",
          padding:"24px", boxSizing:"border-box",
          fontFamily:"Arial, Helvetica, sans-serif", color:"#111827", zIndex:-1 }}>
        {reportData && (
          <>
            {/* Header institucional */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, borderBottom:"3px solid #691C32", marginBottom:24, paddingBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:14, flex:"1 1 320px", minWidth:0 }}>
                {logoUrl && (
                  <img src={logoUrl} alt="Logo SOBSE" style={{ height:50, width:"auto", objectFit:"contain", flexShrink:0 }}
                    onError={(e) => { e.currentTarget.style.display="none"; }} />
                )}
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:10, fontWeight:900, letterSpacing:"0.24em", textTransform:"uppercase", color:"#9ca3af", margin:"0 0 4px" }}>
                    CONTROL DE COBERTURA · REPORTE POR DIRECCIÓN GENERAL
                  </p>
                  <h1 style={{ fontSize:26, lineHeight:1.15, fontWeight:900, color:"#111827", margin:0 }}>{esc(dg)}</h1>
                  <p style={{ fontSize:14, fontWeight:700, color:"#691C32", margin:"6px 0 0" }}>
                    Alcances Registrados por Programa
                  </p>
                </div>
              </div>
              <p style={{ fontSize:11, color:"#6b7280", margin:0, textAlign:"right" }}>
                {generatedAt || new Date().toLocaleDateString("es-MX")}
              </p>
            </div>

            {/* Resumen General */}
            <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:16, padding:20, marginBottom:24 }}>
              <div style={{ display:"flex", gap:20, justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <p style={SL}>Resumen General de la DG</p>
                  <p style={{ fontSize:36, fontWeight:900, color:"#111827", margin:"0 0 2px" }}>{kpis.total_obras}</p>
                  <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 16px" }}>obras totales</p>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {[
                      { label:"Con Alcances", value:kpis.obras_con_alcances, bg:"#ECFDF5", text:"#15803D", border:"#DCFCE7" },
                      { label:"Sin Alcances", value:kpis.obras_sin_alcances, bg:"#FEE2E2", text:"#B91C1C", border:"#FECACA" },
                      { label:"Cobertura",    value:`${kpis.cobertura_pct}%`, ...cobColors(kpis.cobertura_pct) },
                    ].map(({ label, value, bg, text, border }) => (
                      <div key={label} style={{ background:bg, border:`1px solid ${border}`, borderRadius:12, padding:"12px 18px" }}>
                        <p style={{ fontSize:8, textTransform:"uppercase", letterSpacing:"0.18em", color:text, opacity:0.8, margin:"0 0 3px" }}>{label}</p>
                        <p style={{ fontSize:24, fontWeight:900, color:text, margin:0 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:16, padding:"18px 20px", minWidth:180, flexShrink:0 }}>
                  <p style={SL}>Última captura</p>
                  <p style={{ fontSize:20, fontWeight:900, color:"#691C32", margin:"0 0 4px", lineHeight:1.2 }}>
                    {fmtFecha(kpis.ultima_actualizacion)}
                  </p>
                  <p style={{ fontSize:10, color:"#9ca3af", margin:"0 0 10px" }}>Corte de registro</p>
                  <p style={{ fontSize:10, fontWeight:700, margin:0, color:kpis.obras_con_alcances > 0 ? "#15803d" : "#b91c1c" }}>
                    {kpis.obras_con_alcances > 0 ? "🟢 Con registros" : "🔴 Sin registros"}
                  </p>
                </div>
              </div>
            </div>

            {/* Secciones por Programa */}
            {programas.map((prog, idx) => (
              <ProgramaSectionPdf key={prog.programa} prog={prog} showPageBreak={idx > 0} infoMap={infoGeneralMap} />
            ))}
          </>
        )}
      </div>

      {/* ── MODAL VISIBLE ── */}
      <div style={{ position:"fixed", inset:0, zIndex:1000, backgroundColor:"rgba(0,0,0,0.50)", backdropFilter:"blur(3px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />

      <div style={{ position:"fixed", inset:0, zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div style={{ width:"100%", maxWidth:960, maxHeight:"90vh", background:"white", borderRadius:24,
          boxShadow:"0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16,
            borderBottom:"1px solid #E5E7EB", padding:"20px 24px", flexShrink:0, flexWrap:"wrap" }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:9, fontWeight:900, letterSpacing:"0.24em", textTransform:"uppercase", color:"#9ca3af", margin:"0 0 4px" }}>
                CONTROL DE COBERTURA · REPORTE POR DIRECCIÓN GENERAL
              </p>
              <h2 style={{ fontSize:22, fontWeight:900, color:"#111827", margin:0, lineHeight:1.2 }}>{dg}</h2>
              <p style={{ fontSize:13, fontWeight:700, color:"#691C32", margin:"4px 0 0" }}>Alcances Registrados por Programa</p>
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
              <button type="button" onClick={handleCopy}
                style={{ ...btnBase, background:"white", borderColor:"#E5E7EB", color:"#374151" }}>
                📋 {copyLabel}
              </button>
              <button type="button" onClick={handleDownload} disabled={!reportData || downloading}
                style={{ ...btnBase, background:!reportData || downloading ? "#9ca3af" : "#691C32",
                  borderColor:"transparent", color:"white", cursor:!reportData ? "not-allowed" : "pointer" }}>
                ↓ {downloading ? "Abriendo..." : "Descargar PDF"}
              </button>
              <button type="button" onClick={onClose}
                style={{ ...btnBase, background:"white", borderColor:"#E5E7EB", color:"#6b7280" }}>✕</button>
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {loading && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"60px 0" }}>
                <div style={{ width:36, height:36, border:"4px solid #691C32", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                <span style={{ fontSize:14, color:"#6b7280" }}>Generando reporte…</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {error && !loading && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:16, padding:24, textAlign:"center" }}>
                <p style={{ fontWeight:700, color:"#B91C1C", margin:"0 0 6px", fontSize:14 }}>Error al generar el reporte</p>
                <p style={{ color:"#B91C1C", margin:0, fontSize:13 }}>{error}</p>
              </div>
            )}

            {reportData && !loading && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* KPI Strip */}
                <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:24, padding:20 }}>
                  <div style={{ display:"flex", gap:20, justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:220 }}>
                      <p style={{ fontSize:9, fontWeight:900, letterSpacing:"0.2em", textTransform:"uppercase", color:"#9ca3af", margin:"0 0 6px" }}>Resumen</p>
                      <p style={{ fontSize:36, fontWeight:900, color:"#111827", margin:"0 0 2px" }}>{kpis.total_obras}</p>
                      <p style={{ fontSize:11, color:"#9ca3af", margin:"0 0 14px" }}>obras en esta DG</p>
                      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                        {[
                          { label:"Con Alcances",    value:kpis.obras_con_alcances,                    bg:"#ECFDF5", text:"#15803D" },
                          { label:"Sin Alcances",    value:kpis.obras_sin_alcances,                    bg:"#FEE2E2", text:"#B91C1C" },
                          { label:"Cobertura",       value:`${kpis.cobertura_pct}%`,                   bg:cobColors(kpis.cobertura_pct).bg, text:cobColors(kpis.cobertura_pct).text },
                          { label:"Alcances",        value:kpis.total_alcances.toLocaleString("es-MX"), bg:"#EEF2FF", text:"#3730A3" },
                          { label:"Programas",       value:programas.length,                            bg:"#F3E8EC", text:"#691C32" },
                        ].map(({ label, value, bg, text }) => (
                          <div key={label} style={{ background:bg, borderRadius:12, padding:"10px 16px" }}>
                            <p style={{ fontSize:8, textTransform:"uppercase", letterSpacing:"0.16em", color:text, opacity:0.75, margin:"0 0 3px" }}>{label}</p>
                            <p style={{ fontSize:20, fontWeight:900, color:text, margin:0 }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:16, padding:"16px 18px", minWidth:180, flexShrink:0 }}>
                      <p style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:"#9ca3af", margin:"0 0 6px" }}>Última captura</p>
                      <p style={{ fontSize:18, fontWeight:900, color:"#691C32", margin:"0 0 4px" }}>{fmtFecha(kpis.ultima_actualizacion)}</p>
                    </div>
                  </div>
                </div>

                {/* Secciones por Programa */}
                {programas.map((prog) => {
                  const total = prog.conAlcances.length + prog.sinAlcances.length;
                  const pct   = total ? parseFloat(((prog.conAlcances.length / total) * 100).toFixed(1)) : 0;
                  const cc    = cobColors(pct);
                  const todas = [
                    ...prog.conAlcances.map((o) => ({ ...o, _tieneAlcances: true })),
                    ...prog.sinAlcances.map((o) => ({ ...o, _tieneAlcances: false })),
                  ].sort((a, b) => (a.nombre_obra || "").localeCompare(b.nombre_obra || "", "es"));

                  return (
                    <div key={prog.programa} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:24, overflow:"hidden" }}>
                      {/* Cabecera de programa */}
                      <div style={{ background:"#F9FAFB", padding:"14px 20px", borderBottom:"1px solid #E5E7EB",
                        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                        <div style={{ minWidth:0, flex:1 }}>
                          <p style={{ fontSize:9, fontWeight:900, letterSpacing:"0.2em", textTransform:"uppercase", color:"#9ca3af", margin:"0 0 3px" }}>Programa</p>
                          <p style={{ fontSize:14, fontWeight:900, color:"#111827", margin:0, lineHeight:1.3 }}>{prog.programa}</p>
                        </div>
                        <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, fontWeight:700, color:"#374151" }}>{total} obras</span>
                          <span style={{ fontSize:11, fontWeight:700, color:"#15803D" }}>· {prog.conAlcances.length} con alc.</span>
                          {prog.sinAlcances.length > 0 && <span style={{ fontSize:11, fontWeight:700, color:"#B91C1C" }}>· {prog.sinAlcances.length} sin alc.</span>}
                          <span style={{ background:cc.bg, color:cc.text, padding:"2px 10px", borderRadius:99, fontSize:11, fontWeight:900 }}>{pct}%</span>
                        </div>
                      </div>

                      {/* Tabla de obras del programa */}
                      <div style={{ overflowX:"auto", maxHeight:300, overflowY:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                          <thead style={{ position:"sticky", top:0 }}>
                            <tr style={{ background:"#F9FAFB" }}>
                              {["#","Obra / Sitio","Clasificación","Alc.","Inf. General","Alcaldía","Últ. Captura"].map((h) => (
                                <th key={h} style={{ padding:"9px 12px", fontSize:8, textTransform:"uppercase", letterSpacing:"0.14em",
                                  color:"#9ca3af", fontWeight:900, textAlign:h==="Alc."||h==="Inf. General"||h==="#"?"center":"left",
                                  borderBottom:"1px solid #E5E7EB", whiteSpace:"nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {todas.map((o, i) => {
                              const tc = o.tipo_alcance_obra ? TIPO_CFG[o.tipo_alcance_obra] : null;
                              return (
                                <tr key={o.clave_unica || i} style={{ background:i%2===0?"white":"#FAFAFA", borderBottom:"1px solid #F3F4F6" }}>
                                  <td style={{ padding:"8px 12px", fontSize:10, color:"#9ca3af", fontWeight:700, textAlign:"center" }}>{i+1}</td>
                                  <td style={{ padding:"8px 12px", fontSize:11, fontWeight:700, color:"#1A1A1A",
                                    maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                                    title={o.nombre_obra}>{o.nombre_obra}</td>
                                  <td style={{ padding:"8px 12px" }}>
                                    {tc ? (
                                      <span style={{ background:tc.bg, color:tc.text, border:`1px solid ${tc.border}`, padding:"2px 8px",
                                        borderRadius:99, fontSize:8, fontWeight:900, textTransform:"uppercase" }}>
                                        {o.tipo_alcance_obra}
                                      </span>
                                    ) : (
                                      <span style={{ color: o._tieneAlcances ? "#d97706" : "#d1d5db", fontSize:9, fontWeight:700 }}>
                                        {o._tieneAlcances ? "SIN CLASIFICAR" : "—"}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding:"8px 12px", fontSize:11, fontWeight:900, textAlign:"center",
                                    color: o._tieneAlcances ? "#2563EB" : "#d1d5db" }}>
                                    {o._tieneAlcances ? o.total_alcances : "0"}
                                  </td>
                                  <td style={{ padding:"8px 12px", textAlign:"center" }}>
                                    <InfoBadge clave={o.clave_unica} infoMap={infoGeneralMap} />
                                  </td>
                                  <td style={{ padding:"8px 12px", fontSize:10, color:"#6b7280" }}>{o.alcaldia}</td>
                                  <td style={{ padding:"8px 12px", fontSize:10, color:"#6b7280", whiteSpace:"nowrap" }}>{fmtFecha(o.ultima_captura)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
