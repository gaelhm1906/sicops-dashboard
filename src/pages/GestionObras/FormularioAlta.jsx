/**
 * pages/GestionObras/FormularioAlta.jsx
 * Modal para dar de alta una nueva obra.
 *
 * Flujo:
 *   A) Identificación (nombre, programa, dg, seguimiento, alcaldía, identificador)
 *   B) Catálogo del programa (CLAVE_EJE, NOMBRE_EJE, BLOQUE_MUNDIAL, CLAVE_PROGRAMA)
 *      ← solo lectura cuando el catálogo existe; bloquea el alta si el programa es nuevo
 *   C) Ubicación (opcional)
 *   D) Datos técnicos (opcional)
 *   E) Vista previa de clave (generada en tiempo real + verificación de disponibilidad)
 *   F) Geometría (obligatorio)
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { geoestadisticaAPI } from "../../utils/api";
import { useAuth }           from "../../context/AuthContext";

/* ── Catálogos estáticos ── */
const PROGRAMAS_EJEMPLO = [
  "1,2,3 POR MI ESCUELA RENOVAR PARA TRANSFORMAR",
  "BALIZAMIENTO DE VIALIDADES","BICIESTACIONAMIENTOS",
  "CIUDAD ILUMINADA, CAMINA LIBRE, CAMINA SEGURA",
  "CIUDAD ILUMINADA: COMUNIDAD SEGURA","CONSTRUCCION DE UTOPIAS",
  "EL BALON VUELVE AL BARRIO",
  "ILUMINACION ARTISTICA DE EDIFICIOS DEL CENTRO HISTORICO",
  "MANTENIMIENTO A MERCADOS PUBLICOS","OBRAS ADICIONALES",
  "PARQUES ALEGRIA","REHABILITACION Y CONSTRUCCION DE PUENTES PEATONALES",
  "REHABILITACION Y CONSTRUCCION DE PUENTES VEHICULARES",
  "REPAVIMENTACION","YOLOTL ANAHUAC",
];
const DGS      = ["DGCOP","DGOIV","DGOT","DGPEST","DGSUS","ILIFE","IECM"];
const ALCALDIAS = [
  "ÁLVARO OBREGÓN","AZCAPOTZALCO","BENITO JUÁREZ","COYOACÁN",
  "CUAJIMALPA DE MORELOS","CUAUHTÉMOC","GUSTAVO A. MADERO",
  "IZTACALCO","IZTAPALAPA","LA MAGDALENA CONTRERAS",
  "MIGUEL HIDALGO","MILPA ALTA","TLÁHUAC","TLALPAN",
  "VENUSTIANO CARRANZA","XOCHIMILCO",
];
const ESTATUSES = ["SIN INICIAR","EN PROCESO","SUSPENDIDO","TERMINADA","INAUGURADA","CANCELADA"];

/* ── Stopwords para slug (idénticas al backend generarClaveUnica) ── */
const STOPWORDS_CLAVE = new Set([
  "EL","LA","LOS","LAS","DE","DEL","Y","A","AL","EN","POR","PARA",
  "CON","SIN","UN","UNA","E","O","U","QUE","SE","SU","LO",
]);

function toSlug(text) {
  return (text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase().split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS_CLAVE.has(w))
    .join("_");
}

function computeClave({ dg, clave_programa, nombre_obra, identificador }) {
  const dgSeg   = (dg || "XX").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const progSeg = toSlug(clave_programa);
  const obraSeg = toSlug(nombre_obra);
  const idPart  = identificador ? `_${toSlug(identificador)}` : "";
  if (!progSeg && !obraSeg) return "";
  return `PLATSOBSE_${dgSeg}_${progSeg}_${obraSeg}${idPart}`;
}

/* ── Estilos ── */
const T = {
  headerBg:    "linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)",
  accent:      "#2563eb",
  accentDark:  "#1e40af",
  text:        "#1e293b",
  textSoft:    "#64748b",
  inputBg:     "#f8fafc",
  inputBorder: "#cbd5e1",
  divider:     "#e2e8f0",
  danger:      "#b91c1c",
  dangerSoft:  "#fef2f2",
  dangerBorder:"#fecaca",
  readonlyBg:  "#f0fdf4",
  readonlyBorder: "#86efac",
};
const FIELD_H = "2.375rem";
const fieldStyle = {
  height: FIELD_H, fontSize: "0.875rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.text,
  paddingLeft: "0.625rem", paddingRight: "0.625rem",
  width: "100%", boxSizing: "border-box",
};
const readonlyStyle = {
  ...fieldStyle,
  backgroundColor: T.readonlyBg,
  border: `1px solid ${T.readonlyBorder}`,
  color: "#15803d",
  fontWeight: 600,
  cursor: "default",
};

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1"
        style={{ color: T.textSoft }}>
        {label} {required && <span style={{ color: T.danger }}>*</span>}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-[10px]" style={{ color: "#94a3b8" }}>{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, color }) {
  return (
    <div className="pt-3 pb-1 border-t" style={{ borderColor: T.divider }}>
      <p className="text-xs font-bold uppercase tracking-wider"
        style={{ color: color || T.accent }}>
        {children}
      </p>
    </div>
  );
}

/* ── Indicador de disponibilidad de clave ── */
function ClaveStatus({ estado }) {
  if (!estado) return null;
  const cfg = {
    loading:    { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd", text: "⏳ Verificando…" },
    disponible: { bg: "#f0fdf4", color: "#15803d", border: "#86efac", text: "✅ Disponible" },
    ocupada:    { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", text: "❌ Ya existe en el sistema" },
    vacia:      { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", text: "—" },
  }[estado] || null;
  if (!cfg) return null;
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.text}
    </span>
  );
}

/* ════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════ */
export default function FormularioAlta({ onClose, onSuccess }) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    tipo_geometria:  "PUNTO",
    nombre_obra:     "",
    programa:        "",
    dg:              "",
    seguimiento:     "",
    alcaldia:        "",
    estatus:         "SIN INICIAR",
    anio:            String(new Date().getFullYear()),
    identificador:   "",
    /* Catálogo del programa — solo lectura cuando existen */
    clave_eje:       "",
    nombre_eje:      "",
    bloque_mundial:  "",
    clave_programa:  "",
    /* Campos opcionales */
    colonia:         "",
    calle_domicilio: "",
    url_google_maps: "",
    observaciones:   "",
    tipo:            "",
    modalidad:       "",
    responsable_dg:  "",
    monto:           "",
    /* Geometría */
    geom_wkt:        "",
  });

  /* Estado del catálogo del programa */
  const [catalogoEstado, setCatalogoEstado] = useState(null); /* null | 'loading' | 'found' | 'not_found' */
  /* Estado de disponibilidad de la clave */
  const [claveEstado, setClaveEstado]       = useState(null); /* null | 'loading' | 'disponible' | 'ocupada' | 'vacia' */
  /* Clave generada en tiempo real */
  const [clavePrevia, setClavePrevia]       = useState("");

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const debouncePrograma = useRef(null);
  const debounceVerifica = useRef(null);

  /* ESC cierra */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* ── Generación de clave en tiempo real ── */
  useEffect(() => {
    const nueva = computeClave({
      dg:            form.dg,
      clave_programa:form.clave_programa,
      nombre_obra:   form.nombre_obra,
      identificador: form.identificador,
    });
    setClavePrevia(nueva);

    /* Si no hay suficientes datos para la clave, no verificar */
    if (!nueva) {
      setClaveEstado("vacia");
      return;
    }

    /* Verificar disponibilidad con debounce */
    if (debounceVerifica.current) clearTimeout(debounceVerifica.current);
    setClaveEstado("loading");
    debounceVerifica.current = setTimeout(async () => {
      try {
        const r = await geoestadisticaAPI.verificarClave(nueva);
        setClaveEstado(r.disponible ? "disponible" : "ocupada");
      } catch {
        setClaveEstado(null);
      }
    }, 500);
  }, [form.dg, form.clave_programa, form.nombre_obra, form.identificador]);

  /* ── Autocompletado del catálogo al cambiar programa ── */
  const handleProgramaChange = useCallback((val) => {
    setForm((p) => ({ ...p, programa: val, clave_eje: "", nombre_eje: "", bloque_mundial: "", clave_programa: "" }));
    setCatalogoEstado(null);
    setError(null);

    if (debouncePrograma.current) clearTimeout(debouncePrograma.current);
    if (!val.trim()) return;

    setCatalogoEstado("loading");
    debouncePrograma.current = setTimeout(async () => {
      try {
        const r = await geoestadisticaAPI.getCatalogoPrograma(val.trim());
        if (r.data) {
          setForm((p) => ({
            ...p,
            clave_eje:      r.data.clave_eje      || "",
            nombre_eje:     r.data.nombre_eje     || "",
            bloque_mundial: r.data.bloque_mundial != null ? String(r.data.bloque_mundial) : "",
            clave_programa: r.data.clave_programa || "",
          }));
          setCatalogoEstado("found");
        } else {
          setCatalogoEstado("not_found");
        }
      } catch {
        setCatalogoEstado(null);
      }
    }, 600);
  }, []);

  const set = useCallback((field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setError(null);
  }, []);

  /* ── Condiciones para habilitar el botón Crear ── */
  const camposObligatoriosOk =
    form.tipo_geometria && form.nombre_obra.trim() && form.programa.trim() &&
    form.dg.trim() && form.seguimiento.trim() && form.alcaldia.trim() && form.geom_wkt.trim();

  const puedeGuardar =
    !saving && !success &&
    catalogoEstado === "found" &&
    claveEstado === "disponible" &&
    !!camposObligatoriosOk;

  /* ── Envío ── */
  const handleSubmit = useCallback(async () => {
    if (!puedeGuardar) return;
    setSaving(true); setError(null);
    try {
      await geoestadisticaAPI.altaObra({
        tipo_geometria:  form.tipo_geometria,
        clave_unica:     clavePrevia,
        identificador:   form.identificador.trim() || undefined,
        nombre_obra:     form.nombre_obra.trim(),
        programa:        form.programa.trim(),
        clave_programa:  form.clave_programa || undefined,
        dg:              form.dg.trim(),
        seguimiento:     form.seguimiento.trim(),
        alcaldia:        form.alcaldia.trim(),
        estatus:         form.estatus || "SIN INICIAR",
        anio:            form.anio.trim() || undefined,
        bloque_mundial:  form.bloque_mundial || undefined,
        clave_eje:       form.clave_eje || undefined,
        nombre_eje:      form.nombre_eje || undefined,
        geom_wkt:        form.geom_wkt.trim(),
        colonia:         form.colonia.trim()         || undefined,
        calle_domicilio: form.calle_domicilio.trim() || undefined,
        url_google_maps: form.url_google_maps.trim() || undefined,
        observaciones:   form.observaciones.trim()   || undefined,
        tipo:            form.tipo.trim()             || undefined,
        modalidad:       form.modalidad.trim()        || undefined,
        responsable_dg:  form.responsable_dg.trim()  || undefined,
        monto:           form.monto.trim()            || undefined,
      });
      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (e) {
      setError(e.message || "Error al crear la obra.");
    } finally {
      setSaving(false);
    }
  }, [puedeGuardar, form, clavePrevia, onSuccess]);

  /* ── Render de campo de catálogo (solo lectura) ── */
  const ReadonlyField = ({ label, value, hint }) => (
    <Field label={label} hint={hint}>
      <div style={{ ...readonlyStyle, display: "flex", alignItems: "center" }}>
        <span className="text-xs font-semibold truncate">{value || "—"}</span>
        {value && (
          <span className="ml-auto text-[9px] font-bold shrink-0"
            style={{ color: "#15803d" }}>AUTO</span>
        )}
      </div>
    </Field>
  );

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 51 }}>
        <div className="w-full max-w-2xl max-h-[94vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

          {/* Header */}
          <div className="shrink-0 px-6 pt-5 pb-4" style={{ background: T.headerBg }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "rgba(219,234,254,0.65)" }}>Gestión de Obras</p>
                <h2 className="mt-1 text-lg font-bold text-white">Alta de Nueva Obra</h2>
              </div>
              <button type="button" onClick={onClose}
                style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%", cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

            {/* ══ BLOQUE A — Tipo de geometría ══ */}
            <Field label="Tipo de Geometría" required>
              <div className="flex gap-2">
                {["PUNTO","LINEA","POLIGONO"].map((t) => (
                  <button key={t} type="button" onClick={() => set("tipo_geometria", t)}
                    className="flex-1 py-2 text-xs font-bold rounded-xl"
                    style={{ backgroundColor: form.tipo_geometria === t ? T.accent : "#f1f5f9",
                      color: form.tipo_geometria === t ? "#fff" : T.textSoft,
                      border: `2px solid ${form.tipo_geometria === t ? T.accent : "#e2e8f0"}`,
                      cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Nombre de la Obra" required>
              <input type="text" value={form.nombre_obra}
                onChange={(e) => set("nombre_obra", e.target.value)}
                style={fieldStyle} autoFocus />
            </Field>

            <Field label="Programa" required>
              <input type="text" list="lista-programas" value={form.programa}
                onChange={(e) => handleProgramaChange(e.target.value)}
                placeholder="Seleccionar o escribir…" style={fieldStyle} />
              <datalist id="lista-programas">
                {PROGRAMAS_EJEMPLO.map((p) => <option key={p} value={p} />)}
              </datalist>
              {catalogoEstado === "loading" && (
                <p className="mt-0.5 text-[10px]" style={{ color: "#3b82f6" }}>⏳ Consultando catálogo…</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="DG (Propietaria)" required>
                <select value={form.dg} onChange={(e) => set("dg", e.target.value)} style={fieldStyle}>
                  <option value="">Seleccionar…</option>
                  {DGS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Seguimiento" required>
                <select value={form.seguimiento} onChange={(e) => set("seguimiento", e.target.value)} style={fieldStyle}>
                  <option value="">Seleccionar…</option>
                  {DGS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Alcaldía" required>
                <select value={form.alcaldia} onChange={(e) => set("alcaldia", e.target.value)} style={fieldStyle}>
                  <option value="">Seleccionar…</option>
                  {ALCALDIAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Identificador"
                hint="CCT para escuelas (09DPR…), número de tramo/cancha para otros programas">
                <input type="text" value={form.identificador}
                  onChange={(e) => set("identificador", e.target.value)}
                  placeholder="Ej: 09DPR1580S ó 166"
                  style={fieldStyle} />
              </Field>
            </div>

            {/* ══ BLOQUE B — Catálogo del programa ══ */}
            <SectionTitle color={
              catalogoEstado === "found"     ? "#15803d" :
              catalogoEstado === "not_found" ? "#b91c1c" : T.accent
            }>
              {catalogoEstado === "not_found"
                ? "⛔ Programa sin catálogo registrado"
                : "Eje y Bloque (catálogo del programa)"}
            </SectionTitle>

            {catalogoEstado === "not_found" ? (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
                <p className="font-bold mb-1">Este programa no tiene CLAVE_EJE ni CLAVE_PROGRAMA configurados.</p>
                <p className="text-xs">Para crear obras de este programa, el responsable de Geoestadística
                  debe registrar al menos una obra de referencia con los datos del eje correctamente capturados.</p>
                <p className="text-xs font-bold mt-1">No es posible continuar con esta alta.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ReadonlyField label="Clave EJE" value={form.clave_eje}
                  hint={catalogoEstado !== "found" ? "Se rellena al seleccionar programa" : undefined} />
                <ReadonlyField label="Bloque Mundial" value={form.bloque_mundial} />
                <div style={{ gridColumn: "span 2" }}>
                  <ReadonlyField label="Nombre EJE" value={form.nombre_eje} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <ReadonlyField label="Clave Programa" value={form.clave_programa}
                    hint="Código abreviado usado en la clave única" />
                </div>
              </div>
            )}

            {/* ══ BLOQUE C — Ubicación ══ */}
            <SectionTitle>Ubicación</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colonia">
                <input type="text" value={form.colonia} onChange={(e) => set("colonia", e.target.value)} style={fieldStyle} />
              </Field>
              <Field label="Calle / Domicilio">
                <input type="text" value={form.calle_domicilio} onChange={(e) => set("calle_domicilio", e.target.value)} style={fieldStyle} />
              </Field>
            </div>
            <Field label="URL Google Maps">
              <input type="url" value={form.url_google_maps} onChange={(e) => set("url_google_maps", e.target.value)}
                placeholder="https://maps.google.com/…" style={fieldStyle} />
            </Field>

            {/* ══ BLOQUE D — Datos técnicos ══ */}
            <SectionTitle>Datos técnicos</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Estatus">
                <select value={form.estatus} onChange={(e) => set("estatus", e.target.value)} style={fieldStyle}>
                  {ESTATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Año">
                <input type="number" min="2000" max="2100" step="1"
                  value={form.anio} onChange={(e) => set("anio", e.target.value)} style={fieldStyle} />
              </Field>
              <Field label="Monto">
                <input type="number" min="0" step="0.01" value={form.monto}
                  onChange={(e) => set("monto", e.target.value)} placeholder="0.00" style={fieldStyle} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de obra">
                <input type="text" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}
                  placeholder="Ej: INFRAESTRUCTURA" style={fieldStyle} />
              </Field>
              <Field label="Modalidad">
                <input type="text" value={form.modalidad} onChange={(e) => set("modalidad", e.target.value)} style={fieldStyle} />
              </Field>
            </div>
            <Field label="Responsable DG">
              <input type="text" value={form.responsable_dg} onChange={(e) => set("responsable_dg", e.target.value)} style={fieldStyle} />
            </Field>
            <Field label="Observaciones">
              <textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)}
                rows={2} style={{ ...fieldStyle, height: "auto", paddingTop: "0.5rem", paddingBottom: "0.5rem", resize: "none" }} />
            </Field>

            {/* ══ BLOQUE E — Vista previa de clave (tiempo real) ══ */}
            <SectionTitle>Clave Única (generada automáticamente)</SectionTitle>
            <div className="rounded-xl p-3"
              style={{
                backgroundColor: claveEstado === "disponible" ? "#f0fdf4" :
                                  claveEstado === "ocupada"    ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${
                  claveEstado === "disponible" ? "#86efac" :
                  claveEstado === "ocupada"    ? "#fecaca" : "#e2e8f0"
                }`,
              }}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: T.textSoft }}>
                  Clave resultante
                </p>
                <ClaveStatus estado={claveEstado} />
              </div>
              <p className="font-mono text-sm font-semibold break-all"
                style={{ color: clavePrevia ? T.text : "#94a3b8" }}>
                {clavePrevia || "—  completa los campos para generar la clave"}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: "#94a3b8" }}>
                Fórmula: PLATSOBSE_{"{DG}"}_{"{CLAVE_PROGRAMA}"}_{"{NOMBRE_OBRA}"}_{"{IDENTIFICADOR}"}
              </p>
            </div>

            {/* ══ BLOQUE F — Geometría ══ */}
            <SectionTitle>Geometría</SectionTitle>
            <Field label="Geometría WKT o EWKB hex (QGIS)" required>
              <textarea value={form.geom_wkt}
                onChange={(e) => set("geom_wkt", e.target.value)}
                rows={3}
                placeholder={
                  form.tipo_geometria === "PUNTO"
                    ? "WKT:  POINT(-99.1332 19.4326)\nEWKB: 0101000020E6100000..."
                    : form.tipo_geometria === "LINEA"
                    ? "WKT:  LINESTRING(-99.13 19.43, -99.14 19.44)"
                    : "WKT:  POLYGON((-99.13 19.43,-99.14 19.43,...))"
                }
                style={{ ...fieldStyle, height: "auto", paddingTop: "0.5rem",
                  paddingBottom: "0.5rem", resize: "vertical", fontFamily: "monospace", fontSize: "0.78rem" }} />
              <p className="mt-1 text-[10px]" style={{ color: T.textSoft }}>
                Acepta WKT (<code>POINT(...)</code>) y EWKB hex de QGIS (<code>0101000020...</code>).
              </p>
            </Field>

            {/* Mensajes de error / éxito */}
            {error && (
              <div className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}` }}>
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>
                ✓ Obra creada exitosamente en producción.
              </div>
            )}

            {/* Ayuda sobre por qué está bloqueado */}
            {!puedeGuardar && !success && (form.nombre_obra || form.programa) && (
              <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                {catalogoEstado === "not_found" && "⛔ Programa sin catálogo — no es posible crear la obra."}
                {catalogoEstado === "loading"   && "⏳ Consultando catálogo del programa…"}
                {claveEstado === "ocupada"      && "❌ La clave ya existe — modifica el identificador o el nombre para generar una clave diferente."}
                {claveEstado === "loading"      && "⏳ Verificando disponibilidad de la clave…"}
                {(!form.dg || !form.seguimiento || !form.alcaldia || !form.geom_wkt) && catalogoEstado === "found" && claveEstado === "disponible"
                  && "Completa DG, Seguimiento, Alcaldía y Geometría para poder guardar."}
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
            <button type="button" onClick={handleSubmit} disabled={!puedeGuardar}
              className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ backgroundColor: !puedeGuardar ? "#93c5fd" : T.accent,
                color: "#ffffff", border: "none",
                cursor: !puedeGuardar ? "not-allowed" : "pointer",
                boxShadow: !puedeGuardar ? "none" : "0 6px 16px rgba(37,99,235,0.28)" }}>
              {saving ? "Creando…" : "Crear Obra"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
