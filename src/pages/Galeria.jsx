import React, { useState, useMemo, Fragment } from "react";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import { useObras } from "../context/ObraContext";
import { useAuth } from "../context/AuthContext";
import { dgFijaPara, esVistaEjecutiva } from "../utils/roles";

/* ── Iconos — mismo trazo neutro que el resto del sistema ── */
function IconCamara() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function IconCamaraPro() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
      <path d="M18 7l1.5-1.5" />
    </svg>
  );
}
function IconDron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 9L4 4M15 9l5-5M9 15l-5 5M15 15l5 5" />
      <circle cx="4" cy="4" r="2" /><circle cx="20" cy="4" r="2" /><circle cx="4" cy="20" r="2" /><circle cx="20" cy="20" r="2" />
    </svg>
  );
}

const MODULOS = [
  { id: "operativas", label: "Fotografías operativas", nota: "Incluye reporte 360°", Icon: IconCamara },
  { id: "videos", label: "Videos", nota: null, Icon: IconVideo },
  { id: "profesionales", label: "Fotografías profesionales", nota: null, Icon: IconCamaraPro },
  { id: "dron", label: "Vuelos de dron", nota: null, Icon: IconDron },
];

function Breadcrumb({ pasos }) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 mb-3 text-xs">
      {pasos.map((paso, i) => (
        <Fragment key={i}>
          {i > 0 && <span style={{ color: "var(--ink-faint)" }}>›</span>}
          {paso.onClick ? (
            <button type="button" onClick={paso.onClick} className="font-semibold hover:opacity-70 transition-opacity truncate max-w-[160px]" style={{ color: "var(--guinda)" }}>
              {paso.label}
            </button>
          ) : (
            <span className="font-bold truncate max-w-[200px]" style={{ color: "var(--ink)" }}>{paso.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/* ── Nivel 1 · Dirección General ── */
function DGCard({ dg, total, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl p-5 text-left transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-1 active:scale-[0.97] flex flex-col justify-between"
      style={{ aspectRatio: "1 / 1", background: "linear-gradient(135deg, var(--guinda) 0%, var(--guinda-dark) 100%)", color: "#fff", boxShadow: "var(--shadow-tier1)" }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest opacity-75">Dirección General</p>
      <div>
        <p className="text-lg font-black leading-tight">{dg}</p>
        <p className="text-xs opacity-80 mt-1">{total} obra{total === 1 ? "" : "s"}</p>
      </div>
    </button>
  );
}

/* ── Nivel 2 · Programa ── */
function ProgramaRow({ programa, total, onClick }) {
  return (
    <button type="button" onClick={onClick} className="task-row card w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]" style={{ borderLeftColor: "var(--oro)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{programa}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{total} obra{total === 1 ? "" : "s"}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  );
}

/* ── Nivel 3 · Obra (grid) ── */
function ObraTile({ obra, onClick }) {
  return (
    <button type="button" onClick={onClick} className="card text-left p-4 transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-[0.98]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--surface-2)", color: "var(--oro)" }}>
        <IconCamara />
      </div>
      <p className="text-sm font-bold leading-snug" style={{ color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {obra.nombre_obra || obra.nombre}
      </p>
    </button>
  );
}

/* ── Selector de módulo — visible y usable en cualquier nivel ── */
function SelectorModulo({ activo, onCambiar }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
      {MODULOS.map((m) => {
        const seleccionado = m.id === activo;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onCambiar(m.id)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
            style={seleccionado
              ? { backgroundColor: "var(--guinda)", color: "#fff" }
              : { backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            <m.Icon />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Nivel 4 · Galería de la obra para el módulo seleccionado ── */
function GaleriaObra({ obra, modulo }) {
  return (
    <div className="card bg-blueprint text-center py-14 px-6">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: "var(--surface-2)", color: "var(--oro)", border: "1px solid var(--border)" }}
      >
        <modulo.Icon />
      </div>
      <p className="text-sm font-black" style={{ color: "var(--ink)" }}>
        Aún no hay {modulo.label.toLowerCase()} registradas para esta obra.
      </p>
      <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--ink-faint)" }}>
        Esta sección se completa sola conforme el personal en campo suba evidencia desde sus formularios de captura — no requiere una carga aparte.
      </p>
    </div>
  );
}

export default function Galeria() {
  const { obrasRaw, obras, loading } = useObras();
  const { user } = useAuth();
  const base = obrasRaw || obras;
  const dgFija = dgFijaPara(user);

  const [dgActiva, setDgActiva] = useState(dgFija || null);
  const [programaActivo, setProgramaActivo] = useState(null);
  const [obraActiva, setObraActiva] = useState(null);
  const [moduloActivo, setModuloActivo] = useState(MODULOS[0].id);

  const dgAgregados = useMemo(() => {
    const map = {};
    for (const o of base) {
      const dg = (o.dg || o.direccion_general || "SIN DIRECCION").trim();
      (map[dg] || (map[dg] = [])).push(o);
    }
    return Object.entries(map)
      .map(([dg, obrasDg]) => ({ dg, obras: obrasDg, total: obrasDg.length }))
      .sort((a, b) => b.total - a.total);
  }, [base]);

  const dgActivaData = dgAgregados.find((d) => d.dg === dgActiva) || null;

  const programas = useMemo(() => {
    if (!dgActivaData) return [];
    const map = {};
    for (const o of dgActivaData.obras) {
      const programa = o.programa || "Sin programa";
      (map[programa] || (map[programa] = [])).push(o);
    }
    return Object.entries(map)
      .map(([programa, obrasProg]) => ({ programa, obras: obrasProg }))
      .sort((a, b) => b.obras.length - a.obras.length);
  }, [dgActivaData]);

  const programaActivoData = programas.find((p) => p.programa === programaActivo) || null;
  const moduloActivoData = MODULOS.find((m) => m.id === moduloActivo);

  const seleccionarDg = (dg) => { setDgActiva(dg); setProgramaActivo(null); setObraActiva(null); };
  const seleccionarPrograma = (programa) => { setProgramaActivo(programa); setObraActiva(null); };

  if (!esVistaEjecutiva(user?.rol)) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 flex items-center justify-center">
              <p className="text-sm font-medium" style={{ color: "var(--rojo)" }}>
                Acceso restringido — Solo Secretario, Administración y funcionarios de Dirección General.
              </p>
            </main>
            <Footer />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F5F2" }}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full space-y-4">

            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "#8C6B41" }}>Evidencia visual</p>
              <h1 className="text-2xl font-black" style={{ color: "var(--guinda)" }}>Galería</h1>
              <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                Fotos, videos y vuelos de dron organizados por Dirección General, Programa y Obra.
              </p>
            </div>

            <SelectorModulo activo={moduloActivo} onCambiar={setModuloActivo} />

            {!dgActiva ? (
              <>
                <Breadcrumb pasos={[{ label: "Direcciones Generales" }]} />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {dgAgregados.map((d) => (
                    <DGCard key={d.dg} dg={d.dg} total={d.total} onClick={() => seleccionarDg(d.dg)} />
                  ))}
                </div>
              </>
            ) : !programaActivo ? (
              <>
                <Breadcrumb
                  pasos={[
                    ...(dgFija ? [] : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }]),
                    { label: dgActiva },
                  ]}
                />
                <div className="space-y-2">
                  {programas.map((p) => (
                    <ProgramaRow key={p.programa} programa={p.programa} total={p.obras.length} onClick={() => seleccionarPrograma(p.programa)} />
                  ))}
                </div>
              </>
            ) : !obraActiva ? (
              <>
                <Breadcrumb
                  pasos={[
                    ...(dgFija ? [] : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }]),
                    { label: dgActiva, onClick: () => seleccionarPrograma(null) },
                    { label: programaActivo },
                  ]}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {programaActivoData?.obras.map((o, i) => (
                    <ObraTile key={o.uid || o.id_obra || o.id || i} obra={o} onClick={() => setObraActiva(o)} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <Breadcrumb
                  pasos={[
                    ...(dgFija ? [] : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }]),
                    { label: dgActiva, onClick: () => seleccionarPrograma(null) },
                    { label: programaActivo, onClick: () => setObraActiva(null) },
                    { label: obraActiva.nombre_obra || obraActiva.nombre },
                  ]}
                />
                <GaleriaObra obra={obraActiva} modulo={moduloActivoData} />
              </>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
