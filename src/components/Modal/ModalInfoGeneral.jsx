/**
 * components/Modal/ModalInfoGeneral.jsx
 * Módulo: Información General de Obras
 *
 * UX: idéntico a ModalAlcances
 *  - Indicadores SIN valor  → input para nueva captura
 *  - Indicadores CON valor  → vista de solo lectura + botón "Editar"
 *  - Edición inline por indicador (igual que historial de Alcances)
 *  - NO hay eliminar ni limpiar
 *  - Registro de usuario_edicion + fecha_edicion en cada edición
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { infoGeneralAPI } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

/* ── Paleta verde — idéntica a Alcances ── */
const T = {
  headerBg:    "linear-gradient(135deg, #0f5132 0%, #166534 52%, #2f7d57 100%)",
  accent:      "#166534",
  accentDark:  "#0f5132",
  accentSoft:  "#dcefe3",
  accentPale:  "#edf7f0",
  text:        "#0f3d29",
  textMid:     "#4f6b5a",
  textSoft:    "#6b8c74",
  inputBg:     "#f4fbf6",
  inputBorder: "#bfd8c7",
  divider:     "#dceee3",
  cardBg:      "#ffffff",
  cardBorder:  "1px solid rgba(22,101,52,0.16)",
  cardShadow:  "0 2px 12px rgba(15,81,50,0.07)",
  rowHeader:   "rgba(22,101,52,0.06)",
  badgeBg:     "#dcefe3",
  badgeText:   "#0f3d29",
  danger:      "#b91c1c",
  dangerSoft:  "#fef2f2",
  dangerBorder:"#fecaca",
  warn:        "#92400e",
  warnBg:      "#fffbeb",
  warnBorder:  "#fde68a",
};

const ANIM = `
  @keyframes modal-in { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .modal-in  { animation: modal-in 0.18s ease-out both; }
  .ig-input:focus { outline:none; box-shadow:0 0 0 3px rgba(22,101,52,0.18); }
`;

const FIELD_H = "2.375rem";
const fieldBase = {
  height: FIELD_H, fontSize: "0.875rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.textSoft,
  paddingLeft: "0.625rem", paddingRight: "0.625rem",
  width: "100%", boxSizing: "border-box",
};

function Spin({ size = 14 }) {
  return (
    <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%",
      border: `2px solid ${T.accent}`, borderTopColor: "transparent",
      animation: "spin 0.7s linear infinite" }} />
  );
}

/* tipo_dato NULL o vacío → tratar como numérico */
function esNumerico(tipo) {
  if (tipo === null || tipo === undefined || tipo === "") return true;
  const t = String(tipo).toLowerCase().trim();
  return t !== "texto" && t !== "text";
}

function fmtValorGuardado(valor, valor_texto, tipo, unidad) {
  let base = "";
  if (esNumerico(tipo)) {
    if (valor === null || valor === undefined) return null;
    const n = Number(valor);
    if (isNaN(n)) return null;
    if (String(tipo).toLowerCase() === "moneda") {
      base = `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (String(tipo).toLowerCase() === "entero") {
      base = n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
    } else {
      base = n.toLocaleString("es-MX", { maximumFractionDigits: 4 });
    }
  } else {
    if (!valor_texto) return null;
    base = valor_texto;
  }
  return unidad ? `${base} ${unidad}` : base;
}

function fmtFecha(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function barColor(pct) {
  if (pct === 0)   return "#9ca3af";
  if (pct === 100) return "#15803d";
  return "#d97706";
}

/* ── Helpers de formato entero ── */
function soloDigitos(val) {
  return String(val || "").replace(/[^0-9]/g, "");
}
function formatearEntero(val) {
  const d = soloDigitos(val);
  if (!d) return "";
  return parseInt(d, 10).toLocaleString("en-US"); // "25,000,000"
}

/* Teclas permitidas en inputs enteros */
const KEYS_ENTERO_OK = new Set([
  "Backspace","Delete","ArrowLeft","ArrowRight",
  "ArrowUp","ArrowDown","Tab","Home","End",
]);
function onKeyDownEntero(e) {
  if (KEYS_ENTERO_OK.has(e.key)) return;
  if (/^[0-9]$/.test(e.key)) return;
  e.preventDefault(); // bloquea . , - * e E letras símbolos
}

/* ════════════════════════════════════════════════
   IndicadorRow
   - Sin valor guardado  → campo de nueva captura
   - Con valor guardado  → solo lectura + botón Editar (sin Eliminar/Limpiar)
   - Modo edición        → inline (igual que HistorialCard en Alcances)
   - Numéricos           → solo enteros, formato 1,000,000 visual
════════════════════════════════════════════════ */
function IndicadorRow({ ind, valor, onChange, datoGuardado, onSaveEdit, savingThisRow }) {
  const { indicador, unidad_medida, tipo_dato, obligatorio } = ind;
  const esNum = esNumerico(tipo_dato);

  const [editando,    setEditando]    = useState(false);
  const [editVal,     setEditVal]     = useState("");
  const [pasteError,  setPasteError]  = useState("");  /* mensaje de pegado inválido */
  const errorTimerRef = React.useRef(null);

  /* Muestra error temporal de pegado (2.5 s) */
  const showPasteError = () => {
    setPasteError("Solo se permiten números enteros.");
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setPasteError(""), 2500);
  };

  /* Manejador de pegado para campos numéricos:
     acepta SOLO cadenas de dígitos puros (sin . , - letras símbolos) */
  const handlePasteEntero = (e, currentVal, setter) => {
    e.preventDefault();
    const txt = e.clipboardData.getData("text").trim();
    if (!/^[0-9]+$/.test(txt)) { showPasteError(); return; }
    setter(txt);
  };

  const valorFormateado = datoGuardado
    ? fmtValorGuardado(datoGuardado.valor, datoGuardado.valor_texto, tipo_dato, unidad_medida)
    : null;
  const tieneValorGuardado = valorFormateado !== null && valorFormateado !== "";

  const iniciarEdicion = () => {
    const raw = esNum
      ? (datoGuardado.valor !== null && datoGuardado.valor !== undefined ? String(datoGuardado.valor) : "")
      : (datoGuardado.valor_texto ?? "");
    setEditVal(raw);
    setPasteError("");
    setEditando(true);
  };

  const confirmarEdicion = async () => {
    if (!editVal.toString().trim()) return;
    await onSaveEdit(ind, editVal);
    setEditando(false);
  };

  /* Cabecera común */
  const Header = (
    <div className="flex items-center justify-between px-3 py-1.5"
      style={{ backgroundColor: obligatorio && !tieneValorGuardado && !valor?.toString().trim()
        ? T.dangerSoft : T.rowHeader, borderBottom: `1px solid ${T.divider}` }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide"
          style={{ color: obligatorio && !tieneValorGuardado && !valor?.toString().trim()
            ? T.danger : T.textMid }}>
          {indicador}
          {obligatorio && <span style={{ color: T.danger, marginLeft: 4, fontSize: 13 }}>*</span>}
        </p>
        {unidad_medida && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase"
            style={{ backgroundColor: T.badgeBg, color: T.badgeText,
              border: "1px solid rgba(22,101,52,0.25)", letterSpacing: "0.05em" }}>
            {unidad_medida}
          </span>
        )}
      </div>
      {tieneValorGuardado && !editando && (
        <button type="button" onClick={iniciarEdicion}
          className="text-xs font-semibold px-2.5 py-0.5 rounded-lg ml-2 shrink-0"
          style={{ backgroundColor: T.accentSoft, color: T.accentDark,
            border: `1px solid rgba(22,101,52,0.30)`, cursor: "pointer", whiteSpace: "nowrap" }}>
          Editar
        </button>
      )}
    </div>
  );

  /* ── CON valor guardado: solo lectura o edición inline ── */
  if (tieneValorGuardado) {
    return (
      <div className="modal-in rounded-xl overflow-hidden" style={{ border: T.cardBorder, boxShadow: T.cardShadow }}>
        {Header}
        <div className="px-3 py-2.5" style={{ backgroundColor: T.cardBg }}>
          {!editando ? (
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: T.text }}>{valorFormateado}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  {datoGuardado.usuario_edicion ? (
                    <>
                      <span className="text-[10px] font-medium" style={{ color: T.textMid }}>{datoGuardado.usuario_edicion}</span>
                      <span className="text-[10px]" style={{ color: T.textSoft }}>Editado: {fmtFecha(datoGuardado.fecha_edicion)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-medium" style={{ color: T.textMid }}>{datoGuardado.usuario_actualizacion}</span>
                      <span className="text-[10px]" style={{ color: T.textSoft }}>Captura: {fmtFecha(datoGuardado.fecha_captura)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Edición inline */
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textMid }}>
                Editando: {indicador}
              </p>
              <input
                type="text"
                inputMode={esNum ? "numeric" : "text"}
                value={esNum ? formatearEntero(editVal) : editVal}
                onChange={(e) => {
                  if (esNum) setEditVal(soloDigitos(e.target.value));
                  else       setEditVal(e.target.value);
                }}
                onKeyDown={esNum ? onKeyDownEntero : undefined}
                onPaste={esNum ? (e) => handlePasteEntero(e, editVal, setEditVal) : undefined}
                autoFocus
                className="ig-input"
                style={{ ...fieldBase, border: `1px solid ${editVal ? "#86c49c" : T.inputBorder}`,
                  color: editVal ? T.text : T.textSoft, fontWeight: editVal ? 500 : 400 }}
              />
              {/* Error de pegado */}
              {pasteError && (
                <p className="text-[11px] font-semibold" style={{ color: T.danger }}>{pasteError}</p>
              )}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={confirmarEdicion}
                  disabled={savingThisRow || !editVal.toString().trim()}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ backgroundColor: savingThisRow || !editVal.toString().trim() ? T.textSoft : T.accent,
                    border: "1px solid transparent",
                    cursor: savingThisRow || !editVal.toString().trim() ? "not-allowed" : "pointer" }}>
                  {savingThisRow
                    ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Spin size={11} />Guardando…</span>
                    : "Guardar"}
                </button>
                <button type="button" onClick={() => { setEditando(false); setPasteError(""); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#f0faf3", color: T.textMid,
                    border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── SIN valor guardado: campo de nueva captura ── */
  const campoVacio = !valor?.toString().trim();
  return (
    <div className="modal-in rounded-xl overflow-hidden"
      style={{ border: obligatorio && campoVacio ? `1px solid ${T.dangerBorder}` : T.cardBorder,
               boxShadow: T.cardShadow }}>
      {Header}
      <div className="px-3 py-2.5" style={{ backgroundColor: T.cardBg }}>
        <input
          type="text"
          inputMode={esNum ? "numeric" : "text"}
          value={esNum ? formatearEntero(valor) : valor}
          onChange={(e) => {
            if (esNum) onChange(indicador, soloDigitos(e.target.value));
            else       onChange(indicador, e.target.value);
          }}
          onKeyDown={esNum ? onKeyDownEntero : undefined}
          onPaste={esNum ? (e) => handlePasteEntero(e, valor, (v) => onChange(indicador, v)) : undefined}
          placeholder={esNum ? "0" : "Ingresa el valor…"}
          className="ig-input"
          style={{ ...fieldBase,
            border: `1px solid ${valor ? "#86c49c" : obligatorio && campoVacio ? T.dangerBorder : T.inputBorder}`,
            color: valor ? T.text : T.textSoft, fontWeight: valor ? 500 : 400 }}
        />
        {/* Error de pegado */}
        {pasteError && (
          <p className="mt-1 text-[11px] font-semibold" style={{ color: T.danger }}>{pasteError}</p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MODAL PRINCIPAL
════════════════════════════════════════════════ */
export default function ModalInfoGeneral({ open, obra, onClose }) {
  const { user } = useAuth();

  const claveUnica = obra?.clave_unica || "";
  const nombreObra = obra?.nombre_obra  || obra?.nombre || "";
  const programa   = obra?.programa     || "";
  const dg         = obra?.dg           || obra?.direccion_general || "";
  const isObrasAdicionales = programa === "OBRAS ADICIONALES";
  const areaParam  = isObrasAdicionales ? nombreObra : undefined;

  const [catalogo,    setCatalogo]    = useState([]);
  const [valoresDB,   setValoresDB]   = useState([]);
  const [formValues,  setFormValues]  = useState({});   /* solo campos SIN valor guardado */
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [savingIndId, setSavingIndId] = useState(null); /* ID de indicador en edición individual */
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState(false);

  /* Mapa indicador → dato guardado */
  const datosPorIndicador = useMemo(() => {
    const m = {};
    for (const d of valoresDB) m[d.indicador] = d;
    return m;
  }, [valoresDB]);

  /* Indicadores que ya tienen un valor guardado no nulo */
  const tieneValor = useCallback((ind) => {
    const d = datosPorIndicador[ind.indicador];
    return !!d && (d.valor !== null || d.valor_texto !== null);
  }, [datosPorIndicador]);

  /* Progreso: guardados en BD + capturados en form (sin guardar aún) */
  const capturados = useMemo(() =>
    catalogo.filter((ind) =>
      tieneValor(ind) || formValues[ind.indicador]?.toString().trim() !== ""
    ).length,
    [catalogo, tieneValor, formValues]
  );
  const total = catalogo.length;
  const pct   = total > 0 ? Math.round((capturados / total) * 100) : 0;

  /* Pendientes = sin valor en BD NI en form */
  const pendientes = useMemo(() =>
    catalogo.filter((ind) =>
      !tieneValor(ind) && !formValues[ind.indicador]?.toString().trim()
    ),
    [catalogo, tieneValor, formValues]
  );

  /* Inicializa formValues solo para indicadores sin valor guardado */
  const buildFormValues = useCallback((cat, datos) => {
    const datoMap = {};
    for (const d of datos) datoMap[d.indicador] = d;
    const m = {};
    for (const ind of cat) {
      const d = datoMap[ind.indicador];
      const guardado = d && (d.valor !== null || d.valor_texto !== null);
      m[ind.indicador] = guardado ? "" : ""; /* siempre vacío — edición es interna al row */
    }
    return m;
  }, []);

  /* Carga al abrir */
  useEffect(() => {
    if (!open || !claveUnica || !programa) return;
    setLoading(true); setError(null); setSuccess(false);
    Promise.all([
      infoGeneralAPI.getCatalogo(programa, areaParam),
      infoGeneralAPI.getObra(claveUnica),
    ])
      .then(([catRes, obraRes]) => {
        const cat  = catRes.data  || [];
        const data = obraRes.data || [];
        setCatalogo(cat);
        setValoresDB(data);
        setFormValues(buildFormValues(cat, data));
      })
      .catch((e) => setError(e.message || "Error al cargar la información."))
      .finally(() => setLoading(false));
  }, [open, claveUnica, programa, areaParam, buildFormValues]);

  useEffect(() => {
    if (!open) {
      setCatalogo([]); setValoresDB([]); setFormValues({});
      setError(null); setSuccess(false); setSavingIndId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleChange = useCallback((indicador, val) => {
    setFormValues((prev) => ({ ...prev, [indicador]: val }));
    setError(null);
  }, []);

  /* Guardar una sola edición inline (indicadores con valor existente) */
  const handleSaveEdit = useCallback(async (ind, nuevoValor) => {
    const raw    = nuevoValor.toString().trim();
    if (!raw) return;
    const esNum  = esNumerico(ind.tipo_dato);
    const numVal = parseFloat(raw);
    setSavingIndId(ind.id);
    setError(null);
    try {
      const r = await infoGeneralAPI.guardarFicha({
        clave_unica: claveUnica, nombre_obra: nombreObra,
        programa, area: areaParam || null, dg,
        usuario_actualizacion: user?.email || user?.usuario || "sistema",
        indicadores: [{
          indicador:    ind.indicador,
          valor:        esNum && Number.isFinite(numVal) ? numVal : null,
          valor_texto:  !esNum ? (raw || null) : null,
          unidad_medida: ind.unidad_medida || null,
        }],
      });
      setValoresDB(r.data || []);
    } catch (e) {
      setError(e.message || "Error al guardar.");
    } finally {
      setSavingIndId(null);
    }
  }, [claveUnica, nombreObra, programa, areaParam, dg, user]);

  /* Guardar ficha completa (solo indicadores SIN valor guardado que el usuario llenó) */
  const handleGuardar = useCallback(async () => {
    const faltantes = catalogo.filter(
      (ind) => ind.obligatorio && !tieneValor(ind) && !formValues[ind.indicador]?.toString().trim()
    );
    if (faltantes.length) {
      setError(`Campos obligatorios sin valor: ${faltantes.map((f) => f.indicador).join(", ")}.`);
      return;
    }

    const nuevos = catalogo
      .filter((ind) => !tieneValor(ind) && formValues[ind.indicador]?.toString().trim() !== "")
      .map((ind) => {
        const raw    = formValues[ind.indicador]?.toString().trim() || "";
        const esNum  = esNumerico(ind.tipo_dato);
        const numVal = parseFloat(raw);
        return {
          indicador:    ind.indicador,
          valor:        esNum && Number.isFinite(numVal) ? numVal : null,
          valor_texto:  !esNum ? (raw || null) : null,
          unidad_medida: ind.unidad_medida || null,
        };
      });

    if (!nuevos.length) { setError("Ingresa al menos un valor antes de guardar."); return; }

    setSaving(true); setError(null);
    try {
      const r = await infoGeneralAPI.guardarFicha({
        clave_unica: claveUnica, nombre_obra: nombreObra,
        programa, area: areaParam || null, dg,
        usuario_actualizacion: user?.email || user?.usuario || "sistema",
        indicadores: nuevos,
      });
      setValoresDB(r.data || []);
      setFormValues(buildFormValues(catalogo, r.data || []));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (e) {
      setError(e.message || "Error al guardar la información.");
    } finally { setSaving(false); }
  }, [catalogo, formValues, tieneValor, claveUnica, nombreObra, programa, areaParam, dg, user, buildFormValues]);

  if (!open) return null;

  /* ¿Hay indicadores sin valor pendientes de capturar? */
  const hayNuevosParaGuardar = catalogo.some(
    (ind) => !tieneValor(ind) && formValues[ind.indicador]?.toString().trim() !== ""
  );

  const obraMeta = [programa, dg].filter(Boolean).join(" · ");

  return (
    <>
      <style>{ANIM}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(5,20,10,0.52)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>

        <div className="w-full flex flex-col rounded-2xl relative modal-in"
          style={{ maxWidth: "720px", maxHeight: "92vh", background: T.cardBg,
            border: T.cardBorder, boxShadow: "0 24px 64px rgba(5,25,12,0.26), 0 4px 16px rgba(5,25,12,0.12)" }}>

          {/* HEADER */}
          <div className="shrink-0 px-6 pt-5 pb-4 rounded-t-2xl" style={{ background: T.headerBg }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.22em]"
                  style={{ color: "rgba(255,255,255,0.58)" }}>
                  Información General de la Obra
                </p>
                <h2 className="mt-1 text-lg font-bold leading-snug text-white truncate">
                  {nombreObra || "Obra"}
                </h2>
                {obraMeta && (
                  <p className="mt-0.5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>
                    {obraMeta}
                  </p>
                )}
                {claveUnica && (
                  <p className="mt-0.5 text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {claveUnica}
                  </p>
                )}

                {/* Barra de progreso */}
                {!loading && total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.80)" }}>
                        Progreso: {capturados} / {total}
                      </span>
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.90)" }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 7, backgroundColor: "rgba(255,255,255,0.20)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`,
                        backgroundColor: barColor(pct), transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={onClose} aria-label="Cerrar"
                className="shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}>
                ✕
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ backgroundColor: "#f8fcf9" }}>

            {loading && (
              <div className="flex items-center justify-center gap-3 py-16">
                <Spin size={20} />
                <span className="text-sm" style={{ color: T.textSoft }}>Cargando información de la obra…</span>
              </div>
            )}

            {!loading && (!programa || programa === "SIN PROGRAMA") && (
              <div className="rounded-2xl px-5 py-6 text-sm text-center"
                style={{ backgroundColor: T.cardBg, border: T.cardBorder, color: T.textSoft }}>
                Esta obra no tiene programa asignado.
              </div>
            )}

            {!loading && programa && programa !== "SIN PROGRAMA" && catalogo.length === 0 && !error && (
              <div className="rounded-2xl px-5 py-6 text-sm text-center"
                style={{ backgroundColor: T.accentPale, border: `1px dashed ${T.inputBorder}`, color: T.textSoft }}>
                <p className="font-semibold mb-1" style={{ color: T.textMid }}>Sin indicadores configurados</p>
                <p>El programa <strong>{programa}</strong> no tiene indicadores en el catálogo.</p>
              </div>
            )}

            {!loading && catalogo.length > 0 && (
              <>
                {/* Resumen Completados / Pendientes */}
                <div className="rounded-xl overflow-hidden mb-4"
                  style={{ border: T.cardBorder, boxShadow: T.cardShadow }}>
                  <div className="flex items-stretch" style={{ borderBottom: "none" }}>

                    {/* Completados */}
                    <div className="flex-1 px-4 py-3" style={{ backgroundColor: capturados > 0 ? "#f0fdf4" : T.cardBg,
                      borderRight: `1px solid ${T.divider}` }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 18 }}>✅</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                            Completados
                          </p>
                          <p className="text-2xl font-black" style={{ color: capturados > 0 ? "#15803d" : "#9ca3af" }}>
                            {capturados}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pendientes */}
                    <div className="flex-1 px-4 py-3" style={{ backgroundColor: pendientes.length > 0 ? T.warnBg : T.cardBg }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 18 }}>⏳</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                            Pendientes
                          </p>
                          <p className="text-2xl font-black" style={{ color: pendientes.length > 0 ? T.warn : "#9ca3af" }}>
                            {pendientes.length}
                          </p>
                        </div>
                      </div>
                      {pendientes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pendientes.map((ind) => (
                            <span key={ind.indicador}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: T.warnBorder, color: T.warn }}>
                              {ind.indicador}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Leyenda */}
                {catalogo.some((i) => i.obligatorio) && (
                  <p className="text-xs mb-3" style={{ color: T.textSoft }}>
                    <span style={{ color: T.danger }}>* campo obligatorio</span>
                    {" · "}{total} indicador{total !== 1 ? "es" : ""} configurado{total !== 1 ? "s" : ""}
                  </p>
                )}

                {/* Indicadores */}
                <div className="space-y-2.5">
                  {catalogo.map((ind) => (
                    <IndicadorRow
                      key={ind.id}
                      ind={ind}
                      valor={formValues[ind.indicador] ?? ""}
                      onChange={handleChange}
                      datoGuardado={datosPorIndicador[ind.indicador] || null}
                      onSaveEdit={handleSaveEdit}
                      savingThisRow={savingIndId === ind.id}
                    />
                  ))}
                </div>

                {/* Mensajes de estado */}
                {(error || success) && (
                  <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                      backgroundColor: error ? T.dangerSoft : "#f0fdf4",
                      color:           error ? T.danger : "#15803d",
                      border: `1px solid ${error ? T.dangerBorder : "#86efac"}`,
                    }}>
                    {error || "✓ Información guardada correctamente"}
                  </div>
                )}
              </>
            )}

            {!loading && error && catalogo.length === 0 && (
              <div className="rounded-2xl px-5 py-4 text-sm text-center"
                style={{ backgroundColor: T.dangerSoft, border: `1px solid ${T.dangerBorder}`, color: T.danger }}>
                {error}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="shrink-0 px-5 py-3.5 flex items-center justify-between gap-3 rounded-b-2xl"
            style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
            <button type="button" onClick={onClose}
              className="text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: "#f0faf3", color: T.textMid,
                border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
              Cerrar
            </button>
            {/* Guardar solo aparece cuando hay nuevos campos por guardar */}
            {hayNuevosParaGuardar && (
              <button type="button" onClick={handleGuardar} disabled={saving || loading}
                className="text-sm font-bold px-6 py-2.5 rounded-xl transition-all"
                style={{
                  backgroundColor: saving ? "#86b896" : T.accent,
                  color: "#ffffff", border: "1px solid transparent",
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 6px 16px rgba(14,75,42,0.26)",
                }}>
                {saving
                  ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spin size={13} />Guardando…</span>
                  : "Guardar información"}
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
