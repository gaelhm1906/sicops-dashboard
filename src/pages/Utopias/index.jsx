/**
 * pages/Utopias/index.jsx
 * Listado principal del subsistema UTOPÍAS.
 *
 * Muestra utopías agrupadas por obra con resumen ejecutivo (KPIs globales +
 * cards por utopía). Desde aquí se navega al detalle de frentes de cada utopía.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Layout/Sidebar";
import Footer from "../../components/Layout/Footer";
import { utopiasAPI } from "../../utils/api";

/* ── Helpers ── */
function pct(n) {
  return Number.isFinite(Number(n)) ? `${(Number(n) * 100).toFixed(1)}%` : "—";
}
function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
}

/* ── Paleta ── */
const COLOR = {
  guinda:    "#691C32",
  guindaDark:"#4F0E21",
  gold:      "#B8912A",
  goldSoft:  "#F5E8D1",
  bg:        "#F8F5F2",
  surface:   "#FFFFFF",
  border:    "rgba(201,166,107,0.22)",
};

function colorAvance(avance, entregada = false) {
  if (entregada) return "#3b82f6";
  const n = Number(avance);
  if (n >= 0.80) return "#22c55e";
  if (n >= 0.50) return "#f59e0b";
  if (n >= 0.20) return "#ef4444";
  return "#9ca3af";
}

/* ── KPI chip global ── */
function KpiChip({ label, value, sub }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col"
      style={{
        background:  "rgba(255,255,255,0.70)",
        border:      COLOR.border,
        backdropFilter: "blur(8px)",
        boxShadow:   "0 4px 16px rgba(38,26,17,0.07)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: COLOR.guinda }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Barra de avance ── */
function ProgressBar({ value }) {
  const n   = Math.max(0, Math.min(100, (Number(value) || 0) * 100));
  const col = colorAvance(Number(value) || 0);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: "8px", backgroundColor: "rgba(0,0,0,0.07)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${n}%`, backgroundColor: col }}
      />
    </div>
  );
}

/* ── Card de utopía ── */
function UtopiaCard({ utopia, onClick }) {
  const avance     = Number(utopia.avance_promedio || 0);
  const atraso     = Number(utopia.atraso_promedio  || 0);
  const entregada  = Boolean(utopia.entregada);
  const col        = colorAvance(avance, entregada);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-[20px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: COLOR.surface,
        border:     "1px solid rgba(201,166,107,0.20)",
        boxShadow:  "0 4px 16px rgba(38,26,17,0.06)",
      }}
    >
      {/* Tira de color según avance */}
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${col} ${avance * 100}%, rgba(0,0,0,0.06) ${avance * 100}%)` }} />

      <div className="px-5 py-4">
        {/* Nombre + frentes */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 overflow-hidden">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-1 truncate"
              style={{ color: COLOR.gold }}
            >
              {utopia.clave_unica || "—"}
            </p>
            <h3
              className="text-sm font-bold leading-snug line-clamp-2"
              style={{ color: COLOR.guindaDark }}
            >
              {utopia.nombre_obra}
            </h3>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {entregada && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                ENTREGADA
              </span>
            )}
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: "rgba(105,28,50,0.08)", color: COLOR.guinda }}
            >
              {utopia.total_frentes} frente{utopia.total_frentes !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Barra de avance */}
        <ProgressBar value={avance} />
        <div className="flex items-center justify-between mt-1.5 text-xs">
          <span className="font-semibold" style={{ color: col }}>{pct(avance)} avance</span>
          {atraso > 0 && (
            <span className="text-red-500 font-medium">−{pct(atraso)} atraso</span>
          )}
        </div>

        {/* Meta KPIs */}
        <div
          className="mt-4 pt-3 grid grid-cols-3 gap-2 text-center"
          style={{ borderTop: "1px solid rgba(201,166,107,0.14)" }}
        >
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Monto</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{money(utopia.monto_total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fuerza</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{Number(utopia.fuerza_total || 0)} p.</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Empresas</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{(utopia.empresas || []).length}</p>
          </div>
        </div>

        {/* Indicador de acción */}
        <div
          className="mt-3 text-right text-[11px] font-semibold"
          style={{ color: COLOR.guinda }}
        >
          Ver frentes →
        </div>
      </div>
    </button>
  );
}

/* ── Filtro/búsqueda ── */
function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        placeholder="Buscar utopía por nombre o clave…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-shadow"
        style={{
          border:     "1px solid rgba(201,166,107,0.28)",
          background: "#fff",
        }}
      />
    </div>
  );
}

/* ── Pantalla principal ── */
export default function UtopiasList() {
  const navigate = useNavigate();

  const [utopias,  setUtopias]  = useState([]);
  const [resumen,  setResumen]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, resRes] = await Promise.all([
        utopiasAPI.listar(),
        utopiasAPI.resumen(),
      ]);
      setUtopias(listRes.data || []);
      setResumen(resRes.data || null);
    } catch (err) {
      setError(err.message || "Error al cargar utopías.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return utopias;
    const q = busqueda.toUpperCase();
    return utopias.filter(
      (u) =>
        u.nombre_obra?.toUpperCase().includes(q) ||
        u.clave_unica?.toUpperCase().includes(q)
    );
  }, [utopias, busqueda]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLOR.bg }}>

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">

          {/* ── Encabezado institucional ── */}
          <div
            className="rounded-[24px] px-6 py-6 mb-6 overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${COLOR.guinda} 0%, #7E2843 60%, ${COLOR.guindaDark} 100%)` }}
          >
            <div className="relative z-10">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                style={{ backgroundColor: "rgba(255,255,255,0.10)", color: "rgba(255,248,241,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                ★ SUBSISTEMA ESPECIALIZADO
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Sistema Utopías
              </h1>
              <p className="mt-1 text-sm" style={{ color: "rgba(255,248,241,0.78)" }}>
                Control operativo de frentes · SICOPS / PLATAFORMA SOBSE · SOBSE CDMX
              </p>
            </div>
            {/* Decoración */}
            <div
              className="absolute right-0 top-0 w-48 h-full opacity-10"
              style={{
                background: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.6) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* ── KPIs globales ── */}
          {resumen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <KpiChip label="Total utopías"    value={resumen.total_utopias}       />
              <KpiChip label="Total frentes"    value={resumen.total_frentes}       />
              <KpiChip label="Avance global"    value={pct(resumen.avance_global)}  />
              <KpiChip label="Atraso global"    value={pct(resumen.atraso_global)}  />
              <KpiChip label="Fuerza de trabajo"value={resumen.fuerza_total}        sub="personas" />
              <KpiChip label="Terminados"       value={resumen.frentes_terminados}  sub="frentes" />
            </div>
          )}

          {/* ── Búsqueda ── */}
          <div className="mb-5">
            <SearchBar value={busqueda} onChange={setBusqueda} />
          </div>

          {/* ── Estados ── */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: COLOR.guinda }} />
              <span className="ml-3 text-sm text-gray-500">Cargando utopías…</span>
            </div>
          )}

          {error && !loading && (
            <div
              className="rounded-2xl px-5 py-4 text-sm text-center"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#b91c1c" }}
            >
              <p className="font-semibold mb-1">Error al cargar datos</p>
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="mt-3 rounded-xl px-4 py-1.5 text-xs font-bold text-white"
                style={{ background: COLOR.guinda }}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && filtradas.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              {busqueda ? "Sin resultados para la búsqueda." : "No hay utopías registradas en el sistema."}
            </div>
          )}

          {!loading && !error && filtradas.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-4">
                {filtradas.length} utopía{filtradas.length !== 1 ? "s" : ""} encontrada{filtradas.length !== 1 ? "s" : ""}
                {busqueda ? ` para "${busqueda}"` : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtradas.map((u) => (
                  <UtopiaCard
                    key={u.clave_unica || u.nombre_obra}
                    utopia={u}
                    onClick={() => navigate(`/utopias/${encodeURIComponent(u.clave_unica || u.nombre_obra)}`)}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
