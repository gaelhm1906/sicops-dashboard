import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useObras } from "../context/ObraContext";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import NaturalezaGlyph from "../components/Shared/NaturalezaGlyph";
import RingProgress from "../components/Shared/RingProgress";
import AnimatedNumber from "../components/Shared/AnimatedNumber";
import { getEstadoSistema } from "../utils/api";
import ModalAvisoOperativo, { AVISO_REPETIR_KEY } from "../components/Modal/ModalAvisoOperativo";
import NavegadorEjecutivo from "../components/Ejecutivo/NavegadorEjecutivo";
import {
  getObraKey,
  getRegistrosObraCompleto,
  calcularIndicadorAvance,
  getCumplimientoPorCategoria,
  getVisitasHoyPorRolGlobal,
  actualizarRegistro,
  ESTATUS_REGISTRO,
} from "../utils/seguimiento";
import {
  getPendientesUsuario,
  contarIndicadoresHome,
  getActividadReciente,
  agruparPorRequerimiento,
} from "../utils/misPendientes";
import { NATURALEZA } from "../utils/naturaleza";
import { getVisitaObligadaPorRol, REQUERIMIENTOS } from "../data/seguimientoCatalogo";
import { formatearHora } from "../utils/formatters";
import { esVistaEjecutiva, dgFijaPara } from "../utils/roles";
import { resumenPendientesPorObra, sembrarObservacionesDemo } from "../utils/evaluaciones";

const MAX_COLA = 8;

/* ── DEMO TEMPORAL — no es información oficial ──────────────────────────
   DGPEST no tiene ninguna obra EN PROCESO/SIN INICIAR real (sus 45 obras
   ya están inauguradas/terminadas), así que desaparece del panorama de
   Revisión Integral. A pedido explícito, se agrega con datos sintéticos
   "cumple con todo" solo para que la demostración muestre las 5 DG
   completas. Vive únicamente en el Home del secretario — no aparece en
   Directorio de Obras, Mis Pendientes ni ningún otro listado real, y se
   identifica con claves DEMO-DGPEST-xx para no confundirse con datos
   reales. Quitar en cuanto DGPEST tenga obra activa real o se decida que
   ya no hace falta. */
const OBRAS_DEMO_DGPEST = Array.from({ length: 10 }, (_, i) => ({
  clave_unica: `DEMO-DGPEST-${String(i + 1).padStart(2, "0")}`,
  nombre_obra: `Obra de ejemplo DGPEST ${i + 1}`,
  dg: "DGPEST",
  direccion_general: "DGPEST",
  programa: "Programa de ejemplo",
  estatus: "EN PROCESO",
  anio: "2026",
}));

function sembrarDemoDGPEST() {
  const FLAG = "demo_dgpest_seeded_v1";
  if (localStorage.getItem(FLAG)) return;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const obra of OBRAS_DEMO_DGPEST) {
    const key = getObraKey(obra);
    for (const req of REQUERIMIENTOS) {
      actualizarRegistro(key, req.id, { estatus: ESTATUS_REGISTRO.CUMPLIDO, fechaReal: hoy });
    }
  }
  localStorage.setItem(FLAG, "1");
}

function saludoPorHora(hora) {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/* Voz de Ajox — Design System v2: máximo dos líneas, siempre atada a un
   dato real, nunca una frase motivacional genérica. */
function mensajeAjox({ atrasadas, pendientes, porVencer }, visitaObligada, visitasHoy) {
  if (atrasadas > 0) {
    return `Tienes ${atrasadas} actividad${atrasadas === 1 ? "" : "es"} atrasada${atrasadas === 1 ? "" : "s"} que requiere${atrasadas === 1 ? "" : "n"} atención.`;
  }
  if (visitaObligada && visitaObligada.visitasPorDia > 0 && visitasHoy.length < visitaObligada.visitasPorDia) {
    const faltan = visitaObligada.visitasPorDia - visitasHoy.length;
    return `Te falta${faltan === 1 ? "" : "n"} ${faltan} visita${faltan === 1 ? "" : "s"} por registrar hoy.`;
  }
  const total = pendientes + porVencer;
  if (total === 0) return "Excelente. Toda tu operación está al día.";
  return `Hoy tienes ${total} actividad${total === 1 ? "" : "es"} por resolver.`;
}

/* Voz de Ajox para ADMIN/SECRETARIO — misma regla: nunca genérica, atada
   al dato duro de cuántas Direcciones Generales están por debajo del
   objetivo de cumplimiento (mismo umbral que usa NavegadorEjecutivo). */
function mensajeAjoxAdmin(direcciones) {
  if (direcciones === 0) return "Todas las direcciones van al día con los cronogramas institucionales.";
  return `${direcciones} dirección${direcciones === 1 ? "" : "es"} necesita${direcciones === 1 ? "" : "n"} tu atención hoy para asegurar el cumplimiento de los cronogramas institucionales.`;
}

/* Voz de Ajox para un Director General fijo a UNA dirección — nunca
   habla de "direcciones" en plural (solo tiene la suya). Prioriza lo
   más accionable: observaciones del Secretario sin atender. (La fuerza
   de trabajo ya no es algo que el DG "valide" — la captura él mismo,
   ver reversión del ajuste #8.) */
function mensajeAjoxDirectorGeneral({ observacionesPendientes, obrasCriticas }) {
  if (observacionesPendientes > 0) {
    return `Tienes ${observacionesPendientes} observación${observacionesPendientes === 1 ? "" : "es"} del Secretario sin atender.`;
  }
  if (obrasCriticas > 0) return `${obrasCriticas} obra${obrasCriticas === 1 ? "" : "s"} de tu Dirección General en avance crítico.`;
  return "Tu Dirección General va al día con los cronogramas institucionales.";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obras, obrasRaw, loading } = useObras();

  const [ahora, setAhora] = useState(new Date());
  const [sistemaAbierto, setSistemaAbierto] = useState(true);
  const [mostrarAviso, setMostrarAviso] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const syncEstado = () => {
      getEstadoSistema()
        .then((abierto) => {
          setSistemaAbierto(abierto);
          if (abierto && !sessionStorage.getItem(AVISO_REPETIR_KEY)) {
            setMostrarAviso(true);
          }
        })
        .catch(() => setSistemaAbierto(true));
    };
    syncEstado();
    window.addEventListener("sicops-system-updated", syncEstado);
    return () => window.removeEventListener("sicops-system-updated", syncEstado);
  }, []);

  const base = obrasRaw || obras;
  const rol = user?.rol || "";
  const esAdmin = esVistaEjecutiva(rol);

  useEffect(() => {
    if (esAdmin) sembrarDemoDGPEST();
  }, [esAdmin]);

  /* Observaciones de ejemplo — se siembran una sola vez por navegador,
     sin importar qué rol entre primero, para que cualquier cuenta tenga
     algo que ver en su Bandeja de entrada (/notificaciones). */
  useEffect(() => {
    if (base.length > 0) sembrarObservacionesDemo(base);
  }, [base]);

  /* Solo para el panorama del secretario (hero + Revisión Integral) — el
     resto de la app (Directorio de Obras, Mis Pendientes, etc.) sigue
     viendo únicamente las obras reales. */
  const baseAdmin = useMemo(() => (esAdmin ? [...base, ...OBRAS_DEMO_DGPEST] : base), [esAdmin, base]);

  /* Un Director General está fijo a UNA Dirección General (dgFijaPara
     regresa null solo para ADMIN/SECRETARIO, que sí ven todas) — el
     hero y sus estadísticas deben calcularse SOLO sobre las obras de esa
     DG, nunca sobre el total institucional. */
  const dgFija = dgFijaPara(user);
  const baseEjecutiva = useMemo(() => {
    if (!dgFija) return baseAdmin;
    return baseAdmin.filter((o) => (o.dg || o.direccion_general || "").trim() === dgFija);
  }, [baseAdmin, dgFija]);

  const obraKeysAll = useMemo(() => base.map(getObraKey), [base]);
  const obraPorKey = useMemo(() => {
    const map = {};
    for (const o of base) map[getObraKey(o)] = o;
    return map;
  }, [base]);

  /* ── Cola de operación — solo no-admin ── */
  const pendientes = useMemo(
    () => (esAdmin ? [] : getPendientesUsuario(base, rol)),
    [esAdmin, base, rol]
  );
  const indicadores = useMemo(() => contarIndicadoresHome(pendientes), [pendientes]);
  const pctDia = pendientes.length > 0 ? Math.round((indicadores.completadas / pendientes.length) * 100) : 100;
  const operacionCompleta = pendientes.length > 0 && indicadores.completadas === pendientes.length;

  const visitaObligada = useMemo(() => getVisitaObligadaPorRol(rol), [rol]);
  const visitasHoy = useMemo(() => (esAdmin ? [] : getVisitasHoyPorRolGlobal(rol)), [esAdmin, rol]);
  const visitasFaltantes = visitaObligada ? Math.max(0, visitaObligada.visitasPorDia - visitasHoy.length) : 0;

  /* ── Métricas del hero para ADMIN/SECRETARIO — mismo tratamiento visual
     que el de un funcionario, pero con el % global de todas las obras en
     vez de un conteo de tipos de tarea (el admin no "tiene" tareas propias). */
  const indicadoresPorObra = useMemo(
    () => (esAdmin ? baseEjecutiva.map((o) => calcularIndicadorAvance(getRegistrosObraCompleto(getObraKey(o)))) : []),
    [esAdmin, baseEjecutiva]
  );
  const globalPctAdmin = indicadoresPorObra.length > 0
    ? Math.round(indicadoresPorObra.reduce((a, b) => a + b, 0) / indicadoresPorObra.length)
    : 100;
  const obrasCriticasAdmin = indicadoresPorObra.filter((pct) => pct < 50).length;

  /* Cuántas Direcciones Generales están por debajo del objetivo (80%,
     mismo umbral "UMBRAL_OK" que usa NavegadorEjecutivo para el semáforo).
     Solo aplica a ADMIN/SECRETARIO — un Director General ya está fijo a
     la suya, "direcciones" en plural no le dice nada. */
  const direccionesEnAtencion = useMemo(() => {
    if (!esAdmin || dgFija) return 0;
    const porDG = {};
    for (const o of baseEjecutiva) {
      const dg = (o.dg || o.direccion_general || "SIN DIRECCION").trim();
      const pct = calcularIndicadorAvance(getRegistrosObraCompleto(getObraKey(o)));
      (porDG[dg] || (porDG[dg] = [])).push(pct);
    }
    return Object.values(porDG).filter((pcts) => pcts.reduce((a, b) => a + b, 0) / pcts.length < 80).length;
  }, [esAdmin, dgFija, baseEjecutiva]);

  /* Ajuste de minuta (sesión de revisión #13) + observación del área
     usuaria: el Director General debe ver, consolidado en una sola
     frase (no una lista), cuántas observaciones del Secretario le
     faltan por atender en su DG. */
  const observacionesPendientesDG = useMemo(() => {
    if (!esAdmin || !dgFija) return 0;
    const entrada = resumenPendientesPorObra().find((d) => d.dg === dgFija);
    return entrada?.total || 0;
  }, [esAdmin, dgFija]);

  /* ── Cola agrupada por TIPO de requerimiento, no por obra (Design
     System v2 revisado): un rol con 2-3 requerimientos asignados puede
     tener decenas de filas si le tocan en muchas obras — lo que importa
     de un vistazo es cuántos TIPOS de tarea tiene y qué tan avanzado va
     en cada uno, no cada combinación individual. ── */
  const gruposRequerimiento = useMemo(() => agruparPorRequerimiento(pendientes), [pendientes]);

  /* Contador de tipos de tarea (no de filas individuales) para el anillo
     del hero — este usuario "tiene 3 actividades" (2 requerimientos +
     visitas), no "52 tareas", aunque le toquen en 26 obras cada una. */
  const tieneVisitaObligada = !!(visitaObligada && visitaObligada.visitasPorDia > 0);
  const totalTiposHoy = gruposRequerimiento.length + (tieneVisitaObligada ? 1 : 0);
  const tiposCompletados =
    gruposRequerimiento.filter((g) => g.estadoAgregado === "cumplido").length +
    (tieneVisitaObligada && visitasFaltantes <= 0 ? 1 : 0);
  const tiposSinIniciar = gruposRequerimiento.filter((g) => g.estadoAgregado === "atrasado").length;
  const pctAnillo = totalTiposHoy > 0 ? Math.round((tiposCompletados / totalTiposHoy) * 100) : 100;

  const filasCola = useMemo(() => {
    if (visitasFaltantes <= 0) return gruposRequerimiento;
    const filaVisita = {
      sintetico: true,
      key: "visita-hoy",
      label: "Visitas pendientes hoy",
      sub: `${visitasHoy.length} de ${visitaObligada.visitasPorDia} registradas`,
    };
    return [filaVisita, ...gruposRequerimiento];
  }, [gruposRequerimiento, visitasFaltantes, visitasHoy.length, visitaObligada]);

  const totalEnCola = filasCola.length;

  /* La sección solo muestra un vistazo (MAX_COLA) — el resto vive en "Mis Pendientes" */
  const filasVisibles = useMemo(() => filasCola.slice(0, MAX_COLA), [filasCola]);

  const cumplimientoPorCategoria = useMemo(
    () => (esAdmin ? [] : getCumplimientoPorCategoria(obraKeysAll, rol)),
    [esAdmin, obraKeysAll, rol]
  );

  const cumplimientoPromedio = useMemo(() => {
    if (cumplimientoPorCategoria.length === 0) return pctDia;
    const suma = cumplimientoPorCategoria.reduce((acc, c) => acc + c.pct, 0);
    return Math.round(suma / cumplimientoPorCategoria.length);
  }, [cumplimientoPorCategoria, pctDia]);

  const actividadReciente = useMemo(
    () => getActividadReciente(pendientes, visitasHoy, obraPorKey),
    [pendientes, visitasHoy, obraPorKey]
  );

  const handleIrAJornada = useCallback(() => navigate("/obras"), [navigate]);
  const handleIrAVisitas = useCallback(() => navigate("/visitas"), [navigate]);
  const handleIrATarea = useCallback(
    (nombreRequerimiento) => navigate("/obras", { state: { buscarTarea: nombreRequerimiento } }),
    [navigate]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F5F2" }}>
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#691C32", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#666666" }}>Cargando centro operativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>

      <div className="flex flex-1">
        <Sidebar />

        {/* Envuelve main + Footer en su propia columna: el Sidebar es
            position:fixed y cubre toda la altura de la ventana, así que el
            Footer necesita vivir en el mismo flujo horizontal que reserva
            su ancho — si no, queda tapado al hacer scroll hasta el fondo. */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full space-y-4">

          {esAdmin ? (
            <>
              {/* ── Mismo hero que un funcionario: anillo + saludo + mascota
                   grande, solo que el dato es el % global de todas las obras
                   (el admin no tiene "tareas propias" que contar). ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 card-hero px-6 py-5 flex items-center gap-4 relative overflow-hidden">
                  <RingProgress size={76} pct={globalPctAdmin}>
                    <div className="rounded-full flex items-center justify-center" style={{ width: 62, height: 62, backgroundColor: "var(--guinda)" }}>
                      <span className="text-lg font-black text-white">
                        <AnimatedNumber value={globalPctAdmin} suffix="%" />
                      </span>
                    </div>
                  </RingProgress>
                  <div className="min-w-0 flex-1 relative z-10">
                    <p className="text-[11px] uppercase tracking-widest font-black text-white/70">
                      {dgFija ? `Revisión Integral — ${dgFija}` : "Revisión Integral de la Ejecución de Obra"}
                    </p>
                    <h1 className="mt-0.5 text-lg font-black text-white truncate">
                      {saludoPorHora(ahora.getHours())}{user?.nombre ? `, ${user.nombre}` : ""}
                    </h1>
                    <p className="mt-1 text-xs text-white/75">
                      {baseEjecutiva.length} obras · {obrasCriticasAdmin} en avance crítico
                    </p>
                  </div>
                  <img
                    src="/web/assets/img/saludo.png"
                    alt=""
                    className="hidden sm:block absolute right-0 bottom-0 h-full w-auto object-contain pointer-events-none"
                    style={{ maxWidth: "48%" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4">
                  <div className="card px-5 py-5 flex-1 flex flex-col gap-3 relative">
                    <span
                      className="hidden lg:block absolute -left-2 top-6 w-4 h-4 rotate-45"
                      style={{ backgroundColor: "var(--surface)" }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold leading-relaxed relative" style={{ color: "var(--ink)" }}>
                      {dgFija
                        ? mensajeAjoxDirectorGeneral({
                            observacionesPendientes: observacionesPendientesDG,
                            obrasCriticas: obrasCriticasAdmin,
                          })
                        : mensajeAjoxAdmin(direccionesEnAtencion)}
                    </p>
                    <button
                      type="button"
                      onClick={handleIrAJornada}
                      className="mt-auto w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                      style={{ backgroundColor: "var(--guinda)" }}
                    >
                      Directorio de Obras
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--oro)" }}>Obras activas</p>
                      <p className="text-xl font-black mt-1" style={{ color: "var(--guinda)" }}>
                        <AnimatedNumber value={baseEjecutiva.length} />
                      </p>
                    </div>
                    <div className="card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--oro)" }}>Cumplimiento</p>
                      <p className="text-xl font-black mt-1" style={{ color: "var(--guinda)" }}>
                        <AnimatedNumber value={globalPctAdmin} suffix="%" />
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <NavegadorEjecutivo base={baseAdmin} mascotSrc="/web/assets/img/saludo.png" dgFija={dgFija} />
            </>
          ) : (
            <>
              {/* ── Mi Operación de Hoy + Ajox — el hero comparte protagonismo
                   con el asistente en vez de apilarlo como una tira aparte ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 card-hero px-6 py-5 flex items-center gap-4 relative overflow-hidden">
                  <RingProgress size={76} pct={pctAnillo}>
                    <div className="rounded-full flex items-center justify-center" style={{ width: 62, height: 62, backgroundColor: "var(--guinda)" }}>
                      <span className="text-lg font-black text-white">
                        <AnimatedNumber value={tiposCompletados} />/{totalTiposHoy}
                      </span>
                    </div>
                  </RingProgress>
                  <div className="min-w-0 flex-1 relative z-10">
                    <p className="text-[11px] uppercase tracking-widest font-black text-white/70">Mi operación de hoy</p>
                    <h1 className="mt-0.5 text-lg font-black text-white truncate">
                      {saludoPorHora(ahora.getHours())}{user?.nombre ? `, ${user.nombre}` : ""}
                    </h1>
                    <p className="mt-1 text-xs text-white/75">
                      {tiposCompletados} de {totalTiposHoy} completadas
                      {tiposSinIniciar > 0 && ` · ${tiposSinIniciar} sin iniciar`}
                    </p>
                  </div>
                  {/* Mascota — llena la altura completa de la tarjeta, anclada
                      a la derecha; decorativa (no compite por espacio en el
                      flex ni bloquea clics en el resto del hero). */}
                  <img
                    src="/web/assets/img/saludo.png"
                    alt=""
                    className="hidden sm:block absolute right-0 bottom-0 h-full w-auto object-contain pointer-events-none"
                    style={{ maxWidth: "48%" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4">
                  {/* Ajox — la tarjeta ES el globo de cómic completo de la
                      mascota (que ahora vive grande en el hero), no una
                      versión miniatura con su propio avatar repetido. */}
                  <div className="card px-5 py-5 flex-1 flex flex-col gap-3 relative">
                    <span
                      className="hidden lg:block absolute -left-2 top-6 w-4 h-4 rotate-45"
                      style={{ backgroundColor: "var(--surface)" }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold leading-relaxed relative" style={{ color: "var(--ink)" }}>
                      {mensajeAjox(indicadores, visitaObligada, visitasHoy)}
                    </p>
                    {indicadores.atrasadas > 0 && (
                      <button
                        type="button"
                        onClick={handleIrAJornada}
                        className="mt-auto w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                        style={{ backgroundColor: "var(--guinda)" }}
                      >
                        Atender prioridades
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--oro)" }}>Obras activas</p>
                      <p className="text-xl font-black mt-1" style={{ color: "var(--guinda)" }}>
                        <AnimatedNumber value={base.length} />
                      </p>
                    </div>
                    <div className="card px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--oro)" }}>Cumplimiento</p>
                      <p className="text-xl font-black mt-1" style={{ color: "var(--guinda)" }}>
                        <AnimatedNumber value={cumplimientoPromedio} suffix="%" />
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {sistemaAbierto === false && (
                <div className="rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--guinda), var(--guinda-dark))" }}>
                  🔒 Sistema cerrado — las capturas se reanudan en el próximo horario operativo.
                </div>
              )}

              {/* ── Cola unificada por naturaleza — el corazón de la pantalla ── */}
              {operacionCompleta || totalEnCola === 0 ? (
                <div className="card bg-blueprint text-center py-12 px-6">
                  <div className="w-14 h-14 rounded-full mx-auto mb-3" style={{ background: "linear-gradient(135deg, var(--oro-light), var(--oro))", border: "3px solid var(--surface)", boxShadow: "0 0 0 1px var(--border)" }} />
                  <p className="text-sm font-black" style={{ color: "var(--ink)" }}>
                    {totalEnCola === 0 ? "No tienes actividades asignadas hoy." : "Terminaste tu operación de hoy."}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                    {totalEnCola === 0 ? "Vuelve más tarde por si aparece algo nuevo." : "Buen trabajo — descansa."}
                  </p>
                </div>
              ) : (
                <section className="card overflow-hidden">
                  <div className="px-5 pt-3 pb-1.5" style={{ backgroundColor: "var(--surface-2)" }}>
                    <p className="text-[10px] uppercase tracking-widest font-black" style={{ color: "#8C6B41" }}>
                      Actividades de hoy · {totalEnCola}
                    </p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                    {filasVisibles.map((fila, filaIndex) => {
                      const retraso = { animationDelay: `${Math.min(filaIndex, 12) * 25}ms` };
                      if (fila.sintetico) {
                        return (
                          <button
                            key={fila.key}
                            type="button"
                            onClick={handleIrAVisitas}
                            className="task-row animate-row-in w-full flex items-center gap-3 px-5 py-3 text-left active:scale-[0.99]"
                            style={{ borderLeftColor: "var(--naranja)", ...retraso }}
                          >
                            <NaturalezaGlyph naturaleza={NATURALEZA.VISITA} estatus="por_vencer" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{fila.label}</p>
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-soft)" }}>{fila.sub}</p>
                            </div>
                            <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </button>
                        );
                      }
                      const colorBorde = fila.estadoAgregado === "atrasado" ? "var(--rojo)" : fila.estadoAgregado === "por_vencer" ? "var(--naranja)" : "var(--verde)";
                      return (
                        <button
                          key={fila.requerimiento.id}
                          type="button"
                          onClick={() => handleIrATarea(fila.requerimiento.nombre)}
                          className="task-row animate-row-in w-full flex items-center gap-3 px-5 py-3 text-left active:scale-[0.99]"
                          style={{ borderLeftColor: colorBorde, ...retraso }}
                        >
                          <NaturalezaGlyph naturaleza={fila.naturaleza} estatus={fila.estadoAgregado} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{fila.requerimiento.nombre}</p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>{fila.cumplidas} de {fila.total} obras completadas</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--guinda)" }}>
                            Ir a Mis Pendientes
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {totalEnCola > MAX_COLA && (
                    <button
                      type="button"
                      onClick={handleIrAJornada}
                      className="w-full text-center py-3 text-xs font-bold transition-colors hover:opacity-70"
                      style={{ color: "var(--guinda)", borderTop: "1px solid var(--border-soft)" }}
                    >
                      Ver toda mi operación ({totalEnCola}) →
                    </button>
                  )}
                </section>
              )}

              {/* ── Actividad reciente — clickeable, lleva al histórico completo ── */}
              <section
                role="button"
                tabIndex={0}
                onClick={() => navigate("/historico")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/historico"); } }}
                className="card overflow-hidden cursor-pointer transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="px-5 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--border-soft)" }}>
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#8C6B41" }}>
                    Actividad reciente
                  </p>
                  <span className="text-[11px] font-bold flex items-center gap-1 shrink-0" style={{ color: "var(--guinda)" }}>
                    Ver histórico
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
                {actividadReciente.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm" style={{ color: "var(--ink-faint)" }}>
                    Aún no registras actividad hoy.
                  </div>
                ) : (
                  <div className="px-5 py-4 relative">
                    <div className="absolute left-[26px] top-5 bottom-5 w-px" style={{ backgroundColor: "var(--border-soft)" }} />
                    <div className="space-y-4">
                      {actividadReciente.map((ev, i) => (
                        <div key={i} className="relative pl-6 flex items-center justify-between gap-3">
                          <span
                            className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: i === 0 ? "var(--oro)" : "var(--border)", border: "2px solid var(--surface)" }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>{ev.texto}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>{ev.obra}</p>
                          </div>
                          <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--ink-faint)" }}>{formatearHora(ev.momento)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

            </>
          )}

          </main>

          <Footer />
        </div>
      </div>

      <ModalAvisoOperativo
        open={mostrarAviso}
        onClose={() => {
          sessionStorage.setItem(AVISO_REPETIR_KEY, "1");
          setMostrarAviso(false);
        }}
      />
    </div>
  );
}
