import React, { useState, useEffect, useCallback } from "react";
import { alcancesAPI } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import AutocompleteInput from "../ui/AutocompleteInput";

const T = {
  headerBg:    "linear-gradient(135deg, #0c4a2a 0%, #166534 55%, #1e8449 100%)",
  shellBg:     "#ffffff",
  shellBorder: "1px solid rgba(22,101,52,0.14)",
  divider:     "#e2ede7",
  pageBg:      "#f4f9f6",
  cardBg:      "#ffffff",
  cardBorder:  "1px solid rgba(22,101,52,0.16)",
  cardShadow:  "0 2px 12px rgba(15,81,50,0.07), 0 1px 3px rgba(15,81,50,0.05)",
  accent:      "#166534",
  accentDark:  "#0c4a2a",
  accentSoft:  "#d6eedd",
  accentPale:  "#eef7f1",
  text:        "#14351f",
  textMid:     "#3d6050",
  textSoft:    "#658274",
  inputBg:     "#f8fcf9",
  inputBorder: "#c4d9cc",
  rowHeader:   "rgba(22,101,52,0.06)",
  badgeBg:     "#d6eedd",
  badgeText:   "#0c4a2a",
  danger:      "#b91c1c",
  dangerSoft:  "#fef2f2",
  dangerBorder:"#fecaca",
  warn:        "#92400e",
};

const ANIM_STYLE = `
  @keyframes row-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes overlay-in { from{opacity:0} to{opacity:1} }
  .row-in { animation: row-in 0.18s ease-out both; }
  .overlay-in { animation: overlay-in 0.15s ease-out both; }
  .alcance-select:focus { outline:none; box-shadow:0 0 0 3px rgba(22,101,52,0.18); }
  .alcance-input:focus  { outline:none; box-shadow:0 0 0 3px rgba(22,101,52,0.18); }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { opacity:0.4; }
`;

/* ── Excepción controlada: ILIFE + 1,2,3 POR MI ESCUELA + NUCLEOS SANITARIOS + REHABILITACIÓN
   Para esta combinación, la variante vinculada de m² no aplica operativamente. ── */
const EXCEPCION_VARIANTE_ILIFE = {
  programa:    "1,2,3 POR MI ESCUELA RENOVAR PARA TRANSFORMAR",
  seguimiento: "ILIFE",
  concepto:    "NUCLEOS SANITARIOS",
  accion:      "REHABILITACIÓN",
};
function esExcepcionSinVariante(prog, seg, concepto, accion) {
  const e = EXCEPCION_VARIANTE_ILIFE;
  return (
    prog?.trim().toUpperCase()     === e.programa &&
    seg?.trim().toUpperCase().includes(e.seguimiento) &&
    concepto?.trim().toUpperCase() === e.concepto &&
    accion?.trim().toUpperCase()   === e.accion
  );
}

/* Actividades disponibles cuando el concepto no está en catálogo */
const ACTIVIDADES_LIBRE = [
  "INSTALACIÓN","CONSTRUCCIÓN","REHABILITACIÓN","APLICACIÓN",
  "REUBICACIÓN","DIAGNÓSTICO","MANTENIMIENTO","REFUERZO","COLOCACIÓN",
  "ENCAMISADO","PINTURA","DEMOLICIÓN","MONTAJE","APLANADO","RELLENO",
  "REPAVIMENTACIÓN","MEJORAMIENTO","HABILITADO","SUSTITUCIÓN","HABILITACIÓN","RENOVACIÓN",
];

function sanitizarConcepto(raw) {
  return String(raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/"/g, " PULGADAS")
    .replace(/[^A-Za-z0-9 \-()\s]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

/* ── Una sola fila — fromCatalog se determina tras confirmar el concepto ── */
function createRow() {
  return {
    id:           `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    concepto:     "",
    accion:       "",
    cantidad:     "",
    unidad:       "",
    unidades:     [],
    actividades:  [],
    loadingActs:  false,
    fromCatalog:  null,   /* null = aún sin confirmar, true = catálogo, false = libre */
    groupId:      null,
    isGroupChild: false,
    modoLibre:    false,  /* true = usuario activó captura fuera de catálogo */
  };
}

function isRowEmpty(r) { return !r.concepto && !r.accion && !r.cantidad; }

function isRowComplete(r) {
  if (!r.concepto || r.concepto.trim().length < 2) return false;
  if (!r.accion) return false;
  const qty = Number(r.cantidad);
  if (!r.cantidad || qty <= 0 || !Number.isInteger(qty)) return false;
  /* Unidad: si el catálogo asignó una sola auto → ok; si libre o multi-unidad → debe estar elegida */
  if (r.fromCatalog === true) return r.unidades.length <= 1 || !!r.unidad;
  return !!r.unidad;
}

function isGroupComplete(rows, groupId) {
  return rows.filter((r) => r.groupId === groupId).every(isRowComplete);
}

/* ════════ VISUALES ════════ */

function Spin({ size = 14 }) {
  return (
    <span className="inline-block border-2 border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size, borderColor: T.accent, borderTopColor: "transparent" }} />
  );
}

const FIELD_H = "2.375rem";
const fieldBase = {
  height: FIELD_H, fontSize: "0.875rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.textSoft,
  paddingLeft: "0.625rem", paddingRight: "0.625rem",
};

/* ── Selector de tipo a nivel de OBRA ── */
function TipoObraSelector({ claveUnica, programa, tipoObra, onSelect, saving }) {
  if (!programa || programa === "SIN PROGRAMA") return null;
  const TIPOS = [
    { key: "PROYECTADO", label: "⟳ Proyectado", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    { key: "EJECUTADO",  label: "✓ Ejecutado",  bg: "#f0fdf4", color: "#166534", border: "#86efac" },
  ];
  const sinClasificar = !tipoObra;
  return (
    <div className="mx-5 mb-4 rounded-2xl overflow-hidden"
      style={{ border: sinClasificar ? "1.5px solid #f59e0b" : T.cardBorder, boxShadow: sinClasificar ? "0 0 0 3px rgba(245,158,11,0.12)" : T.cardShadow }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: sinClasificar ? "#fffbeb" : T.rowHeader, borderBottom: `1px solid ${sinClasificar ? "#fde68a" : T.divider}` }}>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: sinClasificar ? "#92400e" : T.textMid }}>
            Clasificación de la obra
          </p>
          {sinClasificar && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
              REQUERIDA
            </span>
          )}
        </div>
        {saving && <Spin size={12} />}
      </div>
      <div className="px-4 py-3" style={{ backgroundColor: sinClasificar ? "#fffdf7" : T.cardBg }}>
        <p className="text-xs mb-3" style={{ color: sinClasificar ? "#92400e" : T.textSoft }}>
          {sinClasificar
            ? "⚠ Debes clasificar la obra antes de poder guardar alcances."
            : "Clasificación general — aplica a todos los registros sin asignación individual."}
        </p>
        <div className="flex gap-2 flex-wrap">
          {TIPOS.map(({ key, label, bg, color, border }) => {
            const sel = tipoObra === key;
            return (
              <button key={key} type="button" onClick={() => !saving && onSelect(key)} disabled={saving}
                className="text-sm font-bold px-5 py-2 rounded-xl transition-all"
                style={{
                  backgroundColor: sel ? bg : "#f9fafb", color: sel ? color : "#9ca3af",
                  border: `2px solid ${sel ? border : sinClasificar ? "#fde68a" : "#e5e7eb"}`,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: sel ? `0 2px 8px ${border}` : "none", transform: sel ? "scale(1.03)" : "scale(1)",
                }}>
                {label}
              </button>
            );
          })}
        </div>
        {sinClasificar && (
          <p className="text-xs mt-2.5 font-semibold" style={{ color: "#f59e0b" }}>
            Sin clasificar — selecciona el tipo para poder guardar
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Fila de captura UNIFICADA ── */
function AlcanceRow({
  row, index,
  onConceptoInput, onConceptoConfirm,
  onFieldChange, onRemove, canRemove,
  unidadesGlobales, onGetSugerencias,
  tieneCatalogo, catalogoConceptos, onSetModoLibre,
}) {
  const isGroupParent = !!row.groupId && !row.isGroupChild;
  const isChild       = !!row.isGroupChild;
  const isLibre       = row.fromCatalog === false;
  const isCatalog     = row.fromCatalog === true;

  return (
    <div className="row-in rounded-xl overflow-hidden"
      style={{ border: isChild ? "1px solid rgba(22,101,52,0.28)" : T.cardBorder, boxShadow: T.cardShadow, marginLeft: isChild ? "1.25rem" : 0 }}>

      {/* Cabecera */}
      <div className="flex items-center justify-between px-3 py-1.5"
        style={{ backgroundColor: isChild ? "rgba(22,101,52,0.07)" : T.rowHeader, borderBottom: `1px solid ${T.divider}` }}>
        <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: T.textMid }}>
          {isChild ? (
            <><span style={{ color: T.accent, fontSize: 13 }}>↳</span>Variante vinculada</>
          ) : (
            <>
              {`Alcance ${index + 1}`}
              {tieneCatalogo && row.modoLibre && (
                <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                  ⚠ NO CATALOGADO
                </span>
              )}
              {!tieneCatalogo && row.fromCatalog === false && (
                <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                  CAPTURA MANUAL
                </span>
              )}
            </>
          )}
        </span>
        {!isChild && (
          <button type="button" onClick={onRemove} disabled={!canRemove}
            className="text-xs font-semibold px-2 py-0.5 rounded-lg"
            style={{ backgroundColor: canRemove ? "#fff" : "transparent", color: canRemove ? T.danger : T.textSoft,
              border: `1px solid ${canRemove ? "#fecaca" : "transparent"}`, cursor: canRemove ? "pointer" : "not-allowed" }}>
            {isGroupParent ? "Eliminar grupo" : "Eliminar"}
          </button>
        )}
      </div>

      {/* Campos */}
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap sm:flex-nowrap" style={{ backgroundColor: T.cardBg }}>

        {/* ── Concepto: modo catálogo (select) / modo libre (autocomplete) ── */}
        {isChild ? (
          <div className="flex items-center flex-1 min-w-[8rem] rounded-lg border text-xs font-semibold truncate"
            style={{ height: FIELD_H, paddingInline: "0.625rem", backgroundColor: T.accentPale, borderColor: "#86c49c", color: T.accentDark }}>
            {row.concepto}
          </div>
        ) : tieneCatalogo && !row.modoLibre ? (
          /* ── MODO CATÁLOGO: selector desplegable ── */
          <div style={{ flex: 1, minWidth: "8rem" }}>
            <div className="relative">
              <select
                value={row.concepto}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) { onConceptoInput(row.id, val); onConceptoConfirm(row.id, val); }
                  else     { onConceptoInput(row.id, ""); }
                }}
                disabled={row.loadingActs}
                className="alcance-select w-full appearance-none"
                style={{
                  ...fieldBase, width: "100%", paddingRight: "1.5rem",
                  cursor: row.loadingActs ? "wait" : "pointer",
                  border: `1px solid ${row.concepto ? "#86c49c" : T.inputBorder}`,
                  color: row.concepto ? T.text : T.textSoft,
                  fontWeight: row.concepto ? 500 : 400,
                }}>
                <option value="">{row.loadingActs ? "Cargando…" : "Seleccionar concepto…"}</option>
                {catalogoConceptos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: T.textSoft, fontSize: 10 }}>
                {row.loadingActs ? <Spin size={10} /> : "▾"}
              </span>
            </div>
            <button type="button" onClick={() => onSetModoLibre(row.id, true)}
              style={{ backgroundColor: "transparent", color: T.textSoft, border: "none",
                cursor: "pointer", padding: 0, fontSize: "10px", fontWeight: 600,
                letterSpacing: "0.04em", display: "block", marginTop: 3 }}>
              + Concepto libre
            </button>
          </div>
        ) : (
          /* ── MODO LIBRE: input con autocompletado ── */
          <div style={{ flex: 1, minWidth: "8rem" }}>
            {tieneCatalogo && row.modoLibre && (
              <div style={{ marginBottom: 4, padding: "4px 8px", borderRadius: 6, display: "flex",
                alignItems: "center", gap: 5, backgroundColor: "#fffbeb",
                color: "#92400e", border: "1px solid #fde68a", fontSize: "10px", fontWeight: 600 }}>
                ⚠ Estás registrando un concepto fuera del catálogo oficial.
              </div>
            )}
            <AutocompleteInput
              value={row.concepto}
              onChange={(val) => onConceptoInput(row.id, val)}
              onConfirm={(val) => onConceptoConfirm(row.id, val)}
              onBlur={() => row.fromCatalog === null && row.concepto.trim().length >= 2 && onConceptoConfirm(row.id, row.concepto)}
              getSuggestions={onGetSugerencias}
              allowFreeText={true}
              placeholder={tieneCatalogo && row.modoLibre ? "Concepto fuera de catálogo…" : "Escribir o buscar concepto…"}
              maxLength={120}
              debounceMs={280}
              className="alcance-input"
              style={{
                ...fieldBase, width: "100%",
                border: `1px solid ${row.concepto ? (isCatalog ? "#86c49c" : isLibre ? "#d97706" : T.inputBorder) : T.inputBorder}`,
                color: row.concepto ? T.text : T.textSoft,
                fontWeight: row.concepto ? 500 : 400,
              }}
            />
            {tieneCatalogo && row.modoLibre && (
              <button type="button" onClick={() => onSetModoLibre(row.id, false)}
                style={{ backgroundColor: "transparent", color: T.textSoft, border: "none",
                  cursor: "pointer", padding: 0, fontSize: "10px", fontWeight: 600,
                  display: "block", marginTop: 3 }}>
                ← Volver al catálogo
              </button>
            )}
          </div>
        )}

        {/* ── Acción: select del catálogo (fromCatalog=true) o AutocompleteInput (fromCatalog=false) ── */}
        {isChild ? (
          <div className="flex items-center flex-1 min-w-[7rem] rounded-lg border text-xs font-semibold"
            style={{ height: FIELD_H, paddingInline: "0.625rem", backgroundColor: T.accentPale, borderColor: "#86c49c", color: T.accentDark }}>
            {row.accion || "—"}
          </div>
        ) : isLibre ? (
          <AutocompleteInput
            value={row.accion}
            onChange={(val) => onFieldChange(row.id, "accion", val)}
            staticList={ACTIVIDADES_LIBRE}
            allowFreeText={false}
            placeholder="Acción…"
            debounceMs={0}
            className="alcance-input"
            style={{
              ...fieldBase, flex: "1 1 7rem", minWidth: "7rem",
              border: `1px solid ${row.accion ? "#86c49c" : T.inputBorder}`,
              color: row.accion ? T.text : T.textSoft, fontWeight: row.accion ? 500 : 400,
            }}
          />
        ) : (
          <div className="relative flex-1 min-w-[7rem]">
            <select value={row.accion} onChange={(e) => onFieldChange(row.id, "accion", e.target.value)}
              disabled={!row.actividades.length || row.loadingActs}
              className="alcance-select w-full appearance-none"
              style={{
                ...fieldBase, paddingRight: "1.5rem",
                border: `1px solid ${row.accion ? "#86c49c" : T.inputBorder}`,
                backgroundColor: (!row.actividades.length && !row.loadingActs) ? "#f4f8f5" : T.inputBg,
                color: row.accion ? T.text : T.textSoft,
                cursor: (!row.actividades.length && !row.loadingActs) ? "not-allowed" : "pointer",
                fontWeight: row.accion ? 500 : 400,
              }}>
              <option value="">{row.loadingActs ? "Cargando…" : !row.concepto ? "Concepto primero" : "Acción"}</option>
              {row.actividades.map((act) => <option key={act} value={act}>{act}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: T.textSoft, fontSize: 10 }}>
              {row.loadingActs ? <Spin size={10} /> : "▾"}
            </span>
          </div>
        )}

        {/* ── Cantidad ── */}
        <input type="number" inputMode="numeric" value={row.cantidad}
          onChange={(e) => onFieldChange(row.id, "cantidad", e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => { if (["-",".",",","e","E"].includes(e.key)) e.preventDefault(); }}
          placeholder="0" min="1" step="1" autoComplete="off" className="alcance-input"
          style={{ ...fieldBase, width: "5.5rem", border: `1px solid ${row.cantidad ? "#86c49c" : T.inputBorder}`,
            color: row.cantidad ? T.text : T.textSoft, fontWeight: row.cantidad ? 500 : 400 }} />

        {/* ── Unidad: catálogo o libre ── */}
        {isLibre ? (
          <AutocompleteInput
            value={row.unidad}
            onChange={(val) => onFieldChange(row.id, "unidad", val)}
            staticList={unidadesGlobales}
            allowFreeText={true}
            placeholder="Unidad…"
            debounceMs={0}
            className="alcance-input"
            style={{ ...fieldBase, width: "5.5rem", border: `1px solid ${row.unidad ? "#86c49c" : T.inputBorder}`,
              color: row.unidad ? T.text : T.textSoft, fontWeight: row.unidad ? 500 : 400 }}
          />
        ) : row.unidades.length > 1 ? (
          <div className="relative shrink-0">
            <select value={row.unidad} onChange={(e) => onFieldChange(row.id, "unidad", e.target.value)}
              className="alcance-select appearance-none"
              style={{ ...fieldBase, minWidth: "5.5rem", paddingRight: "1.5rem", cursor: "pointer",
                border: `1px solid ${row.unidad ? "#86c49c" : T.inputBorder}`,
                color: row.unidad ? T.text : T.textSoft, fontWeight: row.unidad ? 500 : 400 }}>
              <option value="">Unidad</option>
              {row.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: T.textSoft, fontSize: 10 }}>▾</span>
          </div>
        ) : (
          <div className="flex items-center justify-center shrink-0 whitespace-nowrap border rounded-lg text-xs font-bold"
            style={{ height: FIELD_H, minWidth: "3.75rem", paddingInline: "0.5rem",
              backgroundColor: row.unidad ? T.accentSoft : "#f0f4f2",
              borderColor: row.unidad ? "#86c49c" : T.inputBorder,
              color: row.unidad ? T.accentDark : T.textSoft, letterSpacing: "0.04em" }}>
            {row.unidad || "—"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Confirmación de guardado ── */
function ConfirmacionGuardado({ rows, onConfirmar, onCancelar, saving }) {
  return (
    <div className="overlay-in absolute inset-0 z-10 flex flex-col rounded-2xl overflow-hidden"
      style={{ backgroundColor: "rgba(244,249,246,0.97)", backdropFilter: "blur(2px)" }}>
      <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${T.divider}`, backgroundColor: "#fff" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: T.text }}>Confirmar guardado</p>
            <p className="text-xs" style={{ color: T.textSoft }}>Revisa los alcances antes de confirmar. Esta acción no se puede deshacer.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl overflow-hidden" style={{ border: T.cardBorder, boxShadow: T.cardShadow }}>
            <div className="flex">
              <div className="w-1 shrink-0" style={{ backgroundColor: row.fromCatalog === false ? "#d97706" : T.accent }} />
              <div className="flex-1 px-4 py-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase"
                        style={{ backgroundColor: T.badgeBg, color: T.badgeText, border: "1px solid #86c49c" }}>{row.accion}</span>
                      {(row.modoLibre || row.fromCatalog === false) && (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ backgroundColor: "#fffbeb", color: T.warn, border: "1px solid #fcd34d" }}>
                          {row.modoLibre ? "NO CATALOGADO" : "CAPTURA MANUAL"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold" style={{ color: T.text }}>{row.concepto}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold tabular-nums" style={{ color: T.accentDark }}>
                      {Number(row.cantidad).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {row.unidad && <p className="text-xs font-semibold uppercase" style={{ color: T.textSoft }}>{row.unidad}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 px-5 py-4 flex gap-3" style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
        <button type="button" onClick={onCancelar} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "#f2f7f4", color: T.textMid, border: `1px solid ${T.inputBorder}`, cursor: saving ? "not-allowed" : "pointer" }}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirmar} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: saving ? "#b8cfc0" : T.accent, border: "1px solid transparent",
            cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 16px rgba(14,75,42,0.26)" }}>
          {saving ? <span className="flex items-center justify-center gap-2"><Spin size={13}/>Guardando…</span> : `Confirmar (${rows.length})`}
        </button>
      </div>
    </div>
  );
}

/* ── Historial ── */
function HistorialCard({
  item, tipoObra, permitirEdicion,
  onEdit, onDelete, onUpdateTipo,
  editandoId, editValues, onEditChange, onSaveEdit, onCancelEdit,
  savingEdit, deletingId, savingTipoId,
}) {
  const isEditing   = editandoId === item.id;
  const isDeleting  = deletingId === item.id;
  const isSavingTip = savingTipoId === item.id;
  const fmtFecha    = (ts) => ts ? new Date(ts).toLocaleString("es-MX", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : null;

  /* Tipo efectivo: individual > obra-nivel */
  const tipoEfectivo = item.tipo_alcance || tipoObra || null;
  const esIndividual = !!item.tipo_alcance;
  const tipoCfg = {
    PROYECTADO: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "⟳ Proyectado" },
    EJECUTADO:  { bg: "#f0fdf4", color: "#166534", border: "#86efac", label: "✓ Ejecutado"  },
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: T.cardBorder, boxShadow: "0 1px 6px rgba(15,81,50,0.06)" }}>
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: esIndividual
          ? (item.tipo_alcance === "EJECUTADO" ? "#166534" : "#1d4ed8")
          : T.accent }} />
        <div className="flex-1 px-4 py-3">
          {isEditing ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMid }}>Editando: {item.concepto}</p>
              <div className="flex gap-2 flex-wrap">
                <input type="number" inputMode="numeric" value={editValues.cantidad}
                  onChange={(e) => onEditChange("cantidad", e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => { if(["-",".",",","e","E"].includes(e.key)) e.preventDefault(); }}
                  placeholder="Cantidad" min="1" step="1" className="alcance-input"
                  style={{ ...fieldBase, width: "7rem" }} />
                <input type="text" value={editValues.unidad} onChange={(e) => onEditChange("unidad", e.target.value)}
                  placeholder="Unidad" className="alcance-input" style={{ ...fieldBase, width: "5rem" }} />
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => onSaveEdit(item.id)} disabled={savingEdit}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ backgroundColor: savingEdit ? T.textSoft : T.accent, border: "1px solid transparent", cursor: savingEdit ? "not-allowed" : "pointer" }}>
                  {savingEdit ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={onCancelEdit} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#f2f7f4", color: T.textMid, border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {/* Acción + tipo badge */}
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wide"
                    style={{ backgroundColor: T.badgeBg, color: T.badgeText, border: "1px solid #86c49c" }}>{item.accion}</span>
                  {tipoEfectivo && tipoCfg[tipoEfectivo] && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: tipoCfg[tipoEfectivo].bg, color: tipoCfg[tipoEfectivo].color, border: `1px solid ${tipoCfg[tipoEfectivo].border}` }}>
                      {tipoCfg[tipoEfectivo].label}
                      {esIndividual && (
                        <span style={{ opacity: 0.65, fontSize: "8px", fontWeight: 700 }}>IND.</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-tight" style={{ color: T.text }}>{item.concepto}</p>
                <p className="mt-1 text-sm" style={{ color: T.textMid }}>
                  <span className="font-bold tabular-nums">{Number(item.cantidad).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  {item.unidad && <span className="ml-1.5 text-xs font-semibold uppercase" style={{ color: T.textSoft }}>{item.unidad}</span>}
                </p>
                {/* Toggle individual — visible sólo cuando edición habilitada */}
                {permitirEdicion && (
                  <div className="flex items-center gap-1 mt-2">
                    {["PROYECTADO", "EJECUTADO"].map((tipo) => {
                      const sel = item.tipo_alcance === tipo;
                      const cfg = tipoCfg[tipo];
                      return (
                        <button key={tipo} type="button" disabled={isSavingTip}
                          onClick={() => onUpdateTipo(item.id, sel ? null : tipo)}
                          className="text-[9px] font-bold px-2 py-0.5 rounded-md transition-all"
                          style={{
                            backgroundColor: sel ? cfg.bg : "#f9fafb",
                            color:           sel ? cfg.color : "#9ca3af",
                            border:          `1px solid ${sel ? cfg.border : "#e5e7eb"}`,
                            cursor:          isSavingTip ? "not-allowed" : "pointer",
                            opacity:         isSavingTip ? 0.6 : 1,
                          }}>
                          {tipo === "PROYECTADO" ? "⟳ Proy." : "✓ Ejec."}{sel ? " ✓" : ""}
                        </button>
                      );
                    })}
                    {isSavingTip && <Spin size={10} />}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                {item.usuario_actualizacion && <p className="text-xs font-medium" style={{ color: T.textMid }}>{item.usuario_actualizacion}</p>}
                {fmtFecha(item.fecha_captura) && <p className="text-xs mt-0.5" style={{ color: T.textSoft }}><span className="font-semibold" style={{ color: T.textMid }}>Captura: </span>{fmtFecha(item.fecha_captura)}</p>}
                {fmtFecha(item.fecha_edicion) && (
                  <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px dashed ${T.divider}` }}>
                    {item.usuario_edicion && <p className="text-xs font-medium" style={{ color: "#b45309" }}>{item.usuario_edicion}</p>}
                    <p className="text-xs mt-0.5" style={{ color: "#b45309" }}><span className="font-semibold">Editado: </span>{fmtFecha(item.fecha_edicion)}</p>
                  </div>
                )}
                {permitirEdicion && (
                  <div className="flex gap-1.5 mt-2 justify-end">
                    <button type="button" onClick={() => onEdit(item)} className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: T.accentSoft, color: T.accentDark, border: "1px solid #86c49c", cursor: "pointer" }}>Editar</button>
                    <button type="button" onClick={() => onDelete(item.id)} disabled={isDeleting} className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: isDeleting ? "#f0f0f0" : T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}`, cursor: isDeleting ? "not-allowed" : "pointer" }}>
                      {isDeleting ? "…" : "Eliminar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistorialVacio() {
  return (
    <div className="flex flex-col items-center justify-center py-10 rounded-2xl"
      style={{ backgroundColor: T.accentPale, border: `1px dashed ${T.inputBorder}` }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.inputBorder} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      <p className="mt-3 text-sm font-semibold" style={{ color: T.textMid }}>Sin alcances registrados</p>
      <p className="mt-1 text-xs" style={{ color: T.textSoft }}>Los alcances guardados aparecerán aquí</p>
    </div>
  );
}

/* ════════════════════════════════
   MODAL PRINCIPAL
════════════════════════════════ */
export default function ModalAlcances({ open, obra, onClose }) {
  const { user } = useAuth();

  const claveUnica         = obra?.clave_unica || "";
  const nombreObra         = obra?.nombre_obra || obra?.nombre || "";
  const programa           = obra?.programa    || "";
  const dg                 = obra?.dg || obra?.direccion_general || "";
  const isObrasAdicionales = programa === "OBRAS ADICIONALES";
  const area               = isObrasAdicionales ? nombreObra : "";

  const [rows,            setRows]            = useState([]);
  const [unidadesGlobales,setUnidadesGlobales]= useState([]);
  const [tipoObra,        setTipoObra]        = useState(null);
  const [savingTipo,      setSavingTipo]      = useState(false);
  const [historial,       setHistorial]       = useState([]);
  const [loadHistorial,   setLoadHistorial]   = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState(null);
  const [success,         setSuccess]         = useState(false);
  const [confirmando,     setConfirmando]     = useState(null);
  const [permitirEdicion, setPermitirEdicion] = useState(false);
  const [editandoId,      setEditandoId]      = useState(null);
  const [editValues,      setEditValues]      = useState({});
  const [savingEdit,      setSavingEdit]      = useState(false);
  const [deletingId,      setDeletingId]      = useState(null);
  const [savingTipoId,    setSavingTipoId]    = useState(null);
  /* catálogo del programa actual */
  const [tieneCatalogo,     setTieneCatalogo]     = useState(null);
  const [catalogoConceptos, setCatalogoConceptos] = useState([]);

  const cargarHistorial = useCallback(async () => {
    if (!claveUnica) { setHistorial([]); return; }
    setLoadHistorial(true);
    try { const r = await alcancesAPI.getHistorial(claveUnica); setHistorial(r.data || []); }
    catch { setHistorial([]); } finally { setLoadHistorial(false); }
  }, [claveUnica]);

  const cargarConfig = useCallback(async () => {
    try { const r = await alcancesAPI.getConfig(); setPermitirEdicion(r?.data?.permitir_edicion_alcances ?? false); }
    catch { setPermitirEdicion(false); }
  }, []);

  const cargarUnidades = useCallback(async () => {
    try { const r = await alcancesAPI.getUnidades(); setUnidadesGlobales(r.data || []); }
    catch { setUnidadesGlobales([]); }
  }, []);

  const cargarTipoObra = useCallback(async () => {
    if (!claveUnica) { setTipoObra(null); return; }
    try { const r = await alcancesAPI.getTipoObra(claveUnica); setTipoObra(r.data?.tipo_alcance || null); }
    catch { setTipoObra(null); }
  }, [claveUnica]);

  /* ── Detecta si el programa tiene catálogo de conceptos ──
     Para OBRAS ADICIONALES el catálogo existe filtrado por area=nombreObra ── */
  const cargarCatalogoProg = useCallback(async () => {
    if (!programa || programa === "SIN PROGRAMA") {
      setTieneCatalogo(false); setCatalogoConceptos([]); return;
    }
    try {
      /* Para OBRAS ADICIONALES se pasa area=nombreObra como filtro adicional */
      const r = await alcancesAPI.getConceptos(programa, area || undefined);
      const list = [...new Set(
        (r.data || []).map((c) => (typeof c === "object" ? c.concepto : c)).filter(Boolean)
      )];
      setTieneCatalogo(list.length > 0);
      setCatalogoConceptos(list);
    } catch {
      setTieneCatalogo(false); setCatalogoConceptos([]);
    }
  }, [programa, area]);

  const handleSetTipoObra = useCallback(async (tipo) => {
    if (savingTipo) return;
    /* Sin clave_unica: solo estado local; la validación de guardar se encargará */
    if (!claveUnica) { setTipoObra(tipo); return; }
    setSavingTipo(true);
    try {
      await alcancesAPI.updateTipoObra(claveUnica, { tipo_alcance: tipo, usuario: user?.email || user?.usuario || "sistema" });
      setTipoObra(tipo);
    } catch { /* silencioso */ } finally { setSavingTipo(false); }
  }, [claveUnica, savingTipo, user]);

  /* ── Sugerencias priorizando conceptos del catálogo del programa ── */
  const getSugerenciasPrioritizadas = useCallback(async (q) => {
    if (!q || q.length < 1) return [];
    const qUp = q.toUpperCase();
    const catHits = (tieneCatalogo && catalogoConceptos.length)
      ? catalogoConceptos.filter((c) => c.toUpperCase().includes(qUp)).slice(0, 6)
      : [];
    try {
      const r = await alcancesAPI.getSugerencias(q);
      const global = (r.data || []).filter((g) => !catHits.includes(g));
      return [...catHits, ...global];
    } catch {
      return catHits;
    }
  }, [tieneCatalogo, catalogoConceptos]);

  /* ── handleSetModoLibre: activa / desactiva captura libre por fila ── */
  const handleSetModoLibre = useCallback((rowId, val) => {
    setRows((prev) => prev.map((r) =>
      r.id === rowId ? {
        ...r, modoLibre: val,
        concepto: "", fromCatalog: null,
        accion: "", unidad: "", unidades: [], actividades: [],
      } : r
    ));
    setError(null);
  }, []);

  /* ── Reset al abrir ── */
  useEffect(() => {
    if (!open) return;
    setRows(isObrasAdicionales ? [] : [createRow()]);
    setError(null); setSuccess(false); setConfirmando(null);
    setEditandoId(null); setEditValues({}); setTipoObra(null);
    setTieneCatalogo(null); setCatalogoConceptos([]);
    cargarHistorial(); cargarConfig(); cargarUnidades(); cargarTipoObra(); cargarCatalogoProg();
  }, [open, isObrasAdicionales, cargarHistorial, cargarConfig, cargarUnidades, cargarTipoObra, cargarCatalogoProg]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === "Escape" && !confirmando) onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, confirmando]);

  /* ── Actualiza el texto del concepto sin hacer API call ── */
  const handleConceptoInput = useCallback((rowId, val) => {
    setRows((prev) => prev.map((r) =>
      r.id === rowId ? { ...r, concepto: val, fromCatalog: null, accion: "", unidad: "", unidades: [], actividades: [] } : r
    ));
    setError(null);
  }, []);

  /* ── Confirma el concepto: llama getDetalle para determinar si está en catálogo ── */
  const handleConceptoConfirm = useCallback(async (rowId, concepto) => {
    const val = concepto?.trim() || "";
    if (val.length < 2) return;

    /* Si el concepto ya está confirmado con el mismo valor, no resetear ni relanzar */
    let yaConfirmado = false;
    setRows((prev) => {
      const row = prev.find((r) => r.id === rowId);
      if (!row) { yaConfirmado = true; return prev; }
      if (row.fromCatalog !== null && row.concepto.trim() === val) {
        yaConfirmado = true;
        return prev;
      }
      const oldGroup = row.groupId;
      const cleaned  = oldGroup ? prev.filter((r) => !(r.groupId === oldGroup && r.id !== rowId)) : prev;
      return cleaned.map((r) =>
        r.id === rowId ? { ...r, concepto: val, loadingActs: true, accion: "", unidad: "", unidades: [], actividades: [], groupId: null, isGroupChild: false } : r
      );
    });
    if (yaConfirmado) return;

    try {
      const areaParam = isObrasAdicionales ? area : undefined;
      const res       = await alcancesAPI.getDetalle(programa, val, areaParam);
      const unidades  = res.data?.unidades_disponibles || [];
      const actividades = res.data?.actividades || [];

      if (unidades.length > 1) {
        /* Concepto de catálogo con múltiples unidades → crear grupo */
        const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === rowId);
          if (idx === -1) return prev;
          const parent = prev[idx];
          const groupRows = unidades.map((u, i) => ({
            ...(i === 0 ? parent : createRow()),
            id:           i === 0 ? rowId : `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            concepto:     val,
            accion:       i === 0 ? parent.accion : "",
            cantidad:     i === 0 ? parent.cantidad : "",
            unidad:       u, unidades: [u], actividades,
            loadingActs:  false, fromCatalog: true,
            groupId, isGroupChild: i !== 0,
          }));
          return [...prev.slice(0, idx), ...groupRows, ...prev.slice(idx + 1)];
        });
      } else {
        /* Concepto de catálogo con una sola unidad */
        const unidadAuto = unidades.length === 1 ? unidades[0] : "";
        setRows((prev) => prev.map((r) =>
          r.id === rowId ? { ...r, actividades, unidad: unidadAuto, unidades, loadingActs: false, fromCatalog: true, groupId: null, isGroupChild: false } : r
        ));
      }
    } catch {
      /* Concepto no está en catálogo → modo libre */
      setRows((prev) => prev.map((r) =>
        r.id === rowId ? { ...r, actividades: ACTIVIDADES_LIBRE, unidades: [], unidad: "", loadingActs: false, fromCatalog: false } : r
      ));
    }
  }, [programa, area, isObrasAdicionales]);

  const handleRowChange = useCallback((rowId, field, val) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === rowId);
      if (field === "accion" && row?.groupId && !row.isGroupChild) {
        /* Excepción ILIFE: eliminar variante m² y convertir parent a fila standalone */
        if (esExcepcionSinVariante(programa, dg, row.concepto, val)) {
          return prev
            .filter((r) => !(r.groupId === row.groupId && r.id !== rowId))
            .map((r) => r.id === rowId
              ? { ...r, accion: val, groupId: null, isGroupChild: false }
              : r
            );
        }
        return prev.map((r) => r.groupId === row.groupId ? { ...r, accion: val } : r);
      }
      return prev.map((r) => r.id === rowId ? { ...r, [field]: val } : r);
    });
    setError(null);
  }, [programa, dg]);

  const addRow    = useCallback(() => { setRows((p) => [...p, createRow()]); setError(null); }, []);
  const removeRow = useCallback((rowId) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === rowId);
      if (row?.groupId) {
        const rem = prev.filter((r) => r.groupId !== row.groupId);
        return rem.length > 0 ? rem : [];
      }
      return prev.filter((r) => r.id !== rowId);
    });
    setError(null);
  }, []);

  const iniciarGuardar = useCallback(() => {
    /* Clasificación obligatoria antes de guardar alcances */
    if (!tipoObra) {
      return setError("⚠ Primero selecciona la Clasificación de la obra (PROYECTADO o EJECUTADO) en el selector de arriba.");
    }

    const nonEmpty = rows.filter((r) => !isRowEmpty(r));
    if (!nonEmpty.length) return setError("Agrega al menos un alcance antes de guardar.");
    const groupIds = [...new Set(nonEmpty.filter((r) => r.groupId).map((r) => r.groupId))];
    for (const gid of groupIds) {
      if (!isGroupComplete(rows, gid)) {
        const g = rows.filter((r) => r.groupId === gid);
        const parentRow = g.find((r) => !r.isGroupChild);
        if (parentRow && esExcepcionSinVariante(programa, dg, parentRow.concepto, parentRow.accion))
          continue;
        const faltantes = g.filter((r) => !isRowComplete(r)).map((r) => r.unidad).join(", ");
        return setError(`"${g[0]?.concepto}" requiere todas sus variantes. Falta: ${faltantes}.`);
      }
    }
    const incomplete = nonEmpty.filter((r) => !r.groupId && !isRowComplete(r));
    if (incomplete.length) return setError("Completa todos los campos antes de guardar.");
    setError(null);
    setConfirmando(nonEmpty);
  }, [rows, tipoObra, programa, dg]);

  const confirmarGuardar = useCallback(async () => {
    if (!confirmando?.length) return;
    setSaving(true); setError(null);
    try {
      for (const row of confirmando) {
        await alcancesAPI.guardar({
          clave_unica: claveUnica, nombre_obra: nombreObra, programa, dg,
          accion:  row.accion,
          concepto: row.fromCatalog === false ? sanitizarConcepto(row.concepto) : row.concepto,
          cantidad: Number(row.cantidad),
          unidad:   row.unidad,
          usuario_actualizacion: user?.email || user?.usuario || "sistema",
        });
      }
      setSuccess(true);
      setRows(isObrasAdicionales ? [] : [createRow()]);
      setConfirmando(null);
      await cargarHistorial();
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(err.message || "Error al guardar.");
      setConfirmando(null);
    } finally { setSaving(false); }
  }, [confirmando, claveUnica, nombreObra, programa, dg, user, cargarHistorial, isObrasAdicionales]);

  const handleStartEdit = useCallback((item) => {
    setEditandoId(item.id);
    setEditValues({ cantidad: String(item.cantidad), unidad: item.unidad || "", accion: item.accion || "" });
  }, []);
  const handleEditChange = useCallback((field, val) => setEditValues((p) => ({ ...p, [field]: val })), []);
  const handleSaveEdit   = useCallback(async (id) => {
    const qty = Number(editValues.cantidad);
    if (!editValues.cantidad || qty <= 0 || !Number.isInteger(qty)) return;
    setSavingEdit(true);
    try {
      await alcancesAPI.editarAlcance(id, { cantidad: qty, unidad: editValues.unidad, accion: editValues.accion, usuario_edicion: user?.email || user?.usuario || "sistema" });
      setEditandoId(null); setEditValues({});
      await cargarHistorial();
    } catch (err) { setError(err.message || "Error al editar."); }
    finally { setSavingEdit(false); }
  }, [editValues, cargarHistorial, user]);
  const handleCancelEdit = useCallback(() => { setEditandoId(null); setEditValues({}); }, []);
  const handleDelete     = useCallback(async (id) => {
    setDeletingId(id);
    try { await alcancesAPI.eliminarAlcance(id); await cargarHistorial(); }
    catch (err) { setError(err.message || "Error al eliminar."); }
    finally { setDeletingId(null); }
  }, [cargarHistorial]);

  const handleUpdateTipoIndividual = useCallback(async (id, tipo) => {
    setSavingTipoId(id);
    try {
      await alcancesAPI.updateTipoIndividual(id, {
        tipo_alcance:  tipo || null,
        usuario_edicion: user?.email || user?.usuario || "sistema",
      });
      setHistorial((prev) => prev.map((h) => h.id === id ? { ...h, tipo_alcance: tipo || null } : h));
    } catch (err) { setError(err.message || "Error al actualizar tipo."); }
    finally { setSavingTipoId(null); }
  }, [user]);

  if (!open) return null;

  const hayFilasCompletas = rows.some((r) => isRowComplete(r));
  const obraMeta          = [programa, dg].filter(Boolean).join(" · ");

  return (
    <>
      <style>{ANIM_STYLE}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(5,20,10,0.52)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !confirmando) onClose?.(); }}>

        <div className="w-full flex flex-col rounded-2xl relative"
          style={{ maxWidth: "820px", maxHeight: "92vh", background: T.shellBg, border: T.shellBorder,
            boxShadow: "0 24px 64px rgba(5,25,12,0.26), 0 4px 16px rgba(5,25,12,0.12)" }}>

          {/* HEADER */}
          <div className="shrink-0 px-6 pt-5 pb-4 rounded-t-2xl" style={{ background: T.headerBg }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.58)" }}>
                  Módulo de Alcances
                  {permitirEdicion && <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#bbf7d0" }}>Edición habilitada</span>}
                </p>
                <h2 className="mt-1 text-lg font-bold leading-snug text-white truncate">{nombreObra || "Obra"}</h2>
                {obraMeta && <p className="mt-0.5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>{obraMeta}</p>}
                {claveUnica && <p className="mt-0.5 text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{claveUnica}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar"
                className="shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}>
                ✕
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto" style={{ backgroundColor: T.pageBg }}>

            {/* Captura */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-bold" style={{ color: T.text }}>Captura de alcances</p>
                  <p className="text-xs mt-0.5" style={{ color: T.textSoft }}>
                    {tieneCatalogo === true
                      ? "Selecciona el concepto del catálogo oficial. Para excepciones usa «Concepto libre»."
                      : tieneCatalogo === null && !isObrasAdicionales
                        ? "Verificando catálogo del programa…"
                        : "Escribe el concepto — si existe en el catálogo se cargará automáticamente, si no, podrás capturarlo libremente."}
                  </p>
                </div>
                {rows.length > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ backgroundColor: T.accentSoft, color: T.accentDark, border: "1px solid #86c49c" }}>
                    {rows.length} fila{rows.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {!programa || programa === "SIN PROGRAMA" ? (
                <div className="rounded-2xl px-5 py-4 text-sm text-center"
                  style={{ backgroundColor: T.cardBg, border: T.cardBorder, color: T.textSoft }}>
                  Esta obra no tiene programa asignado. No es posible registrar alcances.
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.length === 0 && (
                    <div className="rounded-2xl px-5 py-6 text-sm text-center"
                      style={{ backgroundColor: T.accentPale, border: `1px dashed ${T.inputBorder}`, color: T.textSoft }}>
                      Usa el botón de abajo para agregar el primer alcance.
                    </div>
                  )}

                  {rows.length > 0 && (() => {
                    let di = -1;
                    return rows.map((row) => {
                      if (!row.isGroupChild) di++;
                      return (
                        <AlcanceRow
                          key={row.id} row={row} index={di}
                          unidadesGlobales={unidadesGlobales}
                          onConceptoInput={handleConceptoInput}
                          onConceptoConfirm={handleConceptoConfirm}
                          onFieldChange={handleRowChange}
                          onRemove={() => removeRow(row.id)}
                          canRemove={!row.isGroupChild && (!!row.groupId || rows.length > 1 || isObrasAdicionales)}
                          onGetSugerencias={getSugerenciasPrioritizadas}
                          tieneCatalogo={tieneCatalogo === true}
                          catalogoConceptos={catalogoConceptos}
                          onSetModoLibre={handleSetModoLibre}
                        />
                      );
                    });
                  })()}

                  <div className="flex items-center justify-between gap-3 px-0.5">
                    <button type="button" onClick={addRow} className="text-sm font-semibold shrink-0"
                      style={{ backgroundColor: "transparent", color: T.accent, border: "none", cursor: "pointer", padding: 0 }}>
                      + Agregar alcance
                    </button>
                    <p className="text-xs text-right min-w-0"
                      style={{ color: error ? T.danger : success ? T.accent : T.textSoft }}>
                      {error ? error : success ? "✓ Alcances registrados" : "Escribe el concepto y confirma los campos"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Clasificación de obra */}
            <TipoObraSelector claveUnica={claveUnica} programa={programa} tipoObra={tipoObra} onSelect={handleSetTipoObra} saving={savingTipo} />

            {/* Historial */}
            <div className="mx-5 mb-5 rounded-2xl overflow-hidden" style={{ border: T.cardBorder, boxShadow: T.cardShadow }}>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ backgroundColor: T.rowHeader, borderBottom: `1px solid ${T.divider}` }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textMid }}>Historial de alcances</p>
                <div className="flex items-center gap-2">
                  {permitirEdicion && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: "rgba(22,101,52,0.10)", color: T.accent, border: "1px solid rgba(22,101,52,0.25)" }}>Edición ON</span>}
                  {!loadHistorial && <span className="text-xs font-medium" style={{ color: T.textSoft }}>{historial.length} registro{historial.length !== 1 ? "s" : ""}</span>}
                </div>
              </div>
              <div className="p-4" style={{ backgroundColor: T.cardBg }}>
                {loadHistorial ? (
                  <div className="flex items-center justify-center gap-2 py-8"><Spin size={16}/><span className="text-xs" style={{ color: T.textSoft }}>Cargando historial…</span></div>
                ) : historial.length === 0 ? <HistorialVacio /> : (
                  <div className="space-y-2">
                    {historial.map((item) => (
                      <HistorialCard key={item.id} item={item} tipoObra={tipoObra} permitirEdicion={permitirEdicion}
                        editandoId={editandoId} editValues={editValues}
                        onEdit={handleStartEdit} onDelete={handleDelete} onUpdateTipo={handleUpdateTipoIndividual}
                        onEditChange={handleEditChange} onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit} savingEdit={savingEdit} deletingId={deletingId} savingTipoId={savingTipoId} />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="shrink-0 px-5 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 rounded-b-2xl"
            style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.divider}` }}>
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: "#f2f7f4", color: T.textMid, border: `1px solid ${T.inputBorder}`, cursor: "pointer" }}>
              Cerrar
            </button>
            {programa && programa !== "SIN PROGRAMA" && (
              <button type="button" onClick={iniciarGuardar} disabled={saving || !hayFilasCompletas}
                className="text-sm font-bold px-6 py-2.5 rounded-xl transition-all"
                style={{ backgroundColor: saving || !hayFilasCompletas ? "#b8cfc0" : T.accent, color: "#ffffff",
                  border: "1px solid transparent", cursor: saving || !hayFilasCompletas ? "not-allowed" : "pointer",
                  boxShadow: saving || !hayFilasCompletas ? "none" : "0 6px 16px rgba(14,75,42,0.26)" }}>
                Guardar alcances
              </button>
            )}
          </div>

          {confirmando && (
            <ConfirmacionGuardado rows={confirmando} onConfirmar={confirmarGuardar}
              onCancelar={() => setConfirmando(null)} saving={saving} />
          )}
        </div>
      </div>
    </>
  );
}
