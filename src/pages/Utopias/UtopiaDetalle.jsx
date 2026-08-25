/**
 * pages/Utopias/UtopiaDetalle.jsx
 * Detalle de una utopía: resumen ejecutivo + cards por frente + modal de actualización.
 *
 * URL: /utopias/:clave
 *
 * Regla crítica: avance_general es readonly — se calcula automáticamente desde frentes.
 * Solo se actualiza avance_real, avance_semanal, atraso, observaciones, fuerza_de_trabajo
 * de cada frente individual.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Layout/Sidebar";
import Footer from "../../components/Layout/Footer";
import { utopiasAPI } from "../../utils/api";

/* ── Helpers ── */
function pct(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
}
function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
}
function fecha(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const COLOR = {
  guinda:    "#691C32",
  guindaDark:"#4F0E21",
  gold:      "#B8912A",
  goldSoft:  "#F5E8D1",
  bg:        "#F8F5F2",
  surface:   "#FFFFFF",
  border:    "rgba(201,166,107,0.22)",
};

function colorAvance(avance) {
  const n = Number(avance);
  if (n >= 0.80) return "#22c55e";
  if (n >= 0.50) return "#f59e0b";
  if (n >= 0.20) return "#ef4444";
  return "#9ca3af";
}

/* ── Barra de avance ── */
function ProgressBar({ value, height = 8 }) {
  const n   = Math.max(0, Math.min(100, (Number(value) || 0) * 100));
  const col = colorAvance(Number(value) || 0);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: "rgba(0,0,0,0.08)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${n}%`, backgroundColor: col }}
      />
    </div>
  );
}

/* ── Chip pequeño de dato ── */
function DataChip({ label, value, accent }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: accent || "#1f2937" }}>{value || "—"}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL DE ACTUALIZACIÓN DE FRENTE
══════════════════════════════════════════════════════════════ */
function ModalActualizarFrente({ frente, onClose, onSuccess }) {
  const { user } = useAuth();

  const prevAvancePct = Number(frente.avance_real) * 100;

  const [form, setForm] = useState({
    avance_real:       frente.avance_real != null ? String((Number(frente.avance_real) * 100).toFixed(2)) : "",
    avance_semanal:    frente.avance_semanal != null ? String((Number(frente.avance_semanal) * 100).toFixed(2)) : "",
    atraso:            frente.atraso != null ? String((Number(frente.atraso) * 100).toFixed(2)) : "",
    observaciones:     frente.observaciones ?? "",
    fuerza_de_trabajo: String(frente.fuerza_de_trabajo ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = useCallback((field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  }, []);

  const handleAvanceRealChange = useCallback((e) => {
    const val = e.target.value;
    const newPct = Number(val);
    setForm((prev) => {
      const updates = { ...prev, avance_real: val };
      if (Number.isFinite(newPct) && val !== "") {
        updates.avance_semanal = String(Math.max(0, newPct - prevAvancePct).toFixed(2));
        if (newPct >= 100) updates.atraso = "0.00";
      }
      return updates;
    });
    setError(null);
  }, [prevAvancePct]);

  const avanceNum = Number(form.avance_real);
  const avanceValido = Number.isFinite(avanceNum) && avanceNum >= 0 && avanceNum <= 100;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!avanceValido) {
      setError("El avance debe ser un número entre 0 y 100.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const campos = {};
      if (form.avance_real    !== "")  campos.avance_real       = Number(form.avance_real) / 100;
      if (form.avance_semanal !== "")  campos.avance_semanal    = Number(form.avance_semanal) / 100;
      if (form.atraso         !== "")  campos.atraso            = Number(form.atraso) / 100;
      if (form.observaciones  !== "")  campos.observaciones     = form.observaciones;
      if (form.fuerza_de_trabajo !== "") campos.fuerza_de_trabajo = Number(form.fuerza_de_trabajo);

      await utopiasAPI.actualizarFrente(frente.id, campos);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar cambios.");
    } finally {
      setSaving(false);
    }
  }, [avanceValido, form, frente.id, onSuccess, onClose]);

  const fieldStyle = {
    width:      "100%",
    padding:    "8px 12px",
    borderRadius: "10px",
    border:     "1px solid rgba(201,166,107,0.30)",
    fontSize:   "13px",
    outline:    "none",
    background: "#fefdfb",
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,10,12,0.65)", backdropFilter: "blur(8px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-[24px] overflow-hidden flex flex-col"
        style={{ maxWidth: "520px", maxHeight: "90vh", background: "linear-gradient(180deg, #fffdf9 0%, #f6f1e8 100%)", border: COLOR.border, boxShadow: "0 24px 60px rgba(38,26,17,0.22)" }}
      >
        {/* Hero */}
        <div
          className="px-6 py-5 shrink-0"
          style={{ background: `linear-gradient(135deg, ${COLOR.guinda} 0%, #7E2843 60%, ${COLOR.guindaDark} 100%)` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(255,248,241,0.65)" }}>
                Actualizar frente — UTOPÍAS
              </p>
              <h3 className="text-base font-bold text-white leading-tight line-clamp-2">
                {frente.frente || "Frente sin nombre"}
              </h3>
              <p className="text-xs mt-1" style={{ color: "rgba(255,248,241,0.70)" }}>
                {frente.empresa}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.10)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Avance real — campo principal */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="avance_real">
              Avance real (%) <span style={{ color: COLOR.guinda }}>*</span>
            </label>
            <input
              id="avance_real"
              type="number"
              min="0" max="100" step="0.1"
              value={form.avance_real}
              onChange={handleAvanceRealChange}
              style={fieldStyle}
              placeholder="0 – 100"
              required
            />
            {form.avance_real !== "" && (
              <div className="mt-2">
                <ProgressBar value={Number(form.avance_real) / 100} height={6} />
                <p className="text-[11px] mt-1 text-gray-400">
                  El avance general de la obra se recalculará automáticamente al guardar.
                </p>
              </div>
            )}
          </div>

          {/* Avance semanal */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="avance_semanal">
              Avance semanal (%)
            </label>
            <input
              id="avance_semanal"
              type="number"
              min="0" max="100" step="0.1"
              value={form.avance_semanal}
              onChange={handleChange("avance_semanal")}
              style={fieldStyle}
              placeholder="Avance de esta semana"
            />
          </div>

          {/* Atraso */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="atraso">
              Atraso (%)
            </label>
            <input
              id="atraso"
              type="number"
              min="0" max="100" step="0.1"
              value={form.atraso}
              onChange={handleChange("atraso")}
              style={fieldStyle}
              placeholder="0 si está en tiempo"
            />
          </div>

          {/* Fuerza de trabajo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="fuerza">
              Fuerza de trabajo (personas)
            </label>
            <input
              id="fuerza"
              type="number"
              min="0"
              value={form.fuerza_de_trabajo}
              onChange={handleChange("fuerza_de_trabajo")}
              style={fieldStyle}
              placeholder="Número de trabajadores activos"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="observaciones">
              Observaciones
            </label>
            <textarea
              id="observaciones"
              rows={3}
              value={form.observaciones}
              onChange={handleChange("observaciones")}
              style={{ ...fieldStyle, resize: "vertical", minHeight: "72px" }}
              placeholder="Avances, bloqueos, notas operativas…"
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#b91c1c" }}
            >
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          className="shrink-0 px-6 py-4 flex gap-3 justify-end"
          style={{ borderTop: "1px solid rgba(201,166,107,0.18)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="frente-form"
            disabled={saving || !avanceValido}
            onClick={handleSubmit}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all"
            style={{
              background: saving ? "#9ca3af" : `linear-gradient(135deg, ${COLOR.guinda} 0%, #7E2843 100%)`,
              cursor:     saving ? "wait" : "pointer",
              opacity:    !avanceValido ? 0.5 : 1,
            }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Estatus calculado de frente ── */
function getEstatusFrente(frente) {
  const est = (frente.estatus || "").toUpperCase();
  if (est === "ENTREGADO") return { label: "ENTREGADO",  bg: "rgba(59,130,246,0.10)",  color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.28)" };
  if (est === "TERMINADO" || Number(frente.avance_real) >= 1) return { label: "TERMINADO",   bg: "rgba(34,197,94,0.10)",   color: "#166534", border: "1px solid rgba(34,197,94,0.28)" };
  if (Number(frente.avance_real) > 0) return { label: "EN PROCESO",  bg: "rgba(245,158,11,0.10)", color: "#92400e", border: "1px solid rgba(245,158,11,0.28)" };
  return { label: "SIN INICIAR", bg: "rgba(156,163,175,0.14)", color: "#6b7280", border: "1px solid rgba(156,163,175,0.28)" };
}

/* ══════════════════════════════════════════════════════════════
   CARD DE FRENTE
══════════════════════════════════════════════════════════════ */
function FrenteCard({ frente, onEdit }) {
  const avance  = Number(frente.avance_real || 0);
  const atraso  = Number(frente.atraso       || 0);
  const entregado = (frente.estatus || "").toUpperCase() === "ENTREGADO";
  const col     = entregado ? "#3b82f6" : colorAvance(avance);
  const estatusInfo = getEstatusFrente(frente);

  return (
    <div
      className="rounded-[18px] overflow-hidden"
      style={{ background: COLOR.surface, border: "1px solid rgba(201,166,107,0.18)", boxShadow: "0 3px 12px rgba(38,26,17,0.06)" }}
    >
      {/* Tira de color */}
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${col} ${avance * 100}%, rgba(0,0,0,0.06) ${avance * 100}%)` }} />

      <div className="px-4 py-4">
        {/* Empresa + frente */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-0.5" style={{ color: COLOR.gold }}>
              {frente.empresa || "—"}
            </p>
            <h4 className="text-sm font-bold text-gray-800 leading-snug">{frente.frente || "Frente sin nombre"}</h4>
            {frente.contrato && (
              <p className="text-xs text-gray-400 mt-0.5">Contrato: {frente.contrato}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: estatusInfo.bg, color: estatusInfo.color, border: estatusInfo.border }}
            >
              {estatusInfo.label}
            </span>
            <button
              type="button"
              onClick={() => onEdit(frente)}
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${COLOR.guinda} 0%, #7E2843 100%)` }}
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Avance */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: col }}>Avance: {pct(avance)}</span>
            {atraso > 0 && (
              <span className="text-xs text-red-500 font-medium">Atraso: {pct(atraso)}</span>
            )}
          </div>
          <ProgressBar value={avance} height={6} />
          {frente.avance_semanal > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">
              Avance semanal: <strong>{pct(frente.avance_semanal)}</strong>
            </p>
          )}
        </div>

        {/* Meta datos en grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <DataChip label="Monto"          value={money(frente.monto_con_iva)} />
          <DataChip label="Fuerza trabajo" value={frente.fuerza_de_trabajo ? `${frente.fuerza_de_trabajo} p.` : null} />
          <DataChip label="Avance prog."   value={pct(frente.avance_programado)} />
          <DataChip label="JUD"            value={frente.jud_responsable} />
          <DataChip label="Inicio"         value={fecha(frente.fecha_de_inicio)} />
          <DataChip label="Término"        value={fecha(frente.fecha_de_termino)} />
        </div>

        {/* Observaciones */}
        {frente.observaciones && (
          <div
            className="mt-3 rounded-xl px-3 py-2.5 text-xs text-gray-600 leading-5"
            style={{ background: "rgba(201,166,107,0.08)", border: "1px solid rgba(201,166,107,0.18)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1">Observaciones</p>
            {frente.observaciones}
          </div>
        )}

        {/* Última actualización */}
        {frente.updated_at && (
          <p className="mt-2 text-[10px] text-gray-300 text-right">
            Actualizado: {fecha(frente.updated_at)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTROS
══════════════════════════════════════════════════════════════ */
function FiltroBar({ frentes, filtro, onFiltro }) {
  const empresas = useMemo(() => [...new Set(frentes.map((f) => f.empresa).filter(Boolean))].sort(), [frentes]);
  const juds     = useMemo(() => [...new Set(frentes.map((f) => f.jud_responsable).filter(Boolean))].sort(), [frentes]);

  const selectStyle = {
    padding:      "6px 10px",
    borderRadius: "10px",
    border:       "1px solid rgba(201,166,107,0.28)",
    fontSize:     "12px",
    background:   "#fff",
    cursor:       "pointer",
    outline:      "none",
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <select
        value={filtro.empresa}
        onChange={(e) => onFiltro({ ...filtro, empresa: e.target.value })}
        style={selectStyle}
        aria-label="Filtrar por empresa"
      >
        <option value="">Todas las empresas</option>
        {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>

      <select
        value={filtro.jud}
        onChange={(e) => onFiltro({ ...filtro, jud: e.target.value })}
        style={selectStyle}
        aria-label="Filtrar por JUD"
      >
        <option value="">Todos los JUD</option>
        {juds.map((j) => <option key={j} value={j}>{j}</option>)}
      </select>

      <select
        value={filtro.estatus}
        onChange={(e) => onFiltro({ ...filtro, estatus: e.target.value })}
        style={selectStyle}
        aria-label="Filtrar por estatus"
      >
        <option value="">Todos los estatus</option>
        <option value="terminado">Terminados (≥100%)</option>
        <option value="proceso">En proceso (1–99%)</option>
        <option value="sin_iniciar">Sin iniciar (0%)</option>
      </select>

      {(filtro.empresa || filtro.jud || filtro.estatus) && (
        <button
          type="button"
          onClick={() => onFiltro({ empresa: "", jud: "", estatus: "" })}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "rgba(105,28,50,0.08)", color: COLOR.guinda, border: "1px solid rgba(105,28,50,0.14)" }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function UtopiaDetalle() {
  const { clave }    = useParams();
  const navigate     = useNavigate();

  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [editFrente,    setEditFrente]    = useState(null);
  const [filtro,        setFiltro]        = useState({ empresa: "", jud: "", estatus: "" });
  const [savingEntrega, setSavingEntrega] = useState(false);
  const [entregarError, setEntregarError] = useState(null);
  const [modoMonto,     setModoMonto]     = useState(false);

  const fetchData = useCallback(async () => {
    if (!clave) return;
    setLoading(true);
    setError(null);
    try {
      const res = await utopiasAPI.detalle(clave);
      setData(res);
    } catch (err) {
      setError(err.message || "Error al cargar la utopía.");
    } finally {
      setLoading(false);
    }
  }, [clave]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const obraEntregada = useMemo(
    () => data?.frentes?.length > 0 && data.frentes.every((f) => (f.estatus || "").toUpperCase() === "ENTREGADO"),
    [data]
  );

  const handleEntregarObra = useCallback(async () => {
    if (!data?.frentes?.length) return;
    setSavingEntrega(true);
    setEntregarError(null);
    try {
      await Promise.all(
        data.frentes.map((f) =>
          utopiasAPI.actualizarFrente(f.id, {
            avance_real:    1.0,
            atraso:         0,
            avance_semanal: Math.max(0, 1.0 - Number(f.avance_real)),
            estatus:        "ENTREGADO",
          })
        )
      );
      await fetchData();
    } catch (err) {
      setEntregarError(err.message || "Error al marcar la obra como entregada.");
    } finally {
      setSavingEntrega(false);
    }
  }, [data, fetchData]);

  const avancePonderado = useMemo(() => {
    if (!data?.frentes?.length) return 0;
    let num = 0, den = 0;
    for (const f of data.frentes) {
      const v = Number(f.avance_real);
      const w = Number(f.monto_con_iva);
      if (!Number.isFinite(v) || !Number.isFinite(w) || w <= 0) continue;
      num += v * w;
      den += w;
    }
    return den > 0 ? num / den : Number(data.resumen?.avance_promedio ?? 0);
  }, [data]);

  const frentesFiltrados = useMemo(() => {
    if (!data?.frentes) return [];
    let list = data.frentes;
    if (filtro.empresa) list = list.filter((f) => f.empresa === filtro.empresa);
    if (filtro.jud)     list = list.filter((f) => f.jud_responsable === filtro.jud);
    if (filtro.estatus === "terminado")   list = list.filter((f) => Number(f.avance_real) >= 1);
    if (filtro.estatus === "proceso")     list = list.filter((f) => Number(f.avance_real) > 0 && Number(f.avance_real) < 1);
    if (filtro.estatus === "sin_iniciar") list = list.filter((f) => !Number(f.avance_real));
    return list;
  }, [data, filtro]);

  const r = data?.resumen;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLOR.bg }}>

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => navigate("/utopias")}
              className="font-medium hover:underline"
              style={{ color: COLOR.guinda }}
            >
              Sistema Utopías
            </button>
            <span>›</span>
            <span className="text-gray-700 truncate max-w-xs">{r?.nombre_obra || clave}</span>
          </div>

          {/* Estados de carga */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: COLOR.guinda }} />
              <span className="ml-3 text-sm text-gray-500">Cargando frentes…</span>
            </div>
          )}

          {error && !loading && (
            <div
              className="rounded-2xl px-5 py-5 text-center"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#b91c1c" }}
            >
              <p className="font-semibold mb-2">{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="rounded-xl px-4 py-1.5 text-xs font-bold text-white"
                style={{ background: COLOR.guinda }}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── Encabezado institucional ── */}
              <div
                className="rounded-[24px] px-6 py-6 mb-6 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${COLOR.guinda} 0%, #7E2843 60%, ${COLOR.guindaDark} 100%)` }}
              >
                <div className="relative z-10">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                    style={{ backgroundColor: "rgba(255,255,255,0.10)", color: "rgba(255,248,241,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    ★ {r?.clave_unica || clave}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                    {r?.nombre_obra || "Utopía"}
                  </h1>
                  <p className="mt-1 text-sm" style={{ color: "rgba(255,248,241,0.72)" }}>
                    Avance general calculado automáticamente desde frentes — readonly
                  </p>
                </div>
                <div
                  className="absolute right-0 top-0 w-48 h-full opacity-10"
                  style={{ background: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.6) 0%, transparent 70%)", pointerEvents: "none" }}
                />
              </div>

              {/* ── RESUMEN EJECUTIVO ── */}
              {r && (
                <div
                  className="rounded-[20px] p-5 mb-6"
                  style={{ background: COLOR.surface, border: COLOR.border, boxShadow: "0 4px 16px rgba(38,26,17,0.06)" }}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px]"
                        style={{ background: COLOR.guinda, color: "#fff" }}
                      >
                        ▸
                      </div>
                      <h2 className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: COLOR.guinda }}>
                        Resumen Ejecutivo
                      </h2>
                    </div>
                    {/* Toggle Promedio Simple / Ponderado por Monto */}
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span style={{ color: !modoMonto ? COLOR.guinda : "#9ca3af" }}>Promedio Simple</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={modoMonto}
                        onClick={() => setModoMonto((v) => !v)}
                        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                        style={{ backgroundColor: modoMonto ? COLOR.guinda : "#d1d5db" }}
                      >
                        <span
                          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                          style={{ transform: modoMonto ? "translateX(16px)" : "translateX(0)" }}
                        />
                      </button>
                      <span style={{ color: modoMonto ? COLOR.guinda : "#9ca3af" }}>Ponderado por Monto</span>
                    </div>
                  </div>

                  {/* Avance general — readonly */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-500">
                        {modoMonto ? "Avance ponderado por monto" : "Avance promedio (calculado automáticamente)"}
                      </span>
                      <span className="text-xl font-bold" style={{ color: colorAvance(modoMonto ? avancePonderado : r.avance_promedio) }}>
                        {pct(modoMonto ? avancePonderado : r.avance_promedio)}
                      </span>
                    </div>
                    <ProgressBar value={modoMonto ? avancePonderado : r.avance_promedio} height={10} />
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Este valor se sincroniza automáticamente con obras_puntos. No se puede editar manualmente.
                    </p>
                  </div>

                  {/* KPIs en grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <DataChip label="Total frentes"    value={r.total_frentes}              />
                    <DataChip label="Avance prog."     value={pct(r.avance_programado)}     />
                    <DataChip label="Atraso promedio"  value={pct(r.atraso_promedio)}       accent="#ef4444" />
                    <DataChip label="Fuerza de trabajo"value={`${r.fuerza_total || 0} p.`} />
                    <DataChip label="Monto total"      value={money(r.monto_total)}         />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <DataChip label="Inicio"  value={fecha(r.fecha_inicio)} />
                    <DataChip label="Término" value={fecha(r.fecha_termino)} />
                  </div>

                  {/* ── Marcar obra como ENTREGADA ── */}
                  <div className="mt-5 pt-4 flex items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(201,166,107,0.18)" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={{ color: obraEntregada ? "#1d4ed8" : COLOR.guinda }}>
                        {obraEntregada ? "Obra marcada como ENTREGADA" : "Marcar obra como ENTREGADA"}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {obraEntregada
                          ? "Todos los frentes tienen estatus ENTREGADO."
                          : "Establece todos los frentes en avance 100%, atraso 0% y estatus ENTREGADO."}
                      </p>
                      {entregarError && (
                        <p className="text-[11px] text-red-600 mt-1">{entregarError}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleEntregarObra}
                      disabled={savingEntrega || obraEntregada}
                      className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all"
                      style={{
                        background: obraEntregada ? "#93c5fd" : savingEntrega ? "#9ca3af" : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        cursor: (savingEntrega || obraEntregada) ? "default" : "pointer",
                      }}
                    >
                      {savingEntrega ? "Procesando…" : obraEntregada ? "Entregada" : "Entregar obra"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Filtros ── */}
              {data.frentes?.length > 0 && (
                <FiltroBar
                  frentes={data.frentes}
                  filtro={filtro}
                  onFiltro={setFiltro}
                />
              )}

              {/* ── Cards de frentes ── */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: COLOR.guinda }}>
                  Frentes ({frentesFiltrados.length}{frentesFiltrados.length !== data.frentes?.length ? ` de ${data.frentes?.length}` : ""})
                </h2>
              </div>

              {frentesFiltrados.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No hay frentes con los filtros seleccionados.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {frentesFiltrados.map((f) => (
                    <FrenteCard key={f.id} frente={f} onEdit={setEditFrente} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Footer />

      {/* Modal de actualización de frente */}
      {editFrente && (
        <ModalActualizarFrente
          frente={editFrente}
          onClose={() => setEditFrente(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
