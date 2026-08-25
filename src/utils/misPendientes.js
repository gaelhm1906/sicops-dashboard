/**
 * utils/misPendientes.js
 * Construye la bandeja "Mis pendientes": una fila por cada combinación
 * (obra × requerimiento) visible para el rol del usuario, aplanada y
 * ordenada por urgencia — reemplaza la navegación por Dirección/Programa
 * como punto de entrada diario (esa jerarquía era del modelo anterior de
 * "actualizar % avance"; ahora lo relevante es qué tarea sigue).
 */
import { REQUERIMIENTOS, getRequerimientosPorRol } from "../data/seguimientoCatalogo";
import { getObraKey, getRegistrosObra, ESTATUS_REGISTRO, diasHastaFecha } from "./seguimiento";
import { getNaturaleza, NATURALEZA, NATURALEZA_INFO } from "./naturaleza";

const VENCE_PRONTO_DIAS = 1; // pendiente cuya fecha de compromiso es hoy o mañana

const REQ_POR_ID = Object.fromEntries(REQUERIMIENTOS.map((r) => [r.id, r]));

const ORDEN_URGENCIA = {
  [ESTATUS_REGISTRO.ATRASADO]: 0,
  [ESTATUS_REGISTRO.PENDIENTE]: 1,
  [ESTATUS_REGISTRO.CUMPLIDO]: 2,
};

function nombreObra(obra) {
  return obra.nombre_obra || obra.nombre || "";
}

/** Filas planas de tareas para el rol dado, a través de todas las obras provistas. */
export function getPendientesUsuario(obras, rol) {
  const reqsRol = getRequerimientosPorRol(rol);
  if (reqsRol.length === 0) return [];

  const filas = [];
  for (const obra of obras) {
    const obraKey = getObraKey(obra);
    const registros = getRegistrosObra(obraKey, rol);
    for (const registro of registros) {
      if (registro.estatus === ESTATUS_REGISTRO.NO_APLICA) continue;
      const requerimiento = REQ_POR_ID[registro.reqId];
      if (!requerimiento) continue;
      filas.push({ obra, obraKey, requerimiento, registro, naturaleza: getNaturaleza(requerimiento.id) });
    }
  }

  return filas.sort((a, b) => {
    const u = ORDEN_URGENCIA[a.registro.estatus] - ORDEN_URGENCIA[b.registro.estatus];
    if (u !== 0) return u;
    return nombreObra(a.obra).localeCompare(nombreObra(b.obra));
  });
}

function nombreProgramaDe(fila) {
  return fila.obra.programa || "Sin programa";
}

/**
 * Agrupa la bandeja plana en Programa → Obra → tareas. Un listado de
 * cientos de filas es inmanejable en scroll único; agrupado por programa
 * el usuario decide qué frente atacar primero, y dentro de cada obra ve
 * juntas todas las tareas que le tocan ahí.
 */
export function agruparPorPrograma(filas) {
  const porPrograma = new Map();

  for (const fila of filas) {
    const programa = nombreProgramaDe(fila);
    if (!porPrograma.has(programa)) porPrograma.set(programa, new Map());
    const porObra = porPrograma.get(programa);
    if (!porObra.has(fila.obraKey)) porObra.set(fila.obraKey, { obraKey: fila.obraKey, obra: fila.obra, tareas: [] });
    porObra.get(fila.obraKey).tareas.push(fila);
  }

  const grupos = Array.from(porPrograma.entries()).map(([programa, porObra]) => {
    const obras = Array.from(porObra.values());
    const conteo = { atrasado: 0, pendiente: 0, cumplido: 0 };
    let total = 0;
    for (const o of obras) {
      for (const t of o.tareas) {
        conteo[t.registro.estatus] = (conteo[t.registro.estatus] || 0) + 1;
        total += 1;
      }
    }
    return { programa, obras, conteo, total };
  });

  return grupos.sort((a, b) => (b.conteo.atrasado - a.conteo.atrasado) || (b.conteo.pendiente - a.conteo.pendiente) || b.total - a.total);
}

export function contarPorUrgencia(filas) {
  return filas.reduce(
    (acc, f) => {
      acc[f.registro.estatus] = (acc[f.registro.estatus] || 0) + 1;
      return acc;
    },
    { atrasado: 0, pendiente: 0, cumplido: 0 }
  );
}

/** Un pendiente (no atrasado) cuya fecha de compromiso es hoy o mañana */
export function esPorVencer(registro) {
  if (registro.estatus !== ESTATUS_REGISTRO.PENDIENTE) return false;
  const dias = diasHastaFecha(registro.fechaCompromiso);
  return dias !== null && dias <= VENCE_PRONTO_DIAS;
}

/** Estado visual (Design System v2): cumplido | atrasado | por_vencer | pendiente */
export function getEstadoVisual(registro) {
  if (registro.estatus === ESTATUS_REGISTRO.CUMPLIDO) return "cumplido";
  if (registro.estatus === ESTATUS_REGISTRO.ATRASADO) return "atrasado";
  if (esPorVencer(registro)) return "por_vencer";
  return "pendiente";
}

const ORDEN_VISUAL = { atrasado: 0, por_vencer: 1, pendiente: 2, cumplido: 3 };

/**
 * Agrupa la cola por naturaleza (Visita/Verificación/Evidencia/Financiero/
 * Reporte) en vez de por programa — Design System v2: el usuario entiende
 * qué TIPO de trabajo tiene enfrente de un vistazo, sin perder el orden
 * por urgencia dentro de cada grupo.
 */
export function agruparPorNaturaleza(filas) {
  const grupos = {};
  for (const naturaleza of Object.keys(NATURALEZA_INFO)) grupos[naturaleza] = [];
  for (const fila of filas) {
    const nat = fila.naturaleza || NATURALEZA.REPORTE;
    if (!grupos[nat]) grupos[nat] = [];
    grupos[nat].push(fila);
  }
  return Object.entries(grupos)
    .map(([naturaleza, items]) => ({
      naturaleza,
      label: NATURALEZA_INFO[naturaleza]?.label || naturaleza,
      items: [...items].sort((a, b) => ORDEN_VISUAL[getEstadoVisual(a.registro)] - ORDEN_VISUAL[getEstadoVisual(b.registro)]),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => (NATURALEZA_INFO[a.naturaleza]?.orden ?? 9) - (NATURALEZA_INFO[b.naturaleza]?.orden ?? 9));
}

/**
 * Agrupa la cola por TIPO de requerimiento (no por obra) — un usuario con
 * pocos requerimientos asignados puede tener decenas de filas si le tocan
 * en muchas obras (26 obras × 2 requerimientos = 52 filas); lo que le
 * importa de un vistazo es "¿qué tipos de tarea tengo y qué tan avanzado
 * voy en cada uno?", no cada combinación individual. El color agregado es
 * un semáforo de avance: rojo = sin iniciar en ninguna obra, ámbar = ya
 * arrancado, verde = completado en todas.
 */
export function agruparPorRequerimiento(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    const reqId = fila.requerimiento.id;
    if (!grupos.has(reqId)) {
      grupos.set(reqId, {
        requerimiento: fila.requerimiento,
        naturaleza: fila.naturaleza || NATURALEZA.REPORTE,
        total: 0,
        cumplidas: 0,
      });
    }
    const grupo = grupos.get(reqId);
    grupo.total += 1;
    if (fila.registro.estatus === ESTATUS_REGISTRO.CUMPLIDO) grupo.cumplidas += 1;
  }

  const orden = { atrasado: 0, por_vencer: 1, cumplido: 2 };
  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      estadoAgregado: grupo.cumplidas === 0 ? "atrasado" : grupo.cumplidas === grupo.total ? "cumplido" : "por_vencer",
    }))
    .sort((a, b) => orden[a.estadoAgregado] - orden[b.estadoAgregado]);
}

/** Los 4 indicadores operativos del inicio: Pendientes / Atrasadas / Por vencer / Completadas */
export function contarIndicadoresHome(filas) {
  let pendientes = 0, atrasadas = 0, porVencer = 0, completadas = 0;
  for (const f of filas) {
    if (f.registro.estatus === ESTATUS_REGISTRO.ATRASADO) atrasadas += 1;
    else if (f.registro.estatus === ESTATUS_REGISTRO.CUMPLIDO) completadas += 1;
    else if (f.registro.estatus === ESTATUS_REGISTRO.PENDIENTE) {
      if (esPorVencer(f.registro)) porVencer += 1;
      else pendientes += 1;
    }
  }
  return { pendientes, atrasadas, porVencer, completadas };
}

/**
 * Actividad reciente — combina requerimientos marcados como cumplidos hoy
 * con las visitas de hoy, ordenado del más reciente al más antiguo. Solo
 * usa datos ya existentes (fechaReal, hora de visita) — no agrega estado nuevo.
 */
export function getActividadReciente(filas, visitasHoy, obraPorKey, limite = 6) {
  const hoy = new Date().toISOString().slice(0, 10);
  const eventos = [];

  for (const f of filas) {
    if (f.registro.estatus === ESTATUS_REGISTRO.CUMPLIDO && f.registro.fechaReal === hoy) {
      eventos.push({
        tipo: "requerimiento",
        momento: `${hoy}T12:00:00`,
        texto: `Completaste "${f.requerimiento.nombre}"`,
        obra: f.obra.nombre_obra || f.obra.nombre,
      });
    }
  }

  for (const v of visitasHoy) {
    const obra = obraPorKey?.[v.obraKey];
    eventos.push({
      tipo: "visita",
      momento: v.hora,
      texto: "Registraste una visita de campo",
      obra: obra?.nombre_obra || obra?.nombre || v.obraKey,
    });
  }

  return eventos
    .sort((a, b) => new Date(b.momento) - new Date(a.momento))
    .slice(0, limite);
}
