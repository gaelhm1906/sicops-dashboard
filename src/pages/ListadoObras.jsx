import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Input from "../components/Shared/Input";
import Button from "../components/Shared/Button";
import BandejaTareasObra from "../components/Seguimiento/BandejaTareasObra";
import ModalCaratulaContrato from "../components/Modal/ModalCaratulaContrato";
import ModalInformeSupervisionExterna from "../components/Modal/ModalInformeSupervisionExterna";
import { IconPlano } from "../components/Shared/IconosSOBSE";
import { useObras } from "../context/ObraContext";
import { useAuth } from "../context/AuthContext";
import { obrasNuevoAPI, getEstadoSistema, BASE_URL, getToken } from "../utils/api";
import { colorBarra, colorHexAvance, estadoLabel } from "../utils/formatters";
import { getPendientesUsuario, contarPorUrgencia, agruparPorPrograma } from "../utils/misPendientes";
import { getRegistrosObraCompleto, calcularIndicadorAvance, getObraKey } from "../utils/seguimiento";
import { esVistaEjecutiva } from "../utils/roles";
import { getVisitaObligadaPorRol } from "../data/seguimientoCatalogo";
import { sembrarEjemploInformeCompleto, sembrarSegundoEjemploInformeCompleto } from "../utils/demoInformeCompleto";

const ESTADOS = [
  { value: "",            label: "Todos los estados" },
  { value: "SIN INICIAR", label: "Sin iniciar" },
  { value: "EN PROCESO",  label: "En proceso" },
  { value: "TERMINADA",   label: "Terminada" },
  { value: "INAUGURADA",  label: "Inaugurada" },
  { value: "CANCELADO",   label: "Cancelada" },
];

const FILTROS_URGENCIA = [
  { value: "todos",     label: "Todos" },
  { value: "atrasado",  label: "Atrasados" },
  { value: "pendiente", label: "Pendientes" },
  { value: "cumplido",  label: "Cumplidos" },
];

function getObraReferenciaGeneral(obra) {
  return [obra.alcaldia || null, obra.colonia || null, obra.dg || obra.direccion_general || null]
    .filter(Boolean)
    .join(" • ");
}

function textoBusqueda(fila) {
  const { obra, requerimiento } = fila;
  return [
    obra.nombre_obra, obra.nombre, obra.programa, obra.clave_unica,
    requerimiento.nombre, requerimiento.categoria,
  ].filter(Boolean).join(" ").toLowerCase();
}

/* ══════════════════════════════════════════════════════════
   ProgramaCard — tarjeta de programa (nivel 1). Entrar a un programa
   muestra sus obras como lista; entrar a una obra abre su Bandeja
   completa (el detalle línea por línea vive ahí).
   ══════════════════════════════════════════════════════════ */
function ProgramaCard({ grupo, onClick }) {
  const { programa, obras, conteo, total } = grupo;
  const pct = total > 0 ? Math.round((conteo.cumplido / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card text-left px-4 py-3.5 transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(188,149,92,0.14)" }}>
          <IconPlano size={18} className="text-[var(--oro)]" />
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>

      <p className="text-sm font-bold leading-snug" style={{ color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {programa}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{obras.length} obras · {total} tareas</p>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {conteo.atrasado > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.10)", color: "var(--rojo)" }}>
            {conteo.atrasado} atrasadas
          </span>
        )}
        {conteo.pendiente > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(217,119,6,0.12)", color: "#92400e" }}>
            {conteo.pendiente} pendientes
          </span>
        )}
        {conteo.cumplido > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(0,99,65,0.10)", color: "var(--verde)" }}>
            {conteo.cumplido} cumplidas
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--ink-faint)" }}>
        <span>Cierre</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: "var(--guinda)" }} />
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   FilaObraPrograma — una obra dentro del programa seleccionado, en lista.
   ══════════════════════════════════════════════════════════ */
function FilaObraPrograma({ grupoObra, onAbrirAvance, onAbrirVisita, mostrarVisita }) {
  const { obra, tareas } = grupoObra;
  const conteo = { atrasado: 0, pendiente: 0, cumplido: 0 };
  for (const t of tareas) conteo[t.registro.estatus] = (conteo[t.registro.estatus] || 0) + 1;
  const peor = conteo.atrasado > 0 ? "var(--rojo)" : conteo.pendiente > 0 ? "var(--naranja)" : "var(--verde)";

  return (
    <div className="task-row card px-4 py-3" style={{ borderLeftColor: peor }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{obra.nombre_obra || obra.nombre}</p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {conteo.atrasado > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.10)", color: "var(--rojo)" }}>
              {conteo.atrasado} atrasada{conteo.atrasado === 1 ? "" : "s"}
            </span>
          )}
          {conteo.pendiente > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(217,119,6,0.12)", color: "#92400e" }}>
              {conteo.pendiente} pendiente{conteo.pendiente === 1 ? "" : "s"}
            </span>
          )}
          {conteo.cumplido > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(0,99,65,0.10)", color: "var(--verde)" }}>
              {conteo.cumplido} cumplida{conteo.cumplido === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          onClick={() => onAbrirAvance(obra)}
          className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
          style={{ backgroundColor: "var(--guinda)" }}
        >
          📋 Reportar avance
        </button>
        {mostrarVisita && (
          <button
            type="button"
            onClick={() => onAbrirVisita(obra)}
            className="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            📍 Registrar visita
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FilaObraDirectorio — fila compacta de obra (vista admin, sin acordeones)
   ══════════════════════════════════════════════════════════ */
function FilaObraDirectorio({ obra, onAbrirBandeja, onAbrirCaratula, onAbrirInforme, onGenerarEjemplo, onGenerarEjemplo2 }) {
  const obraKey = useMemo(() => getObraKey(obra), [obra]);
  const indicador = useMemo(
    () => calcularIndicadorAvance(getRegistrosObraCompleto(obraKey)),
    [obraKey]
  );
  const info = estadoLabel(obra.estatus || obra.estado);
  const referencia = getObraReferenciaGeneral(obra);

  return (
    <div className="card px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`badge ${info.clase} text-xs font-semibold`}>{info.icono} {info.label}</span>
          {obra.clave_unica && (
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: "var(--surface-2)", color: "#5C4F3A", border: "1px solid var(--border)" }}
            >
              {obra.clave_unica}
            </span>
          )}
        </div>
        <span className="text-sm font-bold shrink-0" style={{ color: colorHexAvance(indicador) }}>{indicador}%</span>
      </div>

      <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--ink)" }}>
        {obra.nombre_obra || obra.nombre || "SIN NOMBRE"}
      </p>
      {referencia && <p className="mt-0.5 text-xs truncate" style={{ color: "#8C6B41" }}>{referencia}</p>}

      <div className="mt-2 rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
        <div className={`h-1.5 rounded-full ${colorBarra(indicador)} transition-all duration-500`} style={{ width: `${indicador}%` }} />
      </div>

      <div className="mt-3 pt-2.5 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <Button size="sm" onClick={() => onAbrirBandeja(obra)}>📋 Seguimiento</Button>
        <Button variant="secondary" size="sm" onClick={() => onAbrirCaratula(obra)}>📄 Carátula</Button>
        <Button variant="secondary" size="sm" onClick={() => onAbrirInforme(obra)}>📊 Informe Sup. Externa</Button>
        {onGenerarEjemplo && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onGenerarEjemplo(obra)}
            style={{ borderStyle: "dashed", borderColor: "var(--guinda)", color: "var(--guinda)" }}
          >
            ⚡ Generar ejemplo
          </Button>
        )}
        {onGenerarEjemplo2 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onGenerarEjemplo2(obra)}
            style={{ borderStyle: "dashed", borderColor: "var(--oro)", color: "#8C6B41" }}
          >
            ⚡ Generar ejemplo 2
          </Button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ListadoObras — "Mis pendientes" (rol) / "Directorio de obras" (admin)
   ══════════════════════════════════════════════════════════ */
export default function ListadoObras() {
  const {
    obrasFiltradas,
    obrasRaw,
    loading,
    busqueda, setBusqueda,
    filtroProg, setFiltroProg,
    filtroEst, setFiltroEst,
    updateObraLocal,
  } = useObras();
  const { user } = useAuth();
  const isAdmin = esVistaEjecutiva(user?.rol);
  const rol = user?.rol || "";
  const location = useLocation();
  const navigate = useNavigate();

  const [obraModal, setObraModal] = useState(null);
  const [modoModal, setModoModal] = useState("avance");
  const [obraCaratula, setObraCaratula] = useState(null);
  const [obraInforme, setObraInforme] = useState(null);
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [buscarTarea, setBuscarTarea] = useState("");
  const [programaActivo, setProgramaActivo] = useState(null);
  const [sistemaCerrado, setSistemaCerrado] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const syncEstado = () => {
      getEstadoSistema()
        .then((abierto) => setSistemaCerrado(!abierto))
        .catch(() => setSistemaCerrado(false));
    };
    syncEstado();
    window.addEventListener("sicops-system-updated", syncEstado);
    return () => window.removeEventListener("sicops-system-updated", syncEstado);
  }, []);

  const programas = useMemo(() => (
    [...new Set(obrasFiltradas.map((o) => o.programa).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [obrasFiltradas]);

  const descargarExcel = useCallback(async (programa) => {
    setDescargando(programa);
    try {
      const res = await fetch(
        `${BASE_URL}/api/auditoria/export?programa=${encodeURIComponent(programa)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria_${programa.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar Excel:", err);
    } finally {
      setDescargando(null);
    }
  }, []);

  const abrirModal    = useCallback((obra, modo = "avance") => { setObraModal(obra); setModoModal(modo); }, []);
  const cerrarModal   = useCallback(() => { setObraModal(null); setVersion((v) => v + 1); }, []);
  const abrirCaratula = useCallback((obra) => setObraCaratula(obra), []);
  const cerrarCaratula= useCallback(() => setObraCaratula(null), []);
  const abrirInforme  = useCallback((obra) => setObraInforme(obra), []);
  const cerrarInforme = useCallback(() => setObraInforme(null), []);

  /* Prepara en un clic todo lo que necesita el Informe de esta obra para
     bajar PDF/Excel con datos completos (demo rápida, sin captura
     manual) y lo abre de una vez para ver el resultado. */
  const generarEjemploInforme = useCallback((obra) => {
    sembrarEjemploInformeCompleto(obra, user?.email);
    setVersion((v) => v + 1);
    setObraInforme(obra);
  }, [user?.email]);

  /* Segundo caso de ejemplo (contrato distinto, ver
     utils/demoInformeCompleto.js) — para tener dos ejemplos completos y
     no solo uno al preparar una demo. */
  const generarEjemploInforme2 = useCallback((obra) => {
    sembrarSegundoEjemploInformeCompleto(obra, user?.email);
    setVersion((v) => v + 1);
    setObraInforme(obra);
  }, [user?.email]);

  /* ── Destino de la barra de comandos (⌘K) — abrir una obra, entrar a un
     programa o prefiltrar por un requerimiento sin recorrer el árbol de
     menús. Se limpia el state de navegación para no repetirse al volver. ── */
  useEffect(() => {
    const state = location.state;
    if (!state) return;
    if (state.obraKey) {
      const obra = (obrasRaw || []).find((o) => getObraKey(o) === state.obraKey);
      if (obra) abrirModal(obra, state.modo || "avance");
    }
    if (state.programaActivo) {
      setProgramaActivo(state.programaActivo);
      if (isAdmin) setFiltroProg(state.programaActivo);
    }
    if (state.buscarTarea) {
      setBuscarTarea(state.buscarTarea);
    }
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr cuando llega un state nuevo desde la barra de comandos
  }, [location.state]);

  const updateObraInline = useCallback(async (obra, nuevoAvance, options = {}) => {
    try {
      const data = await obrasNuevoAPI.updateAvance(
        obra.id_obra || obra.id,
        nuevoAvance,
        user?.email || "sistema",
        { tabla: obra.tabla, nombre_obra: obra.nombre, ...options }
      );
      if (!data.success) throw new Error(data.message || "Error al actualizar");

      const timestamp = new Date().toISOString();
      updateObraLocal({
        uid: obra.uid,
        id: obra.id_obra || obra.id,
        id_obra: obra.id_obra || obra.id,
        avance: data.avance_nuevo,
        avance_real: data.avance_nuevo,
        porcentaje: data.avance_nuevo,
        porcentaje_avance: data.avance_nuevo,
        estatus: data.estatus,
        estado: data.estatus,
        color: data.color,
        ultimaActualizacion: timestamp,
        fecha_actualizacion: timestamp,
        usuario_actualizacion: user?.email || "sistema",
        fecha_inauguracion: data.fecha_inauguracion || obra.fecha_inauguracion || null,
        motivo_cancelacion: data.motivo_cancelacion || obra.motivo_cancelacion || null,
      });
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error?.data?.message || error?.data?.detail || error?.message || "No fue posible completar la acción.",
      };
    }
  }, [updateObraLocal, user?.email]);

  /* ── "Mis pendientes" — solo no-admin ── */
  const pendientes = useMemo(
    () => (isAdmin ? [] : getPendientesUsuario(obrasFiltradas, rol)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer localStorage tras guardar una captura
    [isAdmin, obrasFiltradas, rol, version]
  );
  const conteoUrgencia = useMemo(() => contarPorUrgencia(pendientes), [pendientes]);
  const pendientesFiltrados = useMemo(() => {
    let lista = filtroUrgencia === "todos" ? pendientes : pendientes.filter((f) => f.registro.estatus === filtroUrgencia);
    if (buscarTarea.trim()) {
      const q = buscarTarea.toLowerCase();
      lista = lista.filter((f) => textoBusqueda(f).includes(q));
    }
    return lista;
  }, [pendientes, filtroUrgencia, buscarTarea]);

  const gruposPrograma = useMemo(() => agruparPorPrograma(pendientesFiltrados), [pendientesFiltrados]);
  const visitaObligada = useMemo(() => getVisitaObligadaPorRol(rol), [rol]);
  const mostrarVisita = !!(visitaObligada && visitaObligada.visitasPorDia > 0);
  const grupoActivo = useMemo(
    () => gruposPrograma.find((g) => g.programa === programaActivo) || null,
    [gruposPrograma, programaActivo]
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #F8F5F2 0%, #ECE9E2 100%)" }}>

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-4xl mx-auto w-full">

          {sistemaCerrado && (
            <div className="mb-3 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "#691C32", color: "#FFFFFF" }}>
              Sistema cerrado — Las actualizaciones están deshabilitadas temporalmente.
            </div>
          )}

          {/* ── Header de página ── */}
          <div className="mb-4">
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: "linear-gradient(135deg, #F7F3EE 0%, #EFE7DD 100%)", border: "1px solid rgba(201,166,107,0.25)" }}
            >
              <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "#8C6B41" }}>
                {isAdmin ? "Directorio · Todas las obras" : "Bandeja diaria · Qué te toca hacer"}
              </p>
              <h1 className="mt-1 text-2xl lg:text-3xl font-bold" style={{ color: "#691C32" }}>
                {isAdmin ? "Directorio de Obras" : "Mis Pendientes"}
              </h1>
              {isAdmin ? (
                <p className="mt-0.5 text-xs" style={{ color: "#666666" }}>
                  {obrasFiltradas.length} obras
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}>
                    {conteoUrgencia.atrasado} atrasados
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#fffbeb", color: "#d97706" }}>
                    {conteoUrgencia.pendiente} pendientes
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#ecfdf5", color: "#16a34a" }}>
                    {conteoUrgencia.cumplido} cumplidos
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Filtros ── */}
          <div className="card px-4 py-3 mb-4">
            {isAdmin ? (
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    id="busqueda-obras"
                    placeholder="Buscar por nombre, clave, colonia..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    aria-label="Buscar obras"
                  />
                </div>
                <select
                  value={filtroProg}
                  onChange={(e) => setFiltroProg(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32]"
                  style={{ border: "1px solid rgba(201,166,107,0.34)", color: "#2C2C2C" }}
                  aria-label="Filtrar por programa"
                >
                  <option value="">Todos los programas</option>
                  {programas.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filtroEst}
                  onChange={(e) => setFiltroEst(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32]"
                  style={{ border: "1px solid rgba(201,166,107,0.34)", color: "#2C2C2C" }}
                  aria-label="Filtrar por estado"
                >
                  {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                {filtroProg && (
                  <Button variant="secondary" size="md" onClick={() => descargarExcel(filtroProg)} disabled={descargando === filtroProg}>
                    {descargando === filtroProg ? "Descargando..." : "⬇ Excel"}
                  </Button>
                )}
                {(busqueda || filtroProg || filtroEst) && (
                  <Button variant="ghost" size="md" onClick={() => { setBusqueda(""); setFiltroProg(""); setFiltroEst(""); }}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <Input
                  id="busqueda-tareas"
                  placeholder="Buscar por obra, programa o requerimiento..."
                  value={buscarTarea}
                  onChange={(e) => setBuscarTarea(e.target.value)}
                  aria-label="Buscar en mis pendientes"
                />
                <div className="flex flex-wrap gap-2">
                  {FILTROS_URGENCIA.map((f) => {
                    const activo = filtroUrgencia === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFiltroUrgencia(f.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.96]"
                        style={
                          activo
                            ? { backgroundColor: "#691C32", color: "#fff" }
                            : { backgroundColor: "#F8F5F2", color: "#8C6B41", border: "1px solid rgba(201,166,107,0.28)" }
                        }
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Contenido ── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
            </div>
          ) : isAdmin ? (
            obrasFiltradas.length === 0 ? (
              <div className="card bg-blueprint text-center py-14 text-sm" style={{ color: "var(--ink-faint)" }}>
                No se encontraron obras con los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-2">
                {obrasFiltradas.map((obra, i) => (
                  <FilaObraDirectorio
                    key={obra.uid || obra.id_obra || obra.id || i}
                    obra={obra}
                    onAbrirBandeja={abrirModal}
                    onAbrirCaratula={abrirCaratula}
                    onAbrirInforme={abrirInforme}
                    onGenerarEjemplo={generarEjemploInforme}
                    onGenerarEjemplo2={generarEjemploInforme2}
                  />
                ))}
              </div>
            )
          ) : pendientesFiltrados.length === 0 ? (
            <div className="card bg-blueprint text-center py-14 text-sm" style={{ color: "var(--ink-faint)" }}>
              {pendientes.length === 0
                ? "No tienes requerimientos de seguimiento asignados."
                : "No hay tareas con este filtro."}
            </div>
          ) : grupoActivo ? (
            <div>
              <button
                type="button"
                onClick={() => setProgramaActivo(null)}
                className="flex items-center gap-1.5 mb-3 text-xs font-bold transition-colors hover:opacity-70"
                style={{ color: "var(--guinda)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                Volver a programas
              </button>
              <p className="text-sm font-bold mb-2" style={{ color: "var(--ink)" }}>{grupoActivo.programa}</p>
              <div className="space-y-2">
                {grupoActivo.obras.map((grupoObra) => (
                  <FilaObraPrograma
                    key={grupoObra.obraKey}
                    grupoObra={grupoObra}
                    mostrarVisita={mostrarVisita}
                    onAbrirAvance={(obra) => abrirModal(obra, "avance")}
                    onAbrirVisita={(obra) => abrirModal(obra, "visita")}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gruposPrograma.map((grupo) => (
                <ProgramaCard
                  key={grupo.programa}
                  grupo={grupo}
                  onClick={() => setProgramaActivo(grupo.programa)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />

      {obraModal && (
        <BandejaTareasObra
          obra={obraModal}
          modoInicial={modoModal}
          onClose={cerrarModal}
          sistemaCerrado={sistemaCerrado}
          updateObraInline={updateObraInline}
          onAbrirCaratula={abrirCaratula}
          onAbrirInforme={abrirInforme}
        />
      )}

      {obraCaratula && (
        <ModalCaratulaContrato obra={obraCaratula} onClose={cerrarCaratula} />
      )}

      {obraInforme && (
        <ModalInformeSupervisionExterna obra={obraInforme} onClose={cerrarInforme} />
      )}
    </div>
  );
}
