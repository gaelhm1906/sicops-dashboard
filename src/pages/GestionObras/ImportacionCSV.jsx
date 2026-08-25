/**
 * pages/GestionObras/ImportacionCSV.jsx
 * Importación masiva de obras desde CSV.
 * Flujo: Upload → Preview → Confirmar → Resultado
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { importacionAPI } from "../../utils/api";

/* ── Parser CSV minimal (sin dependencias externas) ── */
function parseCSV(text) {
  const clean  = text.replace(/^﻿/, ""); /* quitar BOM si existe */
  const lines  = clean.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if      (c === '"' && !inQ)          inQ = true;
      else if (c === '"' &&  inQ && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"' &&  inQ)          inQ = false;
      else if (c === ','  && !inQ)         { result.push(cur.trim()); cur = ""; }
      else                                 cur += c;
    }
    result.push(cur.trim());
    return result;
  };

  /* Normalizar headers: minúsculas, sin tildes, espacios → _ */
  const rawHeaders = parseLine(lines[0]);
  const headers    = rawHeaders.map((h) =>
    h.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  /* Mapeo de sinónimos de headers */
  const ALIAS = {
    nombre: "nombre_obra",
    tipo:   "tipo_geometria",
    calle:  "calle_domicilio",
    url:    "url_google_maps",
    observacion: "observaciones",
    geometria:   "wkt",
    geometry:    "wkt",
    direccion_general: "dg",
  };
  const normHeaders = headers.map((h) => ALIAS[h] || h);

  const rows = lines.slice(1).map((line, lineIdx) => {
    const vals = parseLine(line);
    const row  = { _linea_original: lineIdx + 2 };
    normHeaders.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });

  return { headers: normHeaders, rows };
}

/* ── Genera CSV de errores para descarga ── */
function generarCSVErrores(resultados) {
  const errOnly = resultados.filter((r) => r.estado === "ERROR" || r.estado === "AVISO");
  if (!errOnly.length) return null;

  const cols = [
    "fila_num","nombre_obra","programa","dg","seguimiento","alcaldia",
    "tipo_geometria","estatus","wkt","estado","errores","avisos",
  ];
  const header = cols.join(",");
  const filas  = errOnly.map((r) => [
    r.fila_num,
    r.nombre_obra, r.programa, r.dg, r.seguimiento, r.alcaldia,
    r.tipo_geometria, r.estatus,
    `"${(r.wkt || "").replace(/"/g, '""').slice(0, 80)}"`,
    r.estado,
    `"${r.errores.join("; ").replace(/"/g, '""')}"`,
    `"${r.avisos.join("; ").replace(/"/g, '""')}"`,
  ].join(","));
  return [header, ...filas].join("\r\n");
}

const T = {
  accent:     "#2563eb",
  title:      "#1e293b",
  textSoft:   "#64748b",
  divider:    "#e2e8f0",
  dangerSoft: "#fef2f2",
  danger:     "#b91c1c",
  warnBg:     "#fffbeb",
  warnText:   "#92400e",
  okBg:       "#f0fdf4",
  okText:     "#15803d",
};

const ESTADO_CFG = {
  VALIDO: { bg: "#f0fdf4", text: "#15803d", border: "#86efac", label: "✓ Válido"    },
  AVISO:  { bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "⚠ Aviso"     },
  ERROR:  { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", label: "✗ Error"     },
};

const STEP = { IDLE: 0, VALIDANDO: 1, VALIDADO: 2, IMPORTANDO: 3, LISTO: 4 };

export default function ImportacionCSV({ onClose, onSuccess }) {
  const [step,          setStep]          = useState(STEP.IDLE);
  const [archivo,       setArchivo]       = useState(null);
  const [filasParsed,   setFilasParsed]   = useState([]);
  const [resultados,    setResultados]    = useState([]);
  const [resumen,       setResumen]       = useState(null);
  const [resultado,     setResultado]     = useState(null);
  const [error,         setError]         = useState(null);
  const [expandido,     setExpandido]     = useState(null);
  const [filtroEstado,  setFiltroEstado]  = useState("TODOS");
  const fileRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && step !== STEP.IMPORTANDO) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [step, onClose]);

  /* ── Leer archivo ── */
  const handleFile = useCallback((file) => {
    if (!file) return;
    setArchivo(file); setError(null); setStep(STEP.IDLE);
    setResultados([]); setResumen(null); setResultado(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { rows } = parseCSV(e.target.result);
        if (!rows.length) { setError("El archivo está vacío o no tiene filas de datos."); return; }
        if (rows.length > 1000) { setError("El archivo supera el límite de 1,000 filas."); return; }
        setFilasParsed(rows);
      } catch { setError("Error al leer el archivo CSV."); }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
    else setError("Solo se aceptan archivos .csv");
  }, [handleFile]);

  /* ── Validar en backend ── */
  const handlePreview = useCallback(async () => {
    if (!filasParsed.length) { setError("No hay filas para validar."); return; }
    setStep(STEP.VALIDANDO); setError(null);
    try {
      const r = await importacionAPI.preview(filasParsed);
      setResumen(r.resumen);
      setResultados(r.resultados || []);
      setStep(STEP.VALIDADO);
    } catch (e) {
      setError(e.message || "Error al validar."); setStep(STEP.IDLE);
    }
  }, [filasParsed]);

  /* ── Ejecutar importación ── */
  const handleImportar = useCallback(async () => {
    const validas = resultados.filter((r) => r.estado !== "ERROR");
    if (!validas.length) { setError("No hay filas válidas para importar."); return; }
    setStep(STEP.IMPORTANDO); setError(null);
    try {
      const res = await importacionAPI.ejecutar(
        validas.map((r) => ({
          tipo_geometria: r.tipo_geometria, nombre_obra: r.nombre_obra,
          programa:       r.programa,       dg:          r.dg,
          seguimiento:    r.seguimiento,    alcaldia:    r.alcaldia,
          estatus:        r.estatus,        wkt:         r.wkt,
          colonia:        r.datos?.colonia        || "",
          calle_domicilio:r.datos?.calle_domicilio|| r.datos?.calle || "",
          url_google_maps:r.datos?.url_google_maps|| "",
          observaciones:  r.datos?.observaciones  || "",
          tipo:           r.datos?.tipo            || "",
          modalidad:      r.datos?.modalidad       || "",
          responsable_dg: r.datos?.responsable_dg  || "",
        })),
        archivo?.name || "importacion.csv"
      );
      setResultado(res);
      setStep(STEP.LISTO);
    } catch (e) {
      setError(e.message || "Error al importar."); setStep(STEP.VALIDADO);
    }
  }, [resultados, archivo]);

  /* ── Descargar errores como CSV ── */
  const descargarErrores = useCallback(() => {
    const csv = generarCSVErrores(resultados);
    if (!csv) return;
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "errores_importacion.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [resultados]);

  /* ── Filtrado de resultados ── */
  const resultadosFiltrados = resultados.filter((r) =>
    filtroEstado === "TODOS" || r.estado === filtroEstado
  );
  const conErrores = resultados.filter((r) => r.estado === "ERROR").length;
  const conAvisos  = resultados.filter((r) => r.estado === "AVISO").length;
  const validas    = resultados.filter((r) => r.estado !== "ERROR").length;

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && step !== STEP.IMPORTANDO) onClose(); }} />

      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 51 }}>
        <div className="w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)" }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(219,234,254,0.65)" }}>Gestión de Obras · Importación</p>
              <h2 className="mt-1 text-lg font-bold text-white">Importación Masiva CSV</h2>
            </div>
            <div className="flex gap-2 items-center">
              <button type="button" onClick={() => importacionAPI.descargarPlantilla()}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.28)", cursor: "pointer" }}>
                ⬇ Plantilla
              </button>
              {step !== STEP.IMPORTANDO && (
                <button type="button" onClick={onClose}
                  style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "50%", cursor: "pointer", fontWeight: 700 }}>✕</button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* STEP 0 / 1: Upload + Validar */}
            {(step === STEP.IDLE || step === STEP.VALIDANDO) && (
              <>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
                  style={{ border: "2px dashed #93c5fd", backgroundColor: "#eff6ff",
                    padding: "32px 20px", marginBottom: 16 }}>
                  <input ref={fileRef} type="file" accept=".csv"
                    className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                  <span style={{ fontSize: 40 }}>📂</span>
                  <p className="font-bold" style={{ color: T.accent }}>
                    {archivo ? archivo.name : "Arrastra o haz clic para seleccionar el CSV"}
                  </p>
                  {archivo && (
                    <p className="text-sm" style={{ color: T.textSoft }}>
                      {filasParsed.length} filas detectadas · {(archivo.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                  {!archivo && (
                    <p className="text-xs" style={{ color: T.textSoft }}>
                      Máximo 1,000 filas · UTF-8 · Separado por comas
                    </p>
                  )}
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl text-sm mb-3"
                    style={{ backgroundColor: T.dangerSoft, color: T.danger, border: "1px solid #fecaca" }}>
                    {error}
                  </div>
                )}
              </>
            )}

            {/* STEP 2: Validado — tabla de resultados */}
            {(step === STEP.VALIDADO || step === STEP.IMPORTANDO) && resumen && (
              <>
                {/* Resumen */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total filas",    n: resumen.total,       bg: "#f8fafc", text: "#1e293b" },
                    { label: "Válidas",        n: validas,             bg: "#f0fdf4", text: "#15803d" },
                    { label: "Con errores",    n: conErrores,          bg: "#fef2f2", text: "#b91c1c" },
                    { label: "Con avisos",     n: conAvisos,           bg: "#fffbeb", text: "#92400e" },
                  ].map(({ label, n, bg, text }) => (
                    <div key={label} className="rounded-xl px-4 py-3 text-center"
                      style={{ backgroundColor: bg, border: `1px solid ${bg === "#f8fafc" ? "#e2e8f0" : "transparent"}` }}>
                      <p className="text-xs font-semibold" style={{ color: T.textSoft }}>{label}</p>
                      <p className="text-2xl font-black mt-0.5" style={{ color: text }}>{n}</p>
                    </div>
                  ))}
                </div>

                {/* Filtros tabla */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {["TODOS","VALIDO","AVISO","ERROR"].map((f) => (
                    <button key={f} type="button" onClick={() => setFiltroEstado(f)}
                      className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: filtroEstado === f ? T.accent : "#f1f5f9",
                        color:           filtroEstado === f ? "#fff"    : T.textSoft,
                        border: "none", cursor: "pointer",
                      }}>
                      {f === "TODOS" ? `Todos (${resultados.length})` : `${ESTADO_CFG[f]?.label} (${resultados.filter(r => r.estado === f).length})`}
                    </button>
                  ))}
                  {conErrores + conAvisos > 0 && (
                    <button type="button" onClick={descargarErrores}
                      className="text-xs font-semibold px-3 py-1 rounded-full ml-auto"
                      style={{ backgroundColor: "#fef2f2", color: T.danger,
                        border: "1px solid #fecaca", cursor: "pointer" }}>
                      ⬇ Descargar errores CSV
                    </button>
                  )}
                </div>

                {/* Tabla de resultados */}
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#e2e8f0" }}>
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    <table className="w-full border-collapse text-xs">
                      <thead style={{ position: "sticky", top: 0, backgroundColor: "#f8fafc" }}>
                        <tr>
                          {["Fila","Estado","Nombre","Programa","DG","Alcaldía","Tipo Geom.","Detalles"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wide"
                              style={{ color: T.textSoft, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultadosFiltrados.map((r, i) => {
                          const cfg = ESTADO_CFG[r.estado];
                          const msgs = [...(r.errores || []), ...(r.avisos || [])];
                          return (
                            <React.Fragment key={r.fila_num}>
                              <tr style={{ background: i % 2 === 0 ? "#fff" : "#fafafa",
                                borderBottom: "1px solid #f1f5f9", cursor: msgs.length ? "pointer" : "default" }}
                                onClick={() => setExpandido(expandido === r.fila_num ? null : r.fila_num)}>
                                <td className="px-3 py-2 font-mono font-bold" style={{ color: "#94a3b8" }}>{r.fila_num}</td>
                                <td className="px-3 py-2">
                                  <span className="font-bold px-2 py-0.5 rounded-full text-[10px]"
                                    style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-semibold" style={{ color: T.title, maxWidth: 160,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.nombre_obra || "—"}
                                </td>
                                <td className="px-3 py-2" style={{ color: T.textSoft, maxWidth: 120,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.programa || "—"}
                                </td>
                                <td className="px-3 py-2 font-semibold" style={{ color: "#3730a3" }}>{r.dg || "—"}</td>
                                <td className="px-3 py-2" style={{ color: T.textSoft }}>{r.alcaldia || "—"}</td>
                                <td className="px-3 py-2" style={{ color: T.textSoft }}>{r.tipo_geometria || "—"}</td>
                                <td className="px-3 py-2" style={{ color: T.textSoft }}>
                                  {msgs.length > 0 ? `${msgs.length} mensaje${msgs.length !== 1 ? "s" : ""} ↕` : "—"}
                                </td>
                              </tr>
                              {expandido === r.fila_num && msgs.length > 0 && (
                                <tr>
                                  <td colSpan={8} className="px-4 py-2"
                                    style={{ background: cfg.bg + "88" }}>
                                    <ul className="space-y-0.5">
                                      {r.errores.map((e, j) => (
                                        <li key={j} className="text-[11px] font-medium"
                                          style={{ color: T.danger }}>✗ {e}</li>
                                      ))}
                                      {r.avisos.map((a, j) => (
                                        <li key={j} className="text-[11px] font-medium"
                                          style={{ color: T.warnText }}>⚠ {a}</li>
                                      ))}
                                    </ul>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {conErrores > 0 && (
                  <div className="mt-3 px-4 py-2.5 rounded-xl text-xs font-medium"
                    style={{ backgroundColor: T.dangerSoft, color: T.danger, border: "1px solid #fecaca" }}>
                    Hay {conErrores} fila{conErrores !== 1 ? "s" : ""} con errores.
                    {validas > 0
                      ? ` Se importarán las ${validas} válidas (con o sin avisos).`
                      : " Corrige el archivo y vuelve a validar."}
                  </div>
                )}

                {error && (
                  <div className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: T.dangerSoft, color: T.danger, border: "1px solid #fecaca" }}>
                    {error}
                  </div>
                )}
              </>
            )}

            {/* STEP 3: Importando */}
            {step === STEP.IMPORTANDO && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: T.accent, borderTopColor: "transparent" }} />
                <p className="font-semibold" style={{ color: T.title }}>
                  Importando {validas} obras…
                </p>
                <p className="text-sm" style={{ color: T.textSoft }}>
                  Insertando registros y verificando integridad…
                </p>
              </div>
            )}

            {/* STEP 4: Listo */}
            {step === STEP.LISTO && resultado && (
              <div className="flex flex-col items-center py-10 gap-4">
                <span style={{ fontSize: 48 }}>✅</span>
                <p className="text-xl font-black" style={{ color: "#15803d" }}>
                  {resultado.total_importadas} obras importadas
                </p>
                <p className="text-sm" style={{ color: T.textSoft }}>
                  Lote: {resultado.lote_id}
                </p>
                <div className="px-6 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#15803d" }}>
                  ✓ Integridad verificada — todos los registros existen en catálogo y tienen geometría válida.
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 flex justify-between gap-3"
            style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
            {step !== STEP.IMPORTANDO && step !== STEP.LISTO && (
              <button type="button" onClick={onClose}
                className="text-sm font-medium px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "#f1f5f9", color: T.textSoft,
                  border: "1px solid #e2e8f0", cursor: "pointer" }}>
                Cancelar
              </button>
            )}
            {step === STEP.LISTO && (
              <button type="button" onClick={() => { onSuccess?.(); onClose(); }}
                className="text-sm font-medium px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "#f0fdf4", color: "#15803d",
                  border: "1px solid #86efac", cursor: "pointer" }}>
                Cerrar y actualizar
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              {step === STEP.IDLE && filasParsed.length > 0 && (
                <button type="button" onClick={handlePreview}
                  className="text-sm font-bold px-6 py-2.5 rounded-xl"
                  style={{ backgroundColor: T.accent, color: "#fff", border: "none",
                    cursor: "pointer", boxShadow: "0 6px 16px rgba(37,99,235,0.28)" }}>
                  Validar CSV ({filasParsed.length} filas)
                </button>
              )}
              {step === STEP.VALIDANDO && (
                <button disabled className="text-sm font-bold px-6 py-2.5 rounded-xl"
                  style={{ backgroundColor: "#93c5fd", color: "#fff", border: "none", cursor: "not-allowed" }}>
                  Validando…
                </button>
              )}
              {step === STEP.VALIDADO && validas > 0 && (
                <>
                  <button type="button" onClick={() => { setStep(STEP.IDLE); setResultados([]); setResumen(null); }}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: "#f1f5f9", color: T.textSoft,
                      border: "1px solid #e2e8f0", cursor: "pointer" }}>
                    ← Nuevo archivo
                  </button>
                  <button type="button" onClick={handleImportar}
                    className="text-sm font-bold px-6 py-2.5 rounded-xl"
                    style={{ backgroundColor: "#15803d", color: "#fff", border: "none",
                      cursor: "pointer", boxShadow: "0 6px 16px rgba(21,128,61,0.28)" }}>
                    Importar {validas} obra{validas !== 1 ? "s" : ""}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
