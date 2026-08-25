/**
 * pages/GestionObras/ModalEdicion.jsx
 * Edición controlada de atributos de obra.
 * Solo ADMIN y GEOESTADISTICA. Motivo obligatorio.
 * Auditoría automática vía trigger.
 */
import React, { useState, useEffect, useCallback } from "react";
import { geoestadisticaAPI, obrasAPI } from "../../utils/api";

const DGS      = ["DGCOP","DGOIV","DGOT","DGPEST","DGSUS","ILIFE","IECM"];
const ESTATUSES = ["SIN INICIAR","EN PROCESO","SUSPENDIDO","TERMINADA","INAUGURADA","CANCELADA"];
const ALCALDIAS = [
  "ÁLVARO OBREGÓN","AZCAPOTZALCO","BENITO JUÁREZ","COYOACÁN",
  "CUAJIMALPA DE MORELOS","CUAUHTÉMOC","GUSTAVO A. MADERO",
  "IZTACALCO","IZTAPALAPA","LA MAGDALENA CONTRERAS",
  "MIGUEL HIDALGO","MILPA ALTA","TLÁHUAC","TLALPAN",
  "VENUSTIANO CARRANZA","XOCHIMILCO",
];

const T = {
  headerBg:    "linear-gradient(135deg, #78350f 0%, #d97706 60%, #f59e0b 100%)",
  accent:      "#d97706",
  accentDark:  "#92400e",
  text:        "#1e293b",
  textSoft:    "#64748b",
  inputBg:     "#f8fafc",
  inputBorder: "#cbd5e1",
  divider:     "#e2e8f0",
  danger:      "#b91c1c",
  dangerSoft:  "#fef2f2",
  dangerBorder:"#fecaca",
  warnBg:      "#fffbeb",
  warnBorder:  "#fde68a",
  warnText:    "#92400e",
};

const FIELD_H = "2.375rem";
const fieldStyle = {
  height: FIELD_H, fontSize: "0.875rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.text,
  paddingLeft: "0.625rem", paddingRight: "0.625rem",
  width: "100%", boxSizing: "border-box",
};

function Field({ label, required, children, warn }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1"
        style={{ color: T.textSoft }}>
        {label} {required && <span style={{ color: T.danger }}>*</span>}
        {warn && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: T.warnBg, color: T.warnText, border: `1px solid ${T.warnBorder}` }}>
          impacto sistémico
        </span>}
      </label>
      {children}
    </div>
  );
}

export default function ModalEdicion({ obra, onClose, onSuccess }) {
  const [detalle,  setDetalle]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({});
  const [motivo,   setMotivo]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  /* Cargar detalle completo para pre-rellenar */
  useEffect(() => {
    geoestadisticaAPI.getObraDetalle(obra.clave_unica)
      .then((r) => {
        const o = r.obra || {};
        setDetalle(o);
        setForm({
          nombre_obra:    o["NOMBRE_OBRA"]        || "",
          identificador:  o["IDENTIFICADOR"]       || "",
          estatus:        o["ESTATUS"]             || "",
          dg:             o["DG"]                  || "",
          seguimiento:    o["SEGUIMIENTO"]         || "",
          programa:       o["PROGRAMA"]            || "",
          alcaldia:       o["ALCALDIA"]            || "",
          colonia:        o["COLONIA"]             || "",
          calle_domicilio:o["CALLE/DOMICILIO"]     || "",
          url_google_maps:o["URL DE GOOGLE MAPS"]  || "",
          observaciones:  o["OBSERVACIONES"]       || "",
          tipo:           o["TIPO"]                || "",
          modalidad:      o["MODALIDAD"]           || "",
          responsable_dg: o["RESPONSABLE_DG"]      || "",
          monto:          o["MONTO"]         != null ? String(o["MONTO"])         : "",
          anio:           o["YEAR"]          != null ? String(o["YEAR"])           : "",
          clave_eje:      o["CLAVE_EJE"]           || "",
          nombre_eje:     o["NOMBRE_EJE"]          || "",
          bloque_mundial: o["BLOQUE_MUNDIAL"] != null ? String(o["BLOQUE_MUNDIAL"]) : "",
          clave_programa: o["CLAVE_PROGRAMA"]      || "",
          avance_real:        o["AVANCE REAL"]            || "",
          fecha_inauguracion: o["FECHA INAUGURACION"]
            ? String(o["FECHA INAUGURACION"]).split("T")[0]
            : "",
          motivo_cancelacion: o["MOTIVO CANCELACION"]     || "",
          superficie_m2:      o["SUPERFICIE_M2"]          != null ? String(o["SUPERFICIE_M2"]) : "",
          material:           o["MATERIAL"]               || "",
          origen_compromiso:  o["ORIGEN DEL COMPROMISO"]  || "",
          origen_recurso:     o["ORIGEN DEL RECURSO"]     || "",
          fondo_recurso:      o["FONDO DEL RECURSO"]      || "",
          capitulo_recurso:   o["CAPITULO DEL RECURSO"]   || "",
          long_km:            o["Long (km)"]              != null ? String(o["Long (km)"]) : "",
          geom_wkt:           o["geom_wkt"]               || "",
          modo_calculo_avance: o["modo_calculo_avance"]   || "GENERAL",
        });
      })
      .catch(() => setError("Error al cargar los datos de la obra."))
      .finally(() => setLoading(false));
  }, [obra.clave_unica]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = useCallback((field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setError(null);
  }, []);

  const handleGuardar = useCallback(async () => {
    if (!motivo.trim()) { setError("El motivo del cambio es obligatorio."); return; }

    /* Calcular qué campos cambiaron */
    const changes = {};
    if (detalle) {
      const map = {
        nombre_obra:    "NOMBRE_OBRA",
        identificador:  "IDENTIFICADOR",
        estatus:        "ESTATUS",
        dg:             "DG",
        seguimiento:    "SEGUIMIENTO",
        programa:       "PROGRAMA",
        alcaldia:       "ALCALDIA",
        colonia:        "COLONIA",
        calle_domicilio:"CALLE/DOMICILIO",
        url_google_maps:"URL DE GOOGLE MAPS",
        observaciones:  "OBSERVACIONES",
        tipo:           "TIPO",
        modalidad:      "MODALIDAD",
        responsable_dg: "RESPONSABLE_DG",
        clave_eje:      "CLAVE_EJE",
        nombre_eje:     "NOMBRE_EJE",
        clave_programa: "CLAVE_PROGRAMA",
        avance_real:        "AVANCE REAL",
        motivo_cancelacion: "MOTIVO CANCELACION",
        superficie_m2:      "SUPERFICIE_M2",
        material:           "MATERIAL",
        origen_compromiso:  "ORIGEN DEL COMPROMISO",
        origen_recurso:     "ORIGEN DEL RECURSO",
        fondo_recurso:      "FONDO DEL RECURSO",
        capitulo_recurso:   "CAPITULO DEL RECURSO",
      };
      for (const [key, col] of Object.entries(map)) {
        const original = (detalle[col] || "").trim();
        const nuevo    = (form[key]   || "").trim();
        if (original !== nuevo) changes[key] = form[key];
      }
      /* Campos numéricos — comparar por valor */
      const numMap = { monto: "MONTO", anio: "YEAR", bloque_mundial: "BLOQUE_MUNDIAL", long_km: "Long (km)" };
      for (const [key, col] of Object.entries(numMap)) {
        const original = detalle[col] != null ? String(detalle[col]) : "";
        const nuevo    = (form[key] || "").trim();
        if (original !== nuevo) changes[key] = form[key];
      }
      /* fecha_inauguracion — normalizar a YYYY-MM-DD antes de comparar */
      const origFecha = detalle["FECHA INAUGURACION"]
        ? String(detalle["FECHA INAUGURACION"]).split("T")[0]
        : "";
      const newFecha = (form.fecha_inauguracion || "").trim();
      if (origFecha !== newFecha && newFecha) changes.fecha_inauguracion = newFecha;
      /* geom_wkt — geometría WKT */
      const origWkt = (detalle["geom_wkt"] || "").trim();
      const newWkt  = (form.geom_wkt || "").trim();
      if (origWkt !== newWkt && newWkt) changes.geom_wkt = newWkt;
    } else {
      Object.assign(changes, form);
    }

    const modoOriginal = detalle?.["modo_calculo_avance"] || "GENERAL";
    const modoChanged = form.modo_calculo_avance && form.modo_calculo_avance !== modoOriginal;

    if (!Object.keys(changes).length && !modoChanged) {
      setError("No se realizaron cambios."); return;
    }

    setSaving(true); setError(null);
    try {
      if (Object.keys(changes).length > 0) {
        await geoestadisticaAPI.modificarAtributos(obra.clave_unica, {
          ...changes,
          motivo: motivo.trim(),
        });
      }
      /* Modo de cálculo de avance — endpoint separado */
      if (modoChanged) {
        await obrasAPI.setModoCalculo(obra.clave_unica, form.modo_calculo_avance);
      }
      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (e) {
      setError(e.message || "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }, [form, detalle, motivo, obra.clave_unica, onSuccess]);

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 51 }}>
        <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

          {/* Header ámbar */}
          <div className="shrink-0 px-6 pt-5 pb-4" style={{ background: T.headerBg }}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "rgba(254,243,199,0.70)" }}>Gestión de Obras · Edición</p>
                <h2 className="mt-1 text-lg font-bold text-white truncate">
                  {obra.nombre_obra || obra.clave_unica}
                </h2>
                <p className="text-xs mt-0.5 font-mono" style={{ color: "rgba(254,243,199,0.60)" }}>
                  {obra.clave_unica}
                </p>
              </div>
              <button type="button" onClick={onClose}
                style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: T.accent, borderTopColor: "transparent" }} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Nombre */}
                <Field label="Nombre de la obra" required>
                  <input type="text" value={form.nombre_obra || ""}
                    onChange={(e) => set("nombre_obra", e.target.value)}
                    style={fieldStyle} />
                </Field>

                {/* Identificador */}
                <Field label="Identificador" warn>
                  <input type="text" value={form.identificador || ""}
                    onChange={(e) => set("identificador", e.target.value)}
                    placeholder="Ej: 09DPR1580S"
                    style={fieldStyle} />
                </Field>
                {form.identificador !== (detalle?.["IDENTIFICADOR"] || "") && (
                  <div className="px-3 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: T.warnBg, color: T.warnText, border: `1px solid ${T.warnBorder}` }}>
                    ⚠ El identificador forma parte de la clave única. Si necesitas actualizar también la clave, usa "Corrección de clave" después de guardar.
                  </div>
                )}

                {/* Estatus */}
                <Field label="Estatus de avance">
                  <select value={form.estatus || ""} onChange={(e) => set("estatus", e.target.value)}
                    style={fieldStyle}>
                    <option value="">Sin cambio</option>
                    {ESTATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                {/* Avance real + Fecha inauguración */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Avance real">
                    <input type="text" value={form.avance_real || ""}
                      onChange={(e) => set("avance_real", e.target.value)}
                      placeholder="Ej: 75%" style={fieldStyle} />
                  </Field>
                  <Field label="Fecha inauguración">
                    <input type="date" value={form.fecha_inauguracion || ""}
                      onChange={(e) => set("fecha_inauguracion", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>

                {/* Modo de cálculo de avance */}
                <Field label="Modo de cálculo de avance">
                  <div className="flex gap-2">
                    {["GENERAL", "FRENTES"].map((modo) => {
                      const activo = (form.modo_calculo_avance || "GENERAL") === modo;
                      return (
                        <button
                          key={modo}
                          type="button"
                          onClick={() => set("modo_calculo_avance", modo)}
                          style={{
                            flex: 1, height: FIELD_H, fontSize: "0.8125rem", fontWeight: 700,
                            borderRadius: "0.5rem", cursor: "pointer", transition: "all 0.15s",
                            border: activo ? `2px solid ${T.accent}` : `1px solid ${T.inputBorder}`,
                            backgroundColor: activo ? "#fffbeb" : T.inputBg,
                            color: activo ? T.accentDark : T.textSoft,
                          }}
                        >
                          {modo === "GENERAL" ? "General (avance_real)" : "Desde frentes (ponderado)"}
                        </button>
                      );
                    })}
                  </div>
                  {(form.modo_calculo_avance || "GENERAL") === "FRENTES" && (
                    <p className="mt-1.5 text-[11px]" style={{ color: T.warnText }}>
                      El avance se calculará como promedio ponderado de los frentes de trabajo vinculados a esta obra.
                      Requiere que existan registros en <code>frentes_obra</code> con esta clave.
                    </p>
                  )}
                </Field>

                {/* Motivo cancelación */}
                <Field label="Motivo cancelación">
                  <input type="text" value={form.motivo_cancelacion || ""}
                    onChange={(e) => set("motivo_cancelacion", e.target.value)}
                    placeholder="Requerido si estatus es CANCELADA"
                    style={fieldStyle} />
                </Field>

                {/* DG + Seguimiento */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="DG (Propietaria)" warn>
                    <select value={form.dg || ""} onChange={(e) => set("dg", e.target.value)}
                      style={fieldStyle}>
                      <option value="">Sin cambio</option>
                      {DGS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Seguimiento" warn>
                    <select value={form.seguimiento || ""} onChange={(e) => set("seguimiento", e.target.value)}
                      style={fieldStyle}>
                      <option value="">Sin cambio</option>
                      {DGS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Advertencia si cambia DG o Seguimiento */}
                {(form.dg || form.seguimiento) && (
                  <div className="px-3 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: T.warnBg, color: T.warnText, border: `1px solid ${T.warnBorder}` }}>
                    ⚠ Cambiar DG o Seguimiento afecta la agrupación en todos los módulos del sistema.
                  </div>
                )}

                {/* Programa */}
                <Field label="Programa" warn>
                  <input type="text" value={form.programa || ""}
                    onChange={(e) => set("programa", e.target.value)}
                    style={fieldStyle} placeholder="Nombre del programa" />
                </Field>

                {/* Alcaldía + Colonia */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Alcaldía">
                    <select value={form.alcaldia || ""} onChange={(e) => set("alcaldia", e.target.value)}
                      style={fieldStyle}>
                      <option value="">Sin cambio</option>
                      {ALCALDIAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </Field>
                  <Field label="Colonia">
                    <input type="text" value={form.colonia || ""}
                      onChange={(e) => set("colonia", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>

                {/* Calle + Tipo */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Calle / Domicilio">
                    <input type="text" value={form.calle_domicilio || ""}
                      onChange={(e) => set("calle_domicilio", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                  <Field label="Tipo">
                    <input type="text" value={form.tipo || ""}
                      onChange={(e) => set("tipo", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>

                {/* Modalidad + Responsable DG */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Modalidad">
                    <input type="text" value={form.modalidad || ""}
                      onChange={(e) => set("modalidad", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                  <Field label="Responsable DG">
                    <input type="text" value={form.responsable_dg || ""}
                      onChange={(e) => set("responsable_dg", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>

                {/* Monto + Año */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monto">
                    <input type="number" min="0" step="0.01" value={form.monto || ""}
                      onChange={(e) => set("monto", e.target.value)}
                      placeholder="0.00" style={fieldStyle} />
                  </Field>
                  <Field label="Año (YEAR)">
                    <input type="number" min="2000" max="2100" step="1" value={form.anio || ""}
                      onChange={(e) => set("anio", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>

                {/* Eje y bloque */}
                <div className="pt-2 pb-1 border-t" style={{ borderColor: T.divider }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>
                    Eje y Bloque
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Clave EJE">
                    <input type="text" value={form.clave_eje || ""}
                      onChange={(e) => set("clave_eje", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                  <Field label="Bloque Mundial">
                    <input type="number" min="1" step="1" value={form.bloque_mundial || ""}
                      onChange={(e) => set("bloque_mundial", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>
                <Field label="Nombre EJE">
                  <input type="text" value={form.nombre_eje || ""}
                    onChange={(e) => set("nombre_eje", e.target.value)}
                    style={fieldStyle} />
                </Field>
                <Field label="Clave Programa">
                  <input type="text" value={form.clave_programa || ""}
                    onChange={(e) => set("clave_programa", e.target.value)}
                    placeholder="Ej: 1_2_3_ESCUELAS, BALON_BARRIO"
                    style={fieldStyle} />
                </Field>

                {/* ─── Datos físicos ─── */}
                <div className="pt-2 pb-1 border-t" style={{ borderColor: T.divider }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>
                    Datos físicos
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Superficie (m²)">
                    <input type="text" value={form.superficie_m2 || ""}
                      onChange={(e) => set("superficie_m2", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                  <Field label="Material">
                    <input type="text" value={form.material || ""}
                      onChange={(e) => set("material", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>
                <Field label="Long (km)">
                  <input type="number" min="0" step="0.001" value={form.long_km || ""}
                    onChange={(e) => set("long_km", e.target.value)}
                    style={fieldStyle} />
                </Field>

                {/* ─── Recurso ─── */}
                <div className="pt-2 pb-1 border-t" style={{ borderColor: T.divider }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>
                    Recurso
                  </p>
                </div>
                <Field label="Origen del compromiso">
                  <input type="text" value={form.origen_compromiso || ""}
                    onChange={(e) => set("origen_compromiso", e.target.value)}
                    style={fieldStyle} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Origen del recurso">
                    <input type="text" value={form.origen_recurso || ""}
                      onChange={(e) => set("origen_recurso", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                  <Field label="Fondo del recurso">
                    <input type="text" value={form.fondo_recurso || ""}
                      onChange={(e) => set("fondo_recurso", e.target.value)}
                      style={fieldStyle} />
                  </Field>
                </div>
                <Field label="Capítulo del recurso">
                  <input type="text" value={form.capitulo_recurso || ""}
                    onChange={(e) => set("capitulo_recurso", e.target.value)}
                    style={fieldStyle} />
                </Field>

                {/* URL Google Maps */}
                <Field label="URL Google Maps">
                  <input type="url" value={form.url_google_maps || ""}
                    onChange={(e) => set("url_google_maps", e.target.value)}
                    placeholder="https://maps.google.com/..."
                    style={fieldStyle} />
                </Field>

                {/* Observaciones */}
                <Field label="Observaciones">
                  <textarea value={form.observaciones || ""}
                    onChange={(e) => set("observaciones", e.target.value)}
                    rows={2} style={{ ...fieldStyle, height: "auto",
                      paddingTop: "0.5rem", paddingBottom: "0.5rem", resize: "none" }} />
                </Field>

                {/* ─── Geometría (WKT) ─── */}
                <div className="pt-2 pb-1 border-t" style={{ borderColor: T.divider }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>
                    Geometría
                  </p>
                </div>
                <div className="px-3 py-2 rounded-xl text-xs mb-1"
                  style={{ backgroundColor: T.warnBg, color: T.warnText, border: `1px solid ${T.warnBorder}` }}>
                  ⚠ Editar el WKT directamente puede corromper la geometría. Usar solo si sabes lo que haces. Para edición visual usa el visor de mapa.
                </div>
                <Field label="Geometría WKT">
                  <textarea
                    value={form.geom_wkt || ""}
                    onChange={(e) => set("geom_wkt", e.target.value)}
                    rows={3}
                    style={{ ...fieldStyle, height: "auto", paddingTop: "0.5rem",
                      paddingBottom: "0.5rem", resize: "vertical", fontFamily: "monospace",
                      fontSize: "0.75rem" }}
                    placeholder="POINT(-99.123 19.456) / LINESTRING(...) / POLYGON(...)"
                  />
                </Field>

                {/* ─── Motivo obligatorio ─── */}
                <div className="mt-1 rounded-xl px-4 py-3"
                  style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <Field label="Motivo del cambio" required>
                    <textarea value={motivo}
                      onChange={(e) => { setMotivo(e.target.value); setError(null); }}
                      placeholder="Describe el motivo de esta modificación. Este campo es obligatorio y quedará registrado en la auditoría."
                      rows={2}
                      style={{ ...fieldStyle, height: "auto",
                        paddingTop: "0.5rem", paddingBottom: "0.5rem", resize: "none",
                        border: `1px solid ${!motivo.trim() ? T.dangerBorder : "#86c49c"}`,
                        backgroundColor: !motivo.trim() ? T.dangerSoft : T.inputBg }} />
                  </Field>
                  <p className="mt-1 text-[10px]" style={{ color: T.textSoft }}>
                    Quedará registrado en obras_auditoria con usuario, fecha, valores anteriores y nuevos.
                  </p>
                </div>

                {error && (
                  <div className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>
                    ✓ Cambios guardados correctamente.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 flex justify-between gap-3"
            style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
            <button type="button" onClick={onClose}
              className="text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: "#f1f5f9", color: T.textSoft,
                border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={handleGuardar}
              disabled={saving || success || loading}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{
                backgroundColor: saving || success || loading ? "#fcd34d" : T.accent,
                color: "#7c2d12", border: "none",
                cursor: saving || success || loading ? "not-allowed" : "pointer",
                boxShadow: saving || success || loading ? "none" : "0 6px 16px rgba(217,119,6,0.28)",
              }}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
