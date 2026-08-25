/**
 * pages/CoberturaAlcances/ReporteBalon.jsx
 * Reporte exclusivo para EL BALÓN VUELVE AL BARRIO.
 * Agrupa las canchas por DG RESPONSABLE (columna DG, no SEGUIMIENTO).
 * Permite a DGPEST enviar reportes específicos a cada DG ejecutora.
 *
 * Activación: solo desde ProgramaAccordion cuando
 *   programa === "EL BALÓN VUELVE AL BARRIO" && seguimiento === "DGPEST"
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const TIPO_CFG = {
  PROYECTADO: { bg: "#EFF6FF", text: "#2563EB", border: "#DBEAFE" },
  EJECUTADO:  { bg: "#ECFDF5", text: "#15803D", border: "#DCFCE7" },
};

const SL = {
  fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "#9ca3af", margin: "0 0 6px",
};

/* ── Colores del programa ── */
const PROG_COLOR = "#065f46"; // verde oscuro balón

/* Agrupa obras por DG responsable */
function agruparPorDGResponsable(obras) {
  const map = {};
  for (const o of obras) {
    const key = o.dg_responsable || "SIN DG ASIGNADO";
    if (!map[key]) map[key] = { dg: key, conAlcances: [], sinAlcances: [] };
    if (o.tiene_alcances) map[key].conAlcances.push(o);
    else                  map[key].sinAlcances.push(o);
  }
  return Object.values(map).sort((a, b) => a.dg.localeCompare(b.dg, "es"));
}

/* ── HTML string para PDF individual por DG ── */
function buildDGHtml(grupo, logoUrl, generatedAt, kpisGlobal) {
  const total = grupo.conAlcances.length + grupo.sinAlcances.length;
  const pct   = total ? parseFloat(((grupo.conAlcances.length / total) * 100).toFixed(1)) : 0;
  const cc    = cobColors(pct);
  const todas = [
    ...grupo.conAlcances.map((o) => ({ ...o, _tieneAlcances: true })),
    ...grupo.sinAlcances.map((o) => ({ ...o, _tieneAlcances: false })),
  ].sort((a, b) => (a.nombre_obra || "").localeCompare(b.nombre_obra || "", "es"));

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo SOBSE" style="height:50px;width:auto;object-fit:contain;flex-shrink:0;" />`
    : "";

  const thStyle = (h) =>
    `padding:9px 12px;font-size:8px;text-transform:uppercase;letter-spacing:0.16em;color:#9ca3af;font-weight:900;text-align:${h === "#" ? "right" : "left"};`;

  const rows = todas.map((o, i) => {
    const tc = o.tipo_alcance_obra ? TIPO_CFG[o.tipo_alcance_obra] : null;
    const badge = tc
      ? `<span style="background:${tc.bg};color:${tc.text};border:1px solid ${tc.border};padding:2px 8px;border-radius:99px;font-size:8px;font-weight:900;text-transform:uppercase;">${esc(o.tipo_alcance_obra)}</span>`
      : `<span style="color:${o._tieneAlcances ? "#d97706" : "#d1d5db"};font-size:9px;font-weight:700;">${o._tieneAlcances ? "SIN CLASIFICAR" : "—"}</span>`;
    return `<tr style="background:${i % 2 === 0 ? "white" : "#FAFAFA"};border-bottom:1px solid #F3F4F6;page-break-inside:avoid;">
      <td style="padding:8px 12px;font-size:10px;color:#9ca3af;font-weight:700;text-align:right;">${i + 1}</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#1A1A1A;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(o.nombre_obra)}">${esc(o.nombre_obra)}</td>
      <td style="padding:8px 12px;">${badge}</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:900;text-align:center;color:${o._tieneAlcances ? "#2563EB" : "#d1d5db"};">${o._tieneAlcances ? o.total_alcances : "0"}</td>
      <td style="padding:8px 12px;font-size:10px;color:#6b7280;">${esc(o.alcaldia)}</td>
      <td style="padding:8px 12px;font-size:10px;color:#6b7280;white-space:nowrap;">${fmtFecha(o.ultima_captura)}</td>
    </tr>`;
  }).join("");

  const globalKpiHtml = kpisGlobal
    ? `<div style="background:#EEF2FF;border:1px solid #E0E7FF;border-radius:12px;padding:12px 18px;">
        <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#3730A3;opacity:0.8;margin:0 0 3px;">Cob. global prog.</p>
        <p style="font-size:24px;font-weight:900;color:#3730A3;margin:0;">${kpisGlobal.pct}%</p>
      </div>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;padding:24px;max-width:794px;margin:0 auto;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;border-bottom:3px solid #065f46;margin-bottom:24px;padding-bottom:16px;">
      <div style="display:flex;align-items:center;gap:14px;flex:1 1 320px;min-width:0;">
        ${logoHtml}
        <div>
          <p style="font-size:9px;font-weight:900;letter-spacing:0.24em;text-transform:uppercase;color:#9ca3af;margin:0 0 4px;">CONTROL DE COBERTURA · REPORTE POR DG RESPONSABLE</p>
          <h1 style="font-size:22px;line-height:1.15;font-weight:900;color:#065f46;margin:0;">EL BALÓN VUELVE AL BARRIO</h1>
          <p style="font-size:13px;font-weight:700;color:#374151;margin:6px 0 0;">Seguimiento: DGPEST · DG Responsable: <strong>${esc(grupo.dg)}</strong></p>
        </div>
      </div>
      <p style="font-size:11px;color:#6b7280;margin:0;text-align:right;">${generatedAt || new Date().toLocaleDateString("es-MX")}</p>
    </div>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:20px;margin-bottom:24px;">
      <p style="font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#065f46;margin:0 0 12px;">Resumen · ${esc(grupo.dg)}</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:12px 18px;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#065f46;opacity:0.8;margin:0 0 3px;">Total canchas</p>
          <p style="font-size:24px;font-weight:900;color:#065f46;margin:0;">${total}</p>
        </div>
        <div style="background:#ECFDF5;border:1px solid #DCFCE7;border-radius:12px;padding:12px 18px;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#15803D;opacity:0.8;margin:0 0 3px;">Con alcances</p>
          <p style="font-size:24px;font-weight:900;color:#15803D;margin:0;">${grupo.conAlcances.length}</p>
        </div>
        <div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:12px;padding:12px 18px;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:#B91C1C;opacity:0.8;margin:0 0 3px;">Sin alcances</p>
          <p style="font-size:24px;font-weight:900;color:#B91C1C;margin:0;">${grupo.sinAlcances.length}</p>
        </div>
        <div style="background:${cc.bg};border:1px solid ${cc.border};border-radius:12px;padding:12px 18px;">
          <p style="font-size:8px;text-transform:uppercase;letter-spacing:0.18em;color:${cc.text};opacity:0.8;margin:0 0 3px;">Cobertura</p>
          <p style="font-size:24px;font-weight:900;color:${cc.text};margin:0;">${pct}%</p>
        </div>
        ${globalKpiHtml}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
          ${["#", "Cancha / Sitio", "Clasificación", "Alcances", "Alcaldía", "Últ. Captura"]
            .map((h) => `<th style="${thStyle(h)}">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ── Sección de DG responsable para PDF ── */
function DGSectionPdf({ grupo, showPageBreak }) {
  const total = grupo.conAlcances.length + grupo.sinAlcances.length;
  const pct   = total ? parseFloat(((grupo.conAlcances.length / total) * 100).toFixed(1)) : 0;
  const cc    = cobColors(pct);
  const todas = [
    ...grupo.conAlcances.map((o) => ({ ...o, _tieneAlcances: true })),
    ...grupo.sinAlcances.map((o) => ({ ...o, _tieneAlcances: false })),
  ].sort((a, b) => (a.nombre_obra || "").localeCompare(b.nombre_obra || "", "es"));

  return (
    <div style={{ pageBreakBefore: showPageBreak ? "always" : "auto", breakBefore: showPageBreak ? "page" : "auto", marginBottom: 24 }}>
      {/* Cabecera de DG responsable */}
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 16, padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ ...SL, color: "#065f46", marginBottom: 3 }}>DG Responsable (Ejecutora)</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#065f46", margin: 0, lineHeight: 1.3 }}>{esc(grupo.dg)}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>{total}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Total</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#15803D", margin: 0 }}>{grupo.conAlcances.length}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Con alc.</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#B91C1C", margin: 0 }}>{grupo.sinAlcances.length}</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", margin: 0 }}>Sin alc.</p>
            </div>
            <div style={{ background: cc.bg, border: `1px solid ${cc.border}`, borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: cc.text, margin: 0 }}>{pct}%</p>
              <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", color: cc.text, opacity: 0.7, margin: 0 }}>Cobertura</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de canchas */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            {["#", "Cancha / Sitio", "Clasificación", "Alcances", "Alcaldía", "Últ. Captura"].map((h) => (
              <th key={h} style={{ padding: "9px 12px", fontSize: 8, textTransform: "uppercase",
                letterSpacing: "0.16em", color: "#9ca3af", fontWeight: 900,
                textAlign: h === "#" ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {todas.map((o, i) => {
            const tc = o.tipo_alcance_obra ? TIPO_CFG[o.tipo_alcance_obra] : null;
            return (
              <tr key={o.clave_unica || i}
                style={{ background: i % 2 === 0 ? "white" : "#FAFAFA",
                  borderBottom: "1px solid #F3F4F6", pageBreakInside: "avoid" }}>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#9ca3af", fontWeight: 700, textAlign: "right" }}>{i + 1}</td>
                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#1A1A1A",
                  maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={o.nombre_obra}>{esc(o.nombre_obra)}</td>
                <td style={{ padding: "8px 12px" }}>
                  {tc ? (
                    <span style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                      padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 900, textTransform: "uppercase" }}>
                      {esc(o.tipo_alcance_obra)}
                    </span>
                  ) : (
                    <span style={{ color: o._tieneAlcances ? "#d97706" : "#d1d5db", fontSize: 9, fontWeight: 700 }}>
                      {o._tieneAlcances ? "SIN CLASIFICAR" : "—"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 900, textAlign: "center",
                  color: o._tieneAlcances ? "#2563EB" : "#d1d5db" }}>
                  {o._tieneAlcances ? o.total_alcances : "0"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280" }}>{esc(o.alcaldia)}</td>
                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {fmtFecha(o.ultima_captura)}
                </td>
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
export default function ReporteBalon({ open, onClose, obrasData, generatedAt }) {
  const [logoUrl,     setLogoUrl]     = useState("");
  const [copyLabel,   setCopyLabel]   = useState("Copiar");
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    getReportLogoDataUrl().then((url) => setLogoUrl(url || ""));
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* Agrupación y KPIs — todo en memoria, sin llamada al backend */
  const grupos = useMemo(() => agruparPorDGResponsable(obrasData || []), [obrasData]);

  const kpis = useMemo(() => {
    const base = obrasData || [];
    const con  = base.filter((o) => o.tiene_alcances);
    const sin  = base.filter((o) => !o.tiene_alcances);
    const pct  = base.length ? parseFloat(((con.length / base.length) * 100).toFixed(1)) : 0;
    return { total: base.length, con: con.length, sin: sin.length, pct, dgs: grupos.length };
  }, [obrasData, grupos]);

  /* Texto plano para copiar */
  const reportText = useMemo(() => {
    const lines = [
      "GOBIERNO DE LA CIUDAD DE MÉXICO",
      "SOBSE · Control de Cobertura",
      "",
      "PROGRAMA: EL BALÓN VUELVE AL BARRIO",
      "SEGUIMIENTO: DGPEST",
      `Generado: ${generatedAt || new Date().toLocaleDateString("es-MX")}`,
      "",
      `Total de canchas:  ${kpis.total}`,
      `Con alcances:      ${kpis.con}`,
      `Sin alcances:      ${kpis.sin}`,
      `Cobertura:         ${kpis.pct}%`,
      `DGs responsables:  ${kpis.dgs}`,
      "",
      ...grupos.flatMap((g) => {
        const total = g.conAlcances.length + g.sinAlcances.length;
        const pct = total ? ((g.conAlcances.length / total) * 100).toFixed(1) : 0;
        return [
          `── DG RESPONSABLE: ${g.dg} ──`,
          `   ${total} canchas · ${g.conAlcances.length} con alcances · ${g.sinAlcances.length} sin alcances · ${pct}% cobertura`,
          ...g.sinAlcances.map((o) => `   ⚠ SIN ALCANCES: ${o.nombre_obra || o.clave_unica}`),
          "",
        ];
      }),
    ];
    return lines.join("\n");
  }, [kpis, grupos, generatedAt]);

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
        "Reporte por DG Responsable · EL BALÓN VUELVE AL BARRIO · SOBSE",
      );
    } catch { /* silently ignore */ }
    finally { setDownloading(false); }
  }, []);

  const handleDownloadDG = useCallback(async (grupo) => {
    try {
      const html = buildDGHtml(grupo, logoUrl, generatedAt, kpis);
      await openPrintWindow(
        html,
        `Reporte ${grupo.dg} · EL BALÓN VUELVE AL BARRIO · SOBSE`,
      );
    } catch { /* silently ignore */ }
  }, [logoUrl, generatedAt, kpis]);

  if (!open) return null;

  const btnBase = {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "1px solid", transition: "opacity 0.15s",
  };

  const sinDGInfo = grupos.some((g) => g.dg === "SIN DG ASIGNADO");

  return (
    <>
      {/* ── DIV OCULTO PARA PDF ── */}
      <div ref={pdfRef} aria-hidden="true"
        style={{ position: "fixed", top: 0, left: "-9999px", width: "794px",
          background: "white", padding: "24px", boxSizing: "border-box",
          fontFamily: "Arial, Helvetica, sans-serif", color: "#111827", zIndex: -1 }}>

        {/* Header institucional */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16, borderBottom: `3px solid ${PROG_COLOR}`, marginBottom: 24, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, flex: "1 1 320px", minWidth: 0 }}>
            {logoUrl && (
              <img src={logoUrl} alt="Logo SOBSE" style={{ height: 50, width: "auto", objectFit: "contain", flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 4px" }}>
                CONTROL DE COBERTURA · REPORTE POR DG RESPONSABLE
              </p>
              <h1 style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 900, color: PROG_COLOR, margin: 0 }}>
                EL BALÓN VUELVE AL BARRIO
              </h1>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "6px 0 0" }}>
                Seguimiento: DGPEST · Cobertura por DG Ejecutora
              </p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#6b7280", margin: 0, textAlign: "right" }}>
            {generatedAt || new Date().toLocaleDateString("es-MX")}
          </p>
        </div>

        {/* Resumen General */}
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <p style={{ ...SL, color: PROG_COLOR }}>Resumen General</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {[
              { label: "Total canchas",    value: kpis.total,  bg: "#F0FDF4", text: PROG_COLOR,  border: "#BBF7D0" },
              { label: "Con alcances",     value: kpis.con,    bg: "#ECFDF5", text: "#15803D",   border: "#DCFCE7" },
              { label: "Sin alcances",     value: kpis.sin,    bg: "#FEE2E2", text: "#B91C1C",   border: "#FECACA" },
              { label: "Cobertura",        value: `${kpis.pct}%`, ...cobColors(kpis.pct) },
              { label: "DGs responsables", value: kpis.dgs,   bg: "#EEF2FF", text: "#3730A3",   border: "#E0E7FF" },
            ].map(({ label, value, bg, text, border }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 18px" }}>
                <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.18em", color: text, opacity: 0.8, margin: "0 0 3px" }}>{label}</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: text, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Secciones por DG responsable */}
        {grupos.map((g, idx) => (
          <DGSectionPdf key={g.dg} grupo={g} showPageBreak={idx > 0} />
        ))}
      </div>

      {/* ── MODAL VISIBLE ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(3px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} />

      <div style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 1000, maxHeight: "92vh", background: "white", borderRadius: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header del modal */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
            borderBottom: `3px solid ${PROG_COLOR}`, padding: "20px 24px", flexShrink: 0, flexWrap: "wrap",
            background: `linear-gradient(135deg, ${PROG_COLOR} 0%, #047857 60%, #059669 100%)` }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.65)", margin: "0 0 4px" }}>
                CONTROL DE COBERTURA · REPORTE POR DG RESPONSABLE
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
                EL BALÓN VUELVE AL BARRIO
              </h2>
              <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.80)", margin: "4px 0 0" }}>
                Seguimiento: DGPEST · {kpis.dgs} DGs ejecutoras · {kpis.total} canchas
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button type="button" onClick={handleCopy}
                style={{ ...btnBase, background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.30)", color: "#fff" }}>
                📋 {copyLabel}
              </button>
              <button type="button" onClick={handleDownload} disabled={downloading}
                style={{ ...btnBase, background: downloading ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.25)",
                  borderColor: "rgba(255,255,255,0.40)", color: "#fff",
                  cursor: downloading ? "not-allowed" : "pointer" }}>
                ↓ {downloading ? "Abriendo..." : "Descargar PDF"}
              </button>
              <button type="button" onClick={onClose}
                style={{ ...btnBase, background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.30)", color: "#fff" }}>
                ✕
              </button>
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f8fffe" }}>

            {/* Aviso cuando hay canchas sin DG asignado */}
            {sinDGInfo && (
              <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12,
                padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                ⚠ Algunas canchas no tienen DG registrada en la columna DG de la tabla.
                Aparecen bajo "SIN DG ASIGNADO".
              </div>
            )}

            {/* KPI strip */}
            <div style={{ background: "white", border: "1px solid #BBF7D0", borderRadius: 20, padding: 20, marginBottom: 20 }}>
              <p style={{ ...SL, color: PROG_COLOR }}>Resumen General</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                {[
                  { label: "Total canchas",    value: kpis.total,       bg: "#F0FDF4", text: PROG_COLOR },
                  { label: "Con alcances",     value: kpis.con,         bg: "#ECFDF5", text: "#15803D" },
                  { label: "Sin alcances",     value: kpis.sin,         bg: "#FEE2E2", text: "#B91C1C" },
                  { label: "Cobertura",        value: `${kpis.pct}%`,   ...cobColors(kpis.pct) },
                  { label: "DGs responsables", value: kpis.dgs,         bg: "#EEF2FF", text: "#3730A3" },
                ].map(({ label, value, bg, text }) => (
                  <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 16px" }}>
                    <p style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: text, opacity: 0.75, margin: "0 0 3px" }}>{label}</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: text, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Secciones por DG responsable */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {grupos.map((g) => {
                const total = g.conAlcances.length + g.sinAlcances.length;
                const pct   = total ? parseFloat(((g.conAlcances.length / total) * 100).toFixed(1)) : 0;
                const cc    = cobColors(pct);
                const todas = [
                  ...g.conAlcances.map((o) => ({ ...o, _tieneAlcances: true })),
                  ...g.sinAlcances.map((o) => ({ ...o, _tieneAlcances: false })),
                ].sort((a, b) => (a.nombre_obra || "").localeCompare(b.nombre_obra || "", "es"));

                return (
                  <div key={g.dg} style={{ background: "white", border: "1px solid #D1FAE5", borderRadius: 20, overflow: "hidden" }}>
                    {/* Cabecera DG */}
                    <div style={{ background: "#F0FDF4", padding: "14px 20px", borderBottom: "1px solid #D1FAE5",
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase",
                          color: PROG_COLOR, margin: "0 0 3px" }}>DG Responsable (Ejecutora)</p>
                        <p style={{ fontSize: 15, fontWeight: 900, color: PROG_COLOR, margin: 0, lineHeight: 1.3 }}>{g.dg}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{total} canchas</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#15803D" }}>· {g.conAlcances.length} con alc.</span>
                        {g.sinAlcances.length > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C" }}>· {g.sinAlcances.length} sin alc.</span>
                        )}
                        <span style={{ background: cc.bg, color: cc.text, padding: "3px 12px", borderRadius: 99, fontSize: 12, fontWeight: 900 }}>
                          {pct}%
                        </span>
                        <button type="button" onClick={() => handleDownloadDG(g)}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                            borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            border: "1px solid #BBF7D0", background: PROG_COLOR, color: "white",
                            whiteSpace: "nowrap", flexShrink: 0 }}>
                          ↓ PDF
                        </button>
                      </div>
                    </div>

                    {/* Tabla de canchas */}
                    <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead style={{ position: "sticky", top: 0 }}>
                          <tr style={{ background: "#F9FAFB" }}>
                            {["#", "Cancha / Sitio", "Clasificación", "Alc.", "Alcaldía", "Últ. Captura"].map((h) => (
                              <th key={h} style={{ padding: "9px 12px", fontSize: 8, textTransform: "uppercase",
                                letterSpacing: "0.14em", color: "#9ca3af", fontWeight: 900,
                                textAlign: h === "Alc." || h === "#" ? "center" : "left",
                                borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {todas.map((o, i) => {
                            const tc = o.tipo_alcance_obra ? TIPO_CFG[o.tipo_alcance_obra] : null;
                            return (
                              <tr key={o.clave_unica || i}
                                style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                                <td style={{ padding: "8px 12px", fontSize: 10, color: "#9ca3af", fontWeight: 700, textAlign: "center" }}>{i + 1}</td>
                                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#1A1A1A",
                                  maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={o.nombre_obra}>{o.nombre_obra}</td>
                                <td style={{ padding: "8px 12px" }}>
                                  {tc ? (
                                    <span style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`,
                                      padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 900, textTransform: "uppercase" }}>
                                      {o.tipo_alcance_obra}
                                    </span>
                                  ) : (
                                    <span style={{ color: o._tieneAlcances ? "#d97706" : "#d1d5db", fontSize: 9, fontWeight: 700 }}>
                                      {o._tieneAlcances ? "SIN CLASIFICAR" : "—"}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 900, textAlign: "center",
                                  color: o._tieneAlcances ? "#2563EB" : "#d1d5db" }}>
                                  {o._tieneAlcances ? o.total_alcances : "0"}
                                </td>
                                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280" }}>{o.alcaldia}</td>
                                <td style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>
                                  {fmtFecha(o.ultima_captura)}
                                </td>
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

          </div>
        </div>
      </div>
    </>
  );
}
