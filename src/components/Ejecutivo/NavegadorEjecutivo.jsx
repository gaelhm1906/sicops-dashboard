/**
 * NavegadorEjecutivo — Revisión Integral de la Ejecución de Obra.
 * Vista de control para ADMIN/SECRETARIO (todas las DG) o para un
 * funcionario de una sola Dirección General (dgFija).
 * THESIS: un checklist de cumplimiento en cuatro niveles — Dirección
 * General → Categoría → Requerimiento → Obra — para que el secretario
 * o el admin detecten en segundos qué NO se está subiendo, sin tener
 * que abrir obra por obra.
 * Navegación: todo en línea (sin modal) hasta el nivel de obra, donde
 * se abre la Bandeja completa de esa obra para ver/capturar el detalle.
 */
import React, { useMemo, useState, useCallback } from "react";
import {
  getObraKey,
  getRegistrosObraCompleto,
  calcularIndicadorAvance,
} from "../../utils/seguimiento";
import { REQUERIMIENTOS, CATEGORIAS, ROLES_RESPONSABLE } from "../../data/seguimientoCatalogo";
import { getEvaluacion, resumenPendientesPorObra } from "../../utils/evaluaciones";
import { useAuth } from "../../context/AuthContext";
import BandejaTareasObra from "../Seguimiento/BandejaTareasObra";
import EvaluacionPanel from "./EvaluacionPanel";
import TablaCalorCumplimiento from "./TablaCalorCumplimiento";
import PanelNecesitaAtencion from "./PanelNecesitaAtencion";
import BuscadorEjecutivo from "./BuscadorEjecutivo";

const CATEGORIA_POR_REQ = Object.fromEntries(REQUERIMIENTOS.map((r) => [r.id, r.categoria]));
const UMBRAL_OK = 80;
/* Orden jerárquico de la vista "por funcionario" (a petición del
   secretario): primero Directores Generales, luego el resto de
   directores, luego subdirectores, luego jefes de unidad y al final
   el resto de puestos. Los códigos no listados caen al final (rango 99). */
const RANGO_JERARQUIA_FUNCIONARIO = {
  DIRECTOR_GENERAL: 0,
  DIRECTOR_PROYECTO: 1,
  DIRECTOR_OBRAS_INDUCIDAS: 1,
  DIRECTOR_OBRA: 1,
  DIRECTOR_CONCURSOS_CONTRATOS: 1,
  DIRECTOR_AREA: 1,
  SUBDIRECTOR_PROYECTOS: 2,
  SUBDIRECCION_CONCERTACION: 2,
  SUBDIRECCION_COMUNICACION: 2,
  SUBDIRECTOR: 2,
  JEFE_UNIDAD_OBRA: 3,
  RESIDENTE_OBRA: 4,
  SUPERVISION_EXTERNA: 4,
  ASESORES_ESTRUCTURISTAS: 4,
};
/* Ajuste de minuta (3ª reunión — aclaración del pendiente "conmutador de
   vista por dirección general / por funcionario"): el secretario/admin
   elige si quiere ver el cumplimiento agrupado por Dirección General
   (como hoy) o por funcionario/puesto responsable (qué tareas tiene
   asignadas cada uno) — la elección se recuerda entre sesiones. */
const MODO_VISTA_KEY = "vista_ejecutiva_modo";

const SEMAFORO = {
  verde:  { solid: "#16a34a", dark: "#15803d", bg: "rgba(22,163,74,0.10)" },
  ambar:  { solid: "#d97706", dark: "#b45309", bg: "rgba(217,119,6,0.12)" },
  rojo:   { solid: "#b91c1c", dark: "#7f1d1d", bg: "rgba(185,28,28,0.10)" },
};

function nivelSemaforo(pct) {
  if (pct >= UMBRAL_OK) return SEMAFORO.verde;
  if (pct >= 50) return SEMAFORO.ambar;
  return SEMAFORO.rojo;
}

function promedio(valores) {
  if (valores.length === 0) return 0;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

function IconCheck({ color, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconX({ color, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ── Breadcrumb — "del dato duro al dato específico": el secretario
   siempre sabe exactamente dónde está en la jerarquía DG → Categoría →
   Requerimiento, y puede saltar a cualquier nivel anterior en un clic. */
function Breadcrumb({ pasos }) {
  return (
    <div className="flex items-center flex-wrap gap-1.5 mb-3 text-xs">
      {pasos.map((paso, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: "var(--ink-faint)" }}>›</span>}
          {paso.onClick ? (
            <button
              type="button"
              onClick={paso.onClick}
              className="font-semibold hover:opacity-70 transition-opacity truncate max-w-[160px]"
              style={{ color: "var(--guinda)" }}
            >
              {paso.label}
            </button>
          ) : (
            <span className="font-bold truncate max-w-[200px]" style={{ color: "var(--ink)" }}>{paso.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Nivel 2 · Categoría — checklist ✓/✗ + % ── */
function CategoriaRow({ cat, onClick }) {
  const ok = cat.pct >= UMBRAL_OK;
  const color = ok ? "var(--verde)" : "var(--rojo)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="task-row card w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
      style={{ borderLeftColor: color }}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ok ? "rgba(0,99,65,0.10)" : "rgba(220,38,38,0.10)" }}>
        {ok ? <IconCheck color={color} /> : <IconX color={color} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{cat.categoria}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{cat.cumplido} de {cat.aplicable} cumplido</p>
      </div>
      <span className="text-sm font-black shrink-0" style={{ color }}>{cat.pct}%</span>
      <IconArrow />
    </button>
  );
}

/* ── Nivel 3 · Requerimiento — % + cuántas obras faltan, el dato accionable ── */
function RequerimientoRow({ req, onClick }) {
  const faltan = req.aplicable - req.cumplido;
  const nivel = nivelSemaforo(req.pct);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full flex items-center gap-4 px-4 py-3 text-left transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.99]"
      style={{ borderLeft: `3px solid ${nivel.solid}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{req.nombre}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-1.5 rounded-full overflow-hidden flex-1 max-w-[140px]" style={{ backgroundColor: "var(--border-soft)" }}>
            <div className="h-full rounded-full" style={{ width: `${req.pct}%`, backgroundColor: nivel.solid }} />
          </div>
          <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--ink-faint)" }}>{req.cumplido} de {req.aplicable} cumplidas</span>
        </div>
      </div>
      {faltan > 0 && (
        <div className="text-right shrink-0">
          <p className="text-lg font-black leading-none" style={{ color: nivel.solid }}>{faltan}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--ink-faint)" }}>obras faltantes</p>
        </div>
      )}
      <IconArrow />
    </button>
  );
}

/* ── Nivel 4 · Obra — sí/no de ESE requerimiento; entrar abre la evaluación ── */
function ObraSiNoRow({ entry, cumplida, notificado, onClick }) {
  const color = cumplida ? "var(--verde)" : "var(--rojo)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="task-row card w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
      style={{ borderLeftColor: color }}
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cumplida ? "rgba(0,99,65,0.10)" : "rgba(220,38,38,0.10)" }}>
        {cumplida ? <IconCheck color={color} size={12} /> : <IconX color={color} size={12} />}
      </div>
      <p className="text-sm font-semibold truncate flex-1 min-w-0" style={{ color: "var(--ink)" }}>{entry.obra.nombre_obra || entry.obra.nombre}</p>
      {notificado && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1" style={{ backgroundColor: "rgba(188,149,92,0.15)", color: "var(--oro)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
          Notificado
        </span>
      )}
      <IconArrow />
    </button>
  );
}

export default function NavegadorEjecutivo({ base, mascotSrc, dgFija }) {
  const { user } = useAuth();
  const [modoVista, setModoVista] = useState(() => {
    try {
      return localStorage.getItem(MODO_VISTA_KEY) === "funcionario" ? "funcionario" : "dg";
    } catch {
      return "dg";
    }
  });
  const [dgActiva, setDgActiva] = useState(dgFija || null);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [reqActivo, setReqActivo] = useState(null);
  const [funcionarioActivo, setFuncionarioActivo] = useState(null);
  const [obraModal, setObraModal] = useState(null);
  const [evaluacionAbierta, setEvaluacionAbierta] = useState(null);
  const [version, setVersion] = useState(0);

  const cambiarModo = useCallback((modo) => {
    setModoVista(modo);
    try {
      localStorage.setItem(MODO_VISTA_KEY, modo);
    } catch {
      // no bloquea la UI si falla la persistencia local
    }
    setDgActiva(dgFija || null);
    setCategoriaActiva(null);
    setReqActivo(null);
    setFuncionarioActivo(null);
  }, [dgFija]);

  const dgAgregados = useMemo(() => {
    const map = {};
    for (const o of base) {
      const dg = (o.dg || o.direccion_general || "SIN DIRECCION").trim();
      const key = getObraKey(o);
      const registros = getRegistrosObraCompleto(key);
      const indicador = calcularIndicadorAvance(registros);
      if (!map[dg]) map[dg] = { obras: [] };
      map[dg].obras.push({ obra: o, key, indicador, registros });
    }

    return Object.entries(map)
      .map(([dg, data]) => {
        const catMap = {};
        for (const cat of CATEGORIAS) catMap[cat] = { cumplido: 0, aplicable: 0 };
        const reqMap = {};
        for (const req of REQUERIMIENTOS) reqMap[req.id] = { cumplido: 0, aplicable: 0 };

        for (const entry of data.obras) {
          for (const r of entry.registros) {
            if (r.estatus === "no_aplica") continue;
            const cat = CATEGORIA_POR_REQ[r.reqId];
            if (cat && catMap[cat]) {
              catMap[cat].aplicable += 1;
              if (r.estatus === "cumplido") catMap[cat].cumplido += 1;
            }
            if (reqMap[r.reqId]) {
              reqMap[r.reqId].aplicable += 1;
              if (r.estatus === "cumplido") reqMap[r.reqId].cumplido += 1;
            }
          }
        }

        /* categoriasGrid: las 5 categorías en orden fijo, aunque no
           apliquen (para el mapa de calor, donde las columnas tienen que
           alinear entre todas las filas) — categorias sigue siendo la
           versión filtrada/ordenada que ya usaba el Nivel 2 en tarjetas. */
        const categoriasGrid = CATEGORIAS.map((cat) => ({
          categoria: cat,
          ...catMap[cat],
          pct: catMap[cat].aplicable > 0 ? Math.round((catMap[cat].cumplido / catMap[cat].aplicable) * 100) : 0,
        }));
        const categorias = categoriasGrid.filter((c) => c.aplicable > 0).sort((a, b) => a.pct - b.pct);

        return {
          dg,
          pct: promedio(data.obras.map((e) => e.indicador)),
          total: data.obras.length,
          obras: data.obras,
          categorias,
          categoriasGrid,
          reqMap,
        };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [base]);

  const dgActivaData = useMemo(() => dgAgregados.find((d) => d.dg === dgActiva) || null, [dgAgregados, dgActiva]);

  /* Vista "por funcionario": mismo cumplimiento que la vista por DG, pero
     agrupado por puesto responsable (ROLES_RESPONSABLE) en vez de por
     Dirección General — qué tareas tiene asignadas cada funcionario y
     cuántas cumple, ya sea en todo el universo de `base` o, si el
     visitante tiene dgFija, dentro de su propia DG (el filtro ya viene
     aplicado en `base` desde Dashboard.jsx). Un requerimiento con varios
     responsables (ej. Director de Proyecto + Subdirector de Proyectos)
     cuenta bajo cada uno — ambos son responsables reales de esa tarea. */
  const funcionarioAgregados = useMemo(() => {
    const obras = base.map((o) => {
      const key = getObraKey(o);
      const registros = getRegistrosObraCompleto(key);
      return { obra: o, key, registros };
    });

    const reqMap = {};
    for (const req of REQUERIMIENTOS) reqMap[req.id] = { cumplido: 0, aplicable: 0 };
    for (const entry of obras) {
      for (const r of entry.registros) {
        if (r.estatus === "no_aplica") continue;
        if (reqMap[r.reqId]) {
          reqMap[r.reqId].aplicable += 1;
          if (r.estatus === "cumplido") reqMap[r.reqId].cumplido += 1;
        }
      }
    }

    const porRol = {};
    for (const req of REQUERIMIENTOS) {
      const datos = reqMap[req.id];
      if (datos.aplicable === 0) continue;
      const reqConDatos = { ...req, ...datos, pct: Math.round((datos.cumplido / datos.aplicable) * 100) };
      for (const rolCodigo of req.responsables) {
        if (!porRol[rolCodigo]) porRol[rolCodigo] = [];
        porRol[rolCodigo].push(reqConDatos);
      }
    }

    return Object.entries(porRol)
      .map(([rolCodigo, requerimientos]) => {
        const totalAplicable = requerimientos.reduce((a, r) => a + r.aplicable, 0);
        const totalCumplido = requerimientos.reduce((a, r) => a + r.cumplido, 0);

        /* categoriasGrid: mismo tratamiento que en dgAgregados, para que
           el mapa de calor pueda mostrar filas de DG o de funcionario
           con las mismas columnas fijas. */
        const catMap = {};
        for (const cat of CATEGORIAS) catMap[cat] = { cumplido: 0, aplicable: 0 };
        for (const r of requerimientos) {
          if (catMap[r.categoria]) {
            catMap[r.categoria].aplicable += r.aplicable;
            catMap[r.categoria].cumplido += r.cumplido;
          }
        }
        const categoriasGrid = CATEGORIAS.map((cat) => ({
          categoria: cat,
          ...catMap[cat],
          pct: catMap[cat].aplicable > 0 ? Math.round((catMap[cat].cumplido / catMap[cat].aplicable) * 100) : 0,
        }));

        return {
          rol: rolCodigo,
          nombreRol: ROLES_RESPONSABLE[rolCodigo] || rolCodigo,
          requerimientos: [...requerimientos].sort((a, b) => a.pct - b.pct),
          categoriasGrid,
          pct: totalAplicable > 0 ? Math.round((totalCumplido / totalAplicable) * 100) : 0,
        };
      })
      .sort((a, b) => {
        const rangoA = RANGO_JERARQUIA_FUNCIONARIO[a.rol] ?? 99;
        const rangoB = RANGO_JERARQUIA_FUNCIONARIO[b.rol] ?? 99;
        if (rangoA !== rangoB) return rangoA - rangoB;
        return a.pct - b.pct;
      });
  }, [base]);

  const funcionarioActivoData = useMemo(
    () => funcionarioAgregados.find((f) => f.rol === funcionarioActivo) || null,
    [funcionarioAgregados, funcionarioActivo]
  );

  /* Ajuste de minuta (sesión de revisión #13): resumen automático de
     pendientes por obra y proyecto, agrupado por Dirección General. */
  const resumenPendientes = useMemo(() => {
    const todo = resumenPendientesPorObra();
    return dgFija ? todo.filter((d) => d.dg === dgFija) : todo;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer las evaluaciones guardadas en localStorage
  }, [dgFija, version]);
  /* Matrices para el mapa de calor — misma forma (clave/nombre/categorias)
     para DG y para Funcionario, así TablaCalorCumplimiento no necesita
     saber cuál de los dos está mostrando. */
  const matrizDG = useMemo(
    () => dgAgregados.map((d) => ({ clave: d.dg, nombre: d.dg, tipoEtiqueta: "Dirección General", categorias: d.categoriasGrid })),
    [dgAgregados]
  );
  const matrizFuncionario = useMemo(
    () => funcionarioAgregados.map((f) => ({ clave: f.rol, nombre: f.nombreRol, tipoEtiqueta: "Funcionario", categorias: f.categoriasGrid })),
    [funcionarioAgregados]
  );

  /* "Necesita su atención" — la pregunta que antes costaba tres pantallas
     (¿qué obra, de qué DG, con qué responsable?) respondida en una sola
     lista cruzada: obras en avance crítico + obras con observaciones del
     Secretario sin atender, ordenadas por severidad. El responsable
     mostrado es el del requerimiento pendiente más relevante de esa obra
     (aproximación razonable — una obra puede tener varios responsables
     pendientes a la vez, se muestra el primero). */
  const necesitaAtencion = useMemo(() => {
    const items = [];

    for (const dg of dgAgregados) {
      for (const entry of dg.obras) {
        if (entry.indicador >= UMBRAL_OK) continue;
        const pendiente = entry.registros.find((r) => r.estatus !== "cumplido" && r.estatus !== "no_aplica");
        const req = pendiente ? REQUERIMIENTOS.find((r) => r.id === pendiente.reqId) : null;
        /* `responsableLabel` primero — ver seguimientoCatalogo.js: dos
           códigos que son "el mismo puesto con dos nombres según la
           Dirección" no deben mostrarse como si solo el primero de la
           lista fuera el responsable real. */
        const responsable = req ? (req.responsableLabel || ROLES_RESPONSABLE[req.responsables[0]]) : null;
        items.push({
          id: `avance-${entry.key}`,
          nombreObra: entry.obra.nombre_obra || entry.obra.nombre || "Obra sin nombre",
          dg: dg.dg,
          responsable,
          etiqueta: `${entry.indicador}% avance`,
          severidad: entry.indicador < 50 ? "rojo" : "ambar",
          orden: entry.indicador,
          obra: entry.obra,
        });
      }
    }

    for (const d of resumenPendientes) {
      for (const o of d.obras) {
        items.push({
          id: `obs-${o.obraKey}`,
          nombreObra: o.nombre,
          dg: d.dg,
          responsable: null,
          etiqueta: `${o.count} observación${o.count === 1 ? "" : "es"} sin atender`,
          severidad: "ambar",
          orden: 40,
          obra: { clave_unica: o.obraKey, nombre_obra: o.nombre, nombre: o.nombre },
        });
      }
    }

    return items.sort((a, b) => a.orden - b.orden);
  }, [dgAgregados, resumenPendientes]);

  /* Listas planas para el buscador — obra/dirección/funcionario, los
     tres ejes que antes vivían en pantallas separadas. */
  const obrasParaBuscador = useMemo(
    () => base.map((o) => ({ key: getObraKey(o), nombre: o.nombre_obra || o.nombre || "Obra sin nombre", clave: o.clave_unica || "", obra: o })),
    [base]
  );
  const direccionesParaBuscador = useMemo(() => dgAgregados.map((d) => ({ clave: d.dg, nombre: d.dg })), [dgAgregados]);
  const funcionariosParaBuscador = useMemo(() => funcionarioAgregados.map((f) => ({ clave: f.rol, nombre: f.nombreRol })), [funcionarioAgregados]);

  const requerimientosActivos = useMemo(() => {
    if (!dgActivaData || !categoriaActiva) return [];
    return REQUERIMIENTOS
      .filter((r) => r.categoria === categoriaActiva)
      .map((r) => {
        const datos = dgActivaData.reqMap[r.id];
        return { ...r, ...datos, pct: datos.aplicable > 0 ? Math.round((datos.cumplido / datos.aplicable) * 100) : 0 };
      })
      .filter((r) => r.aplicable > 0)
      .sort((a, b) => a.pct - b.pct);
  }, [dgActivaData, categoriaActiva]);

  const reqActivoInfo = useMemo(() => {
    if (modoVista === "funcionario") {
      return funcionarioActivoData?.requerimientos.find((r) => r.id === reqActivo) || null;
    }
    return requerimientosActivos.find((r) => r.id === reqActivo) || null;
  }, [modoVista, requerimientosActivos, funcionarioActivoData, reqActivo]);

  const obrasParaReq = useMemo(() => {
    if (!dgActivaData || !reqActivo) return [];
    return dgActivaData.obras
      .map((entry) => {
        const registro = entry.registros.find((r) => r.reqId === reqActivo);
        if (!registro || registro.estatus === "no_aplica") return null;
        return {
          entry,
          registro,
          cumplida: registro.estatus === "cumplido",
          evaluacion: getEvaluacion(entry.key, reqActivo),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.cumplida) - Number(b.cumplida));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer las evaluaciones guardadas en localStorage
  }, [dgActivaData, reqActivo, version]);

  /* Igual que obrasParaReq, pero sin filtrar por DG — el universo completo
     de `base` (ya scoped a dgFija desde Dashboard.jsx cuando aplica). */
  const obrasParaReqFuncionario = useMemo(() => {
    if (!reqActivo) return [];
    return base
      .map((o) => {
        const key = getObraKey(o);
        const registros = getRegistrosObraCompleto(key);
        const registro = registros.find((r) => r.reqId === reqActivo);
        if (!registro || registro.estatus === "no_aplica") return null;
        return {
          entry: { obra: o, key, registros },
          registro,
          cumplida: registro.estatus === "cumplido",
          evaluacion: getEvaluacion(key, reqActivo),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.cumplida) - Number(b.cumplida));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer las evaluaciones guardadas en localStorage
  }, [base, reqActivo, version]);

  const seleccionarDg = useCallback((dg) => {
    setDgActiva(dg);
    setCategoriaActiva(null);
    setReqActivo(null);
  }, []);

  const seleccionarCategoria = useCallback((cat) => {
    setCategoriaActiva(cat);
    setReqActivo(null);
  }, []);

  const seleccionarFuncionario = useCallback((rol) => {
    setFuncionarioActivo(rol);
    setReqActivo(null);
  }, []);

  /* Clic en una celda del mapa de calor — entra directo a Nivel 3 (los
     requerimientos de esa categoría), saltándose la tarjeta intermedia. */
  const abrirCeldaDG = useCallback((dg, categoria) => {
    setDgActiva(dg);
    setCategoriaActiva(categoria);
    setReqActivo(null);
  }, []);

  /* Para funcionario no hay drill por categoría (su lista de tareas ya es
     corta) — la celda abre directo su Nivel 2. */
  const abrirCeldaFuncionario = useCallback((rol) => {
    setFuncionarioActivo(rol);
    setReqActivo(null);
  }, []);

  const buscarDireccion = useCallback((dg) => {
    cambiarModo("dg");
    setDgActiva(dg);
  }, [cambiarModo]);

  const buscarFuncionario = useCallback((rol) => {
    cambiarModo("funcionario");
    setFuncionarioActivo(rol);
  }, [cambiarModo]);

  if (dgAgregados.length === 0) return null;

  const globalPct = promedio(dgAgregados.map((d) => d.pct));
  const nivelGlobal = nivelSemaforo(dgFija ? (dgActivaData?.pct ?? 0) : globalPct);

  /* Nivel 1 combinado (DG y Funcionario comparten el mismo bloque, solo
     cambian los datos que le pasan a la tabla) — buscador de los tres
     ejes + prioridad cruzada + mapa de calor con el conmutador en su
     propio encabezado. Reemplaza tanto la cuadrícula de tarjetas de DG
     como la de Funcionario que había antes. */
  const nivelUnoCombinado = (
    <>
      <BuscadorEjecutivo
        obras={obrasParaBuscador}
        direcciones={direccionesParaBuscador}
        funcionarios={funcionariosParaBuscador}
        onObra={(obra) => setObraModal(obra)}
        onDireccion={buscarDireccion}
        onFuncionario={buscarFuncionario}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        <div className="lg:col-span-5">
          <PanelNecesitaAtencion items={necesitaAtencion} onSeleccionar={(item) => setObraModal(item.obra)} />
        </div>
        <div className="lg:col-span-7">
          <TablaCalorCumplimiento
            titulo={modoVista === "dg" ? "Cumplimiento por Dirección General" : "Cumplimiento por Funcionario"}
            toggle={
              <div className="flex items-center gap-1 p-1 rounded-full w-fit shrink-0" style={{ backgroundColor: "var(--surface-2)" }}>
                <button
                  type="button"
                  onClick={() => cambiarModo("dg")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
                  style={modoVista === "dg" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
                >
                  Por Dirección General
                </button>
                <button
                  type="button"
                  onClick={() => cambiarModo("funcionario")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
                  style={modoVista === "funcionario" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
                >
                  Por Funcionario
                </button>
              </div>
            }
            columnas={CATEGORIAS}
            filas={modoVista === "dg" ? matrizDG : matrizFuncionario}
            onCelda={modoVista === "dg" ? abrirCeldaDG : abrirCeldaFuncionario}
          />
        </div>
      </div>
    </>
  );

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      {/* Encabezado — mascota + tesis de la vista */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #f0ece5" }}>
        {mascotSrc && (
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#fff", border: "1.5px solid #F0ECE5" }}>
            <img src={mascotSrc} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: "#1f2937" }}>
            {dgFija ? `Revisión Integral — ${dgFija}` : "Revisión Integral de la Ejecución de Obra"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-black leading-none" style={{ color: nivelGlobal.solid }}>
            {dgFija ? (dgActivaData?.pct ?? 0) : globalPct}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "#9ca3af" }}>
            {dgFija ? "Tu DG" : "Global"}
          </p>
        </div>
      </div>

      <div className="p-4">
        {modoVista === "funcionario" ? (
          !funcionarioActivo ? (
            nivelUnoCombinado
          ) : !reqActivo ? (
            /* ── Nivel 2 (funcionario): tareas asignadas a ese puesto ── */
            <div>
              <Breadcrumb
                pasos={[
                  { label: "Funcionarios", onClick: () => seleccionarFuncionario(null) },
                  { label: funcionarioActivoData?.nombreRol },
                ]}
              />
              <div className="space-y-2">
                {funcionarioActivoData?.requerimientos.map((req) => (
                  <RequerimientoRow key={req.id} req={req} onClick={() => setReqActivo(req.id)} />
                ))}
              </div>
            </div>
          ) : (
            /* ── Nivel 3 (funcionario): obras — sí/no de esa tarea ── */
            <div>
              <Breadcrumb
                pasos={[
                  { label: "Funcionarios", onClick: () => seleccionarFuncionario(null) },
                  { label: funcionarioActivoData?.nombreRol, onClick: () => setReqActivo(null) },
                  { label: reqActivoInfo?.nombre },
                ]}
              />
              <div className="space-y-2">
                {obrasParaReqFuncionario.map((fila) => (
                  <ObraSiNoRow
                    key={fila.entry.key}
                    entry={fila.entry}
                    cumplida={fila.cumplida}
                    notificado={!!fila.evaluacion?.notificado}
                    onClick={() => setEvaluacionAbierta(fila)}
                  />
                ))}
              </div>
            </div>
          )
        ) : !dgActiva ? (
          nivelUnoCombinado
        ) : !categoriaActiva ? (
          /* ── Nivel 2: checklist de categorías ── */
          <div>
            <Breadcrumb
              pasos={
                dgFija
                  ? [{ label: dgActiva }]
                  : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }, { label: dgActiva }]
              }
            />
            <div className="space-y-2">
              {dgActivaData?.categorias.map((cat) => (
                <CategoriaRow key={cat.categoria} cat={cat} onClick={() => seleccionarCategoria(cat.categoria)} />
              ))}
            </div>
          </div>
        ) : !reqActivo ? (
          /* ── Nivel 3: requerimientos de la categoría ── */
          <div>
            <Breadcrumb
              pasos={[
                ...(dgFija ? [] : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }]),
                { label: dgActiva, onClick: () => seleccionarCategoria(null) },
                { label: categoriaActiva },
              ]}
            />
            <div className="space-y-2">
              {requerimientosActivos.map((req) => (
                <RequerimientoRow key={req.id} req={req} onClick={() => setReqActivo(req.id)} />
              ))}
            </div>
          </div>
        ) : (
          /* ── Nivel 4: obras — sí/no de este requerimiento, con evaluación ── */
          <div>
            <Breadcrumb
              pasos={[
                ...(dgFija ? [] : [{ label: "Direcciones Generales", onClick: () => seleccionarDg(null) }]),
                { label: dgActiva, onClick: () => seleccionarCategoria(null) },
                { label: categoriaActiva, onClick: () => setReqActivo(null) },
                { label: reqActivoInfo?.nombre },
              ]}
            />
            <div className="space-y-2">
              {obrasParaReq.map((fila) => (
                <ObraSiNoRow
                  key={fila.entry.key}
                  entry={fila.entry}
                  cumplida={fila.cumplida}
                  notificado={!!fila.evaluacion?.notificado}
                  onClick={() => setEvaluacionAbierta(fila)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {obraModal && (
        <BandejaTareasObra obra={obraModal} onClose={() => setObraModal(null)} />
      )}

      {evaluacionAbierta && reqActivoInfo && (
        <EvaluacionPanel
          obra={evaluacionAbierta.entry.obra}
          obraKey={evaluacionAbierta.entry.key}
          requerimiento={reqActivoInfo}
          registro={evaluacionAbierta.registro}
          cumplida={evaluacionAbierta.cumplida}
          evaluacionActual={evaluacionAbierta.evaluacion}
          evaluadoPor={user?.email}
          onGuardar={() => setVersion((v) => v + 1)}
          onClose={() => setEvaluacionAbierta(null)}
          onVerBandeja={() => {
            setObraModal(evaluacionAbierta.entry.obra);
            setEvaluacionAbierta(null);
          }}
        />
      )}
    </section>
  );
}
