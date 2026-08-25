/**
 * controllers/evolucionCtrl.js
 * Evolución de Obras — Nivel 5 (detalle histórico de una obra individual).
 * Fuente: snapshots_semanales (serie semanal) + auditoria (eventos/hitos).
 * Llave de unión: (tabla, obra_id) — ya presente en cada obra normalizada
 * por obrasCtrl.js, sin necesidad de tabla dimensión.
 *
 * GET /api/evolucion/obra?tabla=obras_lineas&id=144
 */
const { query, listarTablas, columnasDe, SCHEMA } = require("../config/pg");

/* ── Semanas con anomalía conocida en la captura del snapshot ──
   Validado por SQL contra producción: la captura de obras_lineas en
   2026-W22 mostró caídas de avance que no corresponden a ningún evento
   real en obras_auditoria — es un dato de captura puntual, no un cambio
   de negocio. Se excluye de los indicadores, nunca se oculta de la serie. */
const ANOMALIAS_CONOCIDAS = [
  {
    tabla: "obras_lineas", anio: 2026, semana: 22,
    motivo: "Captura con valores atípicos detectados en obras_lineas — excluido de los cálculos",
  },
];

function esAnomalia(tabla, anio, semana) {
  const hit = ANOMALIAS_CONOCIDAS.find(
    (a) => a.tabla === tabla && a.anio === anio && a.semana === semana
  );
  return hit ? hit.motivo : null;
}

/* ── Detección de columnas (mismo patrón que obrasCtrl.js / obrasUpdateCtrl.js) ── */
const ALIAS = {
  id:          ["ID OBRA", "id obra", "id_obra", "id", "ID", "gid", "objectid", "fid", "ogc_fid"],
  nombre:      ["NOMBRE DEL SITIO INTERVENIDO", "nombre del sitio intervenido", "NOMBRE_OBRA", "nombre_obra", "NOMBRE", "nombre"],
  estatus:     ["ESTATUS", "estatus", "STATUS", "status", "ESTADO", "estado"],
  avance:      ["AVANCE REAL", "avance real", "AVANCE", "avance", "PORCENTAJE", "porcentaje", "avance_real"],
  dg:          ["SEGUIMIENTO", "seguimiento", "DIRECCION GENERAL", "direccion general", "direccion_general", "dg", "DG"],
  programa:    ["PROGRAMA", "programa", "NOMBRE_PROGRAMA", "nombre_programa"],
  clave_unica: ["CLAVE_UNICA", "clave_unica", "CLAVE UNICA", "clave unica", "CLAVE ÚNICA", "clave única", "clave"],
  alcaldia:    ["ALCALDIA", "alcaldia", "ALCALDÍA", "alcaldía", "municipio", "MUNICIPIO"],
  fecha_inauguracion: ["fecha inauguracion", "fecha_inauguracion", "FECHA INAUGURACION", "FECHA_INAUGURACION"],
  /* Foco amarillo, modo KM (Ciclovías, Ciudad Iluminada): longitud propia de
     la obra, usada para calcular su ritmo semanal esperado individual. */
  longitud_km: ["long (km)", "LONG (KM)", "longitud_km", "LONGITUD_KM", "long_km", "LONG_KM"],
};

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD").replace(/\p{Mark}/gu, "")
    .toLowerCase().replace(/[\s_]+/g, "").trim();
}

function findColumn(columnas, keys) {
  const normalized = columnas.map((c) => ({ original: c.column_name, key: normalizeKey(c.column_name) }));
  for (const k of keys) {
    const match = normalized.find((c) => c.key === normalizeKey(k));
    if (match) return match.original;
  }
  return null;
}

/* Mismo vocabulario que ListadoObras.jsx normalizarEstatus() — la BD
   escribe ENTREGADO, el usuario espera ver "INAUGURADA". */
function normalizarEstatus(estatus) {
  const s = String(estatus || "").toUpperCase().trim();
  if (s === "EN PROCESO") return "EN PROCESO";
  if (s === "TERMINADA" || s === "TERMINADO") return "TERMINADA";
  if (s.includes("INAUGUR") || s.includes("ENTREGAD")) return "INAUGURADA";
  if (s === "CANCELADA" || s === "CANCELADO") return "CANCELADO";
  return "SIN INICIAR";
}

function calcularIndicadores(serieValida) {
  if (serieValida.length === 0) {
    return {
      semanas_con_datos: 0, semanas_excluidas_por_anomalia: 0, semanas_sin_movimiento: 0,
      mayor_incremento_semanal: null, variacion_acumulada: 0,
      tiempo_promedio_entre_actualizaciones_dias: null, tendencia: "SIN DATOS SUFICIENTES",
    };
  }
  const deltas = [];
  for (let i = 1; i < serieValida.length; i++) {
    deltas.push({
      periodo: serieValida[i].periodo,
      delta: +(serieValida[i].avance - serieValida[i - 1].avance).toFixed(2),
    });
  }

  const semanasSinMovimiento = deltas.filter((d) => d.delta === 0).length;
  const mayorIncremento = deltas.length
    ? deltas.reduce((max, d) => (d.delta > max.delta ? d : max), deltas[0])
    : null;
  const variacionAcumulada = +(serieValida[serieValida.length - 1].avance - serieValida[0].avance).toFixed(2);

  let tendencia = "ESTABLE";
  if (deltas.length >= 2) {
    const ultimos2 = deltas.slice(-2);
    const estancada = ultimos2.every((d) => d.delta === 0);
    if (estancada) {
      tendencia = "ESTANCADA";
    } else {
      const promHistorico = deltas.reduce((s, d) => s + d.delta, 0) / deltas.length;
      const promReciente = ultimos2.reduce((s, d) => s + d.delta, 0) / ultimos2.length;
      if (promReciente > promHistorico) tendencia = "ACELERANDO";
      else if (promReciente < promHistorico) tendencia = "DESACELERANDO";
    }
  } else if (deltas.length === 1 && deltas[0].delta === 0) {
    tendencia = "ESTANCADA";
  }

  return {
    semanas_con_datos: serieValida.length,
    semanas_sin_movimiento: semanasSinMovimiento,
    mayor_incremento_semanal: mayorIncremento && mayorIncremento.delta > 0 ? mayorIncremento : null,
    variacion_acumulada: variacionAcumulada,
    tendencia,
  };
}

/* ── Alertas operativas — Foco Rojo ──
   Operan sobre serieValida (ya excluye ANOMALIAS_CONOCIDAS y nulos). */
const ESTATUS_SIN_ESTANCAMIENTO = ["TERMINADA", "INAUGURADA", "CANCELADO"];
const RACHA_MINIMA_ESTANCADA = 3;

/* CONSTRUCCION DE UTOPIAS: el avance mostrado al usuario se calcula en el
   frontend desde los frentes de uto_2025 (ponderado por monto), NUNCA desde
   la columna "AVANCE REAL" de la obra en su tabla — esa columna se queda
   congelada y dispara ESTANCADA en falso siempre. Deshabilitado a propósito
   mientras el equipo define cómo mostrar alertas para este programa
   (pendiente de análisis — ver conversación 2026-06-19). */
const PROGRAMAS_SIN_ALERTAS = ["CONSTRUCCION DE UTOPIAS"];

function tieneAlertasHabilitadas(programa) {
  return !PROGRAMAS_SIN_ALERTAS.includes(String(programa || "").toUpperCase().trim());
}

/* "2026-W21" no significa nada para un operador — se usa internamente como
   periodo, pero en los mensajes de cara al usuario siempre se muestra la
   fecha real. timeZone UTC porque snapshots_semanales.fecha es una columna
   DATE (sin hora): evita que un shift de zona horaria local mueva el día. */
function formatFechaCorta(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/* Agrega un punto sintético "ahora" con el avance EN VIVO de la tabla, para
   que calcularAlertas() nunca dictamine ESTANCADA/RETROCESO contra una foto
   semanal vieja cuando la obra ya se actualizó después de esa captura. Si el
   valor vivo es igual al último punto de la serie, no se agrega nada (evita
   duplicar y alterar la racha sin necesidad). */
function conPuntoVivo(serieValida, avanceVivo, estatusVivoNorm) {
  if (avanceVivo === null || avanceVivo === undefined || Number.isNaN(avanceVivo)) return serieValida;
  const ultimo = serieValida[serieValida.length - 1];
  if (ultimo && Math.abs(ultimo.avance - avanceVivo) < 0.05) return serieValida;
  return [
    ...serieValida,
    {
      periodo: "ACTUAL",
      avance: avanceVivo,
      estatus: estatusVivoNorm || (ultimo ? ultimo.estatus : "EN PROCESO"),
      anomalia: false,
      fecha: new Date().toISOString(),
    },
  ];
}

function calcularAlertas(serieValida, estatusActualNorm) {
  const alertas = [];

  /* FOCO ROJO #1 — ESTANCADA: ≥3 semanas consecutivas (al final de la serie)
     con el mismo avance. No aplica a obras en estatus terminal. */
  if (!ESTATUS_SIN_ESTANCAMIENTO.includes(estatusActualNorm) && serieValida.length >= RACHA_MINIMA_ESTANCADA) {
    const ultimo = serieValida[serieValida.length - 1];
    let racha = 1;
    for (let i = serieValida.length - 2; i >= 0; i--) {
      if (serieValida[i].avance === ultimo.avance) racha++;
      else break;
    }
    if (racha >= RACHA_MINIMA_ESTANCADA) {
      const inicioRacha = serieValida[serieValida.length - racha];
      alertas.push({
        tipo: "FOCO_ROJO",
        codigo: "ESTANCADA",
        descripcion: `Sin avance desde hace ${racha} semanas`,
        fecha_detectada: inicioRacha.fecha,
        activa: true,
        persistente: false,
      });
    }
  }

  /* FOCO ROJO #2 — RETROCESO_DETECTADO: descenso real de al menos 1pp.
     Por debajo de 1pp se considera ruido de captura (redondeo del operador,
     ajuste menor de avance). Un retroceso significativo en obra es mínimo 1pp.
     Persistente para siempre, incluso si la obra se recupera después. */
  const RETROCESO_MIN_PP = 1.0;
  for (let i = 1; i < serieValida.length; i++) {
    const caida = serieValida[i - 1].avance - serieValida[i].avance;
    if (caida >= RETROCESO_MIN_PP) {
      const avAntes = Number(serieValida[i - 1].avance).toFixed(2);
      const avDespues = Number(serieValida[i].avance).toFixed(2);
      alertas.push({
        tipo: "FOCO_ROJO",
        codigo: "RETROCESO_DETECTADO",
        descripcion: `Retroceso de ${avAntes}% a ${avDespues}% el ${formatFechaCorta(serieValida[i].fecha)}`,
        fecha_detectada: serieValida[i].fecha,
        activa: true,
        persistente: true,
      });
      break;
    }
  }

  return alertas;
}

function construirHitos(eventos) {
  const hitos = [];

  for (const ev of eventos) {
    const antes  = normalizarEstatus(ev["ESTATUS ANTERIOR"]);
    const nuevo  = normalizarEstatus(ev["ESTATUS NUEVO"]);
    if (ev["ESTATUS ANTERIOR"] && ev["ESTATUS NUEVO"] && antes !== nuevo) {
      hitos.push({
        tipo: "CAMBIO_ESTATUS",
        fecha: new Date(ev.timestamp).toISOString().slice(0, 10),
        descripcion: `${antes} → ${nuevo}`,
      });
    }
    if (ev.accion === "CAMBIO_MODO") {
      hitos.push({
        tipo: "CAMBIO_MODO",
        fecha: new Date(ev.timestamp).toISOString().slice(0, 10),
        descripcion: ev.motivo || "Cambio de modo de seguimiento",
      });
    }
  }

  const eventosConDelta = eventos
    .filter((ev) => ev.delta !== null && ev.delta !== undefined && Number(ev.delta) > 0)
    .map((ev) => ({ ...ev, delta: Number(ev.delta) }));
  if (eventosConDelta.length > 0) {
    const mayor = eventosConDelta.reduce((max, ev) => (ev.delta > max.delta ? ev : max), eventosConDelta[0]);
    hitos.push({
      tipo: "MAYOR_AVANCE",
      fecha: new Date(mayor.timestamp).toISOString().slice(0, 10),
      descripcion: `+${mayor.delta}%`,
    });
  }

  return hitos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

async function resolverTabla(tablaSolicitada) {
  const tablas = await listarTablas();
  if (tablas.includes(tablaSolicitada)) return tablaSolicitada;
  return null;
}

/* ── Resumen agregado de Focos Rojos — Nivel Programa / DG ──
   Reutiliza calcularAlertas() tal cual (misma regla que el detalle de obra).
   IMPORTANTE: snapshots_semanales.direccion_general está confirmado 100% NULL
   en producción (validado por SQL) y .programa no es confiable como filtro
   (0% en uto_2025). Por eso el nivel/clave se resuelve SIEMPRE contra la
   tabla viva (mismo criterio que getEvolucionObra), nunca contra columnas
   guardadas en el snapshot — el snapshot solo aporta la serie de avance. */
const ALIAS_DIM_CACHE_TTL = 5 * 60 * 1000;
let _dimCache = null;
let _dimCacheTs = 0;

async function obtenerDimensionObras(tablasDistintas) {
  if (_dimCache && Date.now() - _dimCacheTs < ALIAS_DIM_CACHE_TTL) return _dimCache;

  const dim = new Map(); // "tabla::id" -> { programa, dg, estatus }
  for (const tablaActual of tablasDistintas) {
    const columnas = await columnasDe(tablaActual);
    const campoId       = findColumn(columnas, ALIAS.id);
    const campoPrograma = findColumn(columnas, ALIAS.programa);
    const campoDg        = findColumn(columnas, ALIAS.dg);
    const campoEstatus   = findColumn(columnas, ALIAS.estatus);
    const campoAvance   = findColumn(columnas, ALIAS.avance);
    const campoClave    = findColumn(columnas, ALIAS.clave_unica);
    const campoLongKm   = findColumn(columnas, ALIAS.longitud_km);
    if (!campoId) continue;

    const rows = await query(
      `SELECT ${qid(campoId)}::text AS id,
              ${campoPrograma ? `${qid(campoPrograma)}::text` : "NULL::text"} AS programa,
              ${campoDg ? `${qid(campoDg)}::text` : "NULL::text"} AS dg,
              ${campoEstatus ? `${qid(campoEstatus)}::text` : "NULL::text"} AS estatus,
              ${campoAvance ? `NULLIF(${qid(campoAvance)}::text, '')::numeric` : "NULL::numeric"} AS avance,
              ${campoClave ? `${qid(campoClave)}::text` : "NULL::text"} AS clave_unica,
              ${campoLongKm ? `${qid(campoLongKm)}::numeric` : "NULL::numeric"} AS longitud_km
       FROM ${qid(SCHEMA)}.${qid(tablaActual)}`
    );
    for (const r of rows.rows) {
      dim.set(`${tablaActual}::${r.id}`, {
        programa: r.programa ? r.programa.toUpperCase().trim() : null,
        dg: r.dg ? r.dg.toUpperCase().trim() : null,
        /* Estatus EN VIVO de la tabla — nunca el del último snapshot semanal,
           que puede quedar desfasado si la obra cambió de estatus después de
           la última captura (ej. llegó a TERMINADA esta semana). */
        estatus: normalizarEstatus(r.estatus),
        /* Avance EN VIVO — usado solo para que calcularAlertas() no dictamine
           contra una foto semanal vieja (ver conPuntoVivo). No sustituye al
           avance_actual de la serie semanal en ningún otro cálculo. */
        avance: r.avance !== null ? Number(r.avance) : null,
        /* clave_unica — solo se usa para CONSTRUCCION DE UTOPIAS, para poder
           recalcular su foco rojo desde los frentes (ver getResumenAlertas). */
        clave_unica: r.clave_unica || null,
        /* Longitud propia de la obra — solo aplica a programas modo KM
           (ver obtenerProgramasAvanceEsperado / calcularFocoAmarillo). */
        longitud_km: r.longitud_km !== null ? Number(r.longitud_km) : null,
      });
    }
  }

  _dimCache = dim;
  _dimCacheTs = Date.now();
  return dim;
}

/* ── Foco amarillo — avance esperado vs avance real ──
   Decisión 2026-06-25: se compara semana vs semana anterior (variación
   semanal real) contra el ritmo esperado de sig_sobse.programas_avance_esperado
   — NO se acumula desde una fecha de inicio (no existe de forma confiable
   en obras_puntos/lineas/poligonos). Brecha > 5pp dispara la alerta.
   Independiente del foco rojo: una obra puede tener ambos a la vez. */
const FOCO_AMARILLO_UMBRAL_PP = 5;
const PROGRAMAS_CACHE_TTL = 5 * 60 * 1000;
let _programasCache = null;
let _programasCacheTs = 0;

async function obtenerProgramasAvanceEsperado() {
  if (_programasCache && Date.now() - _programasCacheTs < PROGRAMAS_CACHE_TTL) return _programasCache;
  const res = await query(
    `SELECT programa, modo, avance_semanal_pct, constante_km_semana
     FROM ${qid(SCHEMA)}.programas_avance_esperado`
  );
  const mapa = new Map();
  for (const r of res.rows) {
    mapa.set(String(r.programa).toUpperCase().trim(), {
      modo: r.modo,
      avance_semanal_pct: r.avance_semanal_pct !== null ? Number(r.avance_semanal_pct) : null,
      constante_km_semana: r.constante_km_semana !== null ? Number(r.constante_km_semana) : null,
    });
  }
  _programasCache = mapa;
  _programasCacheTs = Date.now();
  return mapa;
}

/* ritmoEsperadoPct: % esperado de avance en UNA semana para esta obra/frente,
   o null si el programa es NO_APLICA / no está en la tabla / falta longitud
   en modo KM. variacionSemanalReal: avance_actual - avance_anterior, ya en
   escala 0-100. */
function calcularFocoAmarillo(variacionSemanalReal, ritmoEsperadoPct) {
  if (ritmoEsperadoPct === null || ritmoEsperadoPct === undefined) return null;
  if (variacionSemanalReal === null || variacionSemanalReal === undefined) return null;
  const brecha = ritmoEsperadoPct - variacionSemanalReal;
  if (brecha <= FOCO_AMARILLO_UMBRAL_PP) return null;

  /* "Avanzó 0.0%" es contradictorio — si la variación (ya redondeada a 1
     decimal, igual que se muestra) es 0 o negativa, lo correcto es decir
     que repitió el porcentaje anterior, no que "avanzó" esa cantidad. */
  const variacion = Number(variacionSemanalReal.toFixed(1));
  const descripcion = variacion <= 0
    ? `Repitió el porcentaje anterior (sin avance esta semana), se esperaba un ritmo de ${ritmoEsperadoPct.toFixed(1)}% (diferencia de ${brecha.toFixed(1)}pp)`
    : `Avanzó ${variacion.toFixed(1)}% esta semana, se esperaba ${ritmoEsperadoPct.toFixed(1)}% (diferencia de ${brecha.toFixed(1)}pp)`;

  return { tipo: "FOCO_AMARILLO", codigo: "AVANCE_RETRASADO", descripcion };
}

/* Resuelve el ritmo esperado (%/semana) de una obra dado su programa y,
   si el modo es KM, su longitud propia. Devuelve null si no aplica. */
function resolverRitmoEsperado(programaNorm, longitudKm, lookup) {
  const cfg = lookup.get(String(programaNorm || "").toUpperCase().trim());
  if (!cfg || cfg.modo === "NO_APLICA") return null;
  if (cfg.modo === "PORCENTAJE") return cfg.avance_semanal_pct;
  if (cfg.modo === "KM") {
    if (!Number.isFinite(longitudKm) || longitudKm <= 0 || !cfg.constante_km_semana) return null;
    const semanas = longitudKm / cfg.constante_km_semana;
    return semanas > 0 ? 100 / semanas : null;
  }
  return null;
}

exports.getResumenAlertas = async (req, res) => {
  try {
    const { nivel, clave } = req.query;
    if (!["programa", "dg"].includes(nivel) || !clave) {
      return res.status(400).json({
        success: false,
        message: 'nivel ("programa" o "dg") y clave son requeridos.',
        code: "MISSING_FIELDS",
      });
    }
    const claveNorm = String(clave).toUpperCase().trim();

    const snapsRes = await query(
      `SELECT tabla, obra_id, anio, semana, avance, estatus, fecha, nombre_sitio
       FROM ${qid(SCHEMA)}.snapshots_semanales
       ORDER BY tabla, obra_id, anio, semana::int`
    );

    const tablasDistintas = [...new Set(snapsRes.rows.map((r) => r.tabla))];
    const dimPorTablaId = await obtenerDimensionObras(tablasDistintas);

    const porObra = new Map();
    for (const r of snapsRes.rows) {
      const key = `${r.tabla}::${r.obra_id}`;
      const dim = dimPorTablaId.get(key);
      if (!dim) continue;
      const valorNivel = nivel === "programa" ? dim.programa : dim.dg;
      if (valorNivel !== claveNorm) continue;

      if (!porObra.has(key)) {
        porObra.set(key, { tabla: r.tabla, obra_id: r.obra_id, nombre_sitio: r.nombre_sitio, programa: dim.programa, estatusVivo: dim.estatus, avanceVivo: dim.avance, claveUnica: dim.clave_unica, longitudKm: dim.longitud_km, puntos: [] });
      }
      const entry = porObra.get(key);
      entry.nombre_sitio = r.nombre_sitio; // se sobreescribe en orden ascendente → queda el más reciente
      const motivoAnomalia = esAnomalia(r.tabla, r.anio, Number(r.semana));
      entry.puntos.push({
        periodo: `${r.anio}-W${r.semana}`,
        avance: r.avance !== null ? Number(r.avance) : null,
        estatus: normalizarEstatus(r.estatus),
        anomalia: !!motivoAnomalia,
        fecha: r.fecha,
      });
    }

    let totalEstancada = 0;
    let totalRetroceso = 0;
    let totalAmarillo = 0;
    const programasLookup = await obtenerProgramasAvanceEsperado();
    const detalle = [];
    /* avances: TODAS las obras (no solo las que tienen alerta) — para que
       los reportes (Programa/Secretario/Mundial) puedan mostrar avance
       anterior/actual por fila sin hacer una llamada por obra. `detalle`
       NO se toca: sigue siendo solo-alertadas porque agruparFocosRojosPorPrograma()
       ya depende de ese conteo en el frontend. */
    const avances = [];

    for (const obra of porObra.values()) {
      const esUtopia = String(obra.programa || "").toUpperCase().trim() === "CONSTRUCCION DE UTOPIAS";

      /* CONSTRUCCION DE UTOPIAS: la columna de avance de la obra está
         congelada (el avance real se calcula en frontend desde los frentes
         de uto_2025), así que su foco rojo NUNCA sale de snapshots_semanales
         — se recalcula desde los frentes (ver construirResumenFrentesUtopia).
         Criterio: basta 1 solo frente con alerta activa para marcar la obra
         completa (decisión 2026-06-25, mismo criterio que obras normales). */
      if (esUtopia) {
        if (!obra.claveUnica) continue;
        const resFrentes = await construirResumenFrentesUtopia(obra.claveUnica);

        /* Avance ponderado por monto (ya calculado en construirResumenFrentesUtopia) —
           sin esto el reporte no tiene de dónde sacar el % y muestra "—" para
           todas las obras de UTOPÍAS, tengan o no alerta. */
        avances.push({
          tabla: obra.tabla,
          obra_id: obra.obra_id,
          avance_actual: resFrentes.evolucion_obra.avance_actual,
          avance_anterior: resFrentes.evolucion_obra.avance_anterior,
          serie_corta: resFrentes.evolucion_obra.serie.slice(-6).map((p) => p.avance),
        });

        const frentesConAlerta = resFrentes.frentes.filter((f) => f.alertas.length > 0);
        if (frentesConAlerta.length === 0) continue;

        const tieneEstancada = frentesConAlerta.some((f) => f.alertas.some((a) => a.codigo === "ESTANCADA"));
        const tieneRetroceso = frentesConAlerta.some((f) => f.alertas.some((a) => a.codigo === "RETROCESO_DETECTADO"));
        const tieneAmarillo  = frentesConAlerta.some((f) => f.alertas.some((a) => a.codigo === "AVANCE_RETRASADO"));
        if (tieneEstancada) totalEstancada++;
        if (tieneRetroceso) totalRetroceso++;
        if (tieneAmarillo) totalAmarillo++;

        /* Nombres, no solo el conteo — sin esto el reporte dice "4 frentes
           sin avance" y la primera pregunta de quien lo lee es "¿cuáles?". */
        const alertasObra = [];
        if (tieneEstancada) {
          const nombres = frentesConAlerta.filter((f) => f.alertas.some((a) => a.codigo === "ESTANCADA")).map((f) => f.nombre_frente);
          alertasObra.push({ codigo: "ESTANCADA", descripcion: `Frentes sin avance: ${nombres.join(", ")}` });
        }
        if (tieneRetroceso) {
          const detRetroceso = frentesConAlerta
            .filter((f) => f.alertas.some((a) => a.codigo === "RETROCESO_DETECTADO"))
            .map((f) => {
              const a = f.alertas.find((a) => a.codigo === "RETROCESO_DETECTADO");
              return a ? `${f.nombre_frente} (${a.descripcion})` : f.nombre_frente;
            });
          alertasObra.push({ codigo: "RETROCESO_DETECTADO", descripcion: `Frentes con retroceso: ${detRetroceso.join("; ")}` });
        }
        if (tieneAmarillo) {
          const nombres = frentesConAlerta.filter((f) => f.alertas.some((a) => a.codigo === "AVANCE_RETRASADO")).map((f) => f.nombre_frente);
          alertasObra.push({ codigo: "AVANCE_RETRASADO", descripcion: `Frentes por debajo del ritmo esperado: ${nombres.join(", ")}` });
        }

        detalle.push({
          tabla: obra.tabla,
          obra_id: obra.obra_id,
          programa: obra.programa || null,
          nombre_obra: obra.nombre_sitio || "SIN DATO",
          alertas: alertasObra,
        });
        continue;
      }

      const serieValida = obra.puntos.filter((p) => !p.anomalia && p.avance !== null);
      if (serieValida.length === 0) continue;

      /* Estatus EN VIVO (tabla actual), no el del último snapshot — una obra
         puede llegar a TERMINADA/INAUGURADA/CANCELADO después de la última
         captura semanal y el snapshot seguiría mostrando el estatus viejo. */
      const estatusActualNorm = obra.estatusVivo || serieValida[serieValida.length - 1].estatus;

      /* avance_actual/avance_anterior y la variación semanal deben reflejar
         el valor EN VIVO, no la foto semanal vieja si el operador ya
         actualizó hoy y el cron semanal todavía no capturó ese dato (ver
         conPuntoVivo). Sin punto vivo nuevo, serieParaAlertas === serieValida
         y el resultado es idéntico al de antes. */
      const serieParaAlertas = conPuntoVivo(serieValida, obra.avanceVivo, estatusActualNorm);
      const actual = serieParaAlertas[serieParaAlertas.length - 1];
      const anterior = serieParaAlertas.length >= 2 ? serieParaAlertas[serieParaAlertas.length - 2] : null;
      avances.push({
        tabla: obra.tabla,
        obra_id: obra.obra_id,
        avance_actual: actual.avance,
        avance_anterior: anterior ? anterior.avance : null,
        /* Últimos 6 puntos válidos — solo para sparkline (tendencia visual),
           no para cálculos. Mantiene el payload acotado incluso con muchas
           obras por programa/DG. */
        serie_corta: serieValida.slice(-6).map((p) => p.avance),
      });

      /* Una obra terminada/inaugurada (o al 100%, aunque el texto de estatus
         no se haya actualizado) nunca puede ser foco — ni rojo ni amarillo.
         RETROCESO_DETECTADO es persistente por diseño dentro de calcularAlertas
         (no respeta estatus por su cuenta), así que aquí se fuerza vacío para
         que un retroceso de hace meses, ya con la obra entregada, no siga
         contando como alerta activa. El historial sigue visible en la serie
         del Seguimiento — esto solo afecta si cuenta como foco activo. */
      const obraTerminadaOCompleta = ESTATUS_SIN_ESTANCAMIENTO.includes(estatusActualNorm) || (obra.avanceVivo !== null && obra.avanceVivo >= 100);
      const alertasRojo = (!obraTerminadaOCompleta && tieneAlertasHabilitadas(obra.programa)) ? calcularAlertas(serieParaAlertas, estatusActualNorm) : [];
      const variacionSemanalReal = anterior ? +(actual.avance - anterior.avance).toFixed(2) : null;
      const ritmoEsperado = resolverRitmoEsperado(obra.programa, obra.longitudKm, programasLookup);
      /* El rojo tiene prioridad: si ya hay estancada/retroceso, el amarillo
         no aporta nada nuevo, solo ruido — nunca se muestran ambos a la vez. */
      const alertaAmarillo = (obraTerminadaOCompleta || alertasRojo.length > 0) ? null : calcularFocoAmarillo(variacionSemanalReal, ritmoEsperado);

      const alertas = [...alertasRojo, ...(alertaAmarillo ? [alertaAmarillo] : [])];
      if (alertas.length === 0) continue;

      if (alertas.some((a) => a.codigo === "ESTANCADA")) totalEstancada++;
      if (alertas.some((a) => a.codigo === "RETROCESO_DETECTADO")) totalRetroceso++;
      if (alertas.some((a) => a.codigo === "AVANCE_RETRASADO")) totalAmarillo++;

      detalle.push({
        tabla: obra.tabla,
        obra_id: obra.obra_id,
        programa: obra.programa || null,
        nombre_obra: obra.nombre_sitio || "SIN DATO",
        alertas: alertas.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion })),
      });
    }

    res.json({
      success: true,
      nivel,
      clave,
      total_obras: porObra.size,
      obras_con_alerta: detalle.length,
      focos_rojos: { estancada: totalEstancada, retroceso: totalRetroceso },
      focos_amarillos: { avance_retrasado: totalAmarillo },
      detalle,
      avances,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Resumen semanal público — Nivel Obra ──
   Expone serie completa, indicadores, hitos, alertas y bitácora de cambios
   (usuario + % anterior/nuevo + fecha) — todo derivado de snapshots_semanales
   + auditoria. `usuario` aquí es la cuenta de la DG (ej. "actualizacion_dgcop"),
   no una persona — son ~8 cuentas compartidas por DG, no hay granularidad
   individual en este sistema, por eso es seguro exponerlo públicamente.
   NUNCA se expone `motivo` (texto libre, sin garantía de contenido). */
exports.getResumenObraSemanal = async (req, res) => {
  try {
    const { tabla, id } = req.query;
    if (!tabla || id === undefined || id === null || id === "") {
      return res.status(400).json({ success: false, message: "tabla e id son requeridos.", code: "MISSING_FIELDS" });
    }

    const tablaReal = await resolverTabla(tabla);
    if (!tablaReal) {
      return res.status(400).json({ success: false, message: `La tabla "${tabla}" no existe.`, code: "TABLA_INVALIDA" });
    }

    const obraIdInt = parseInt(id, 10);
    if (Number.isNaN(obraIdInt)) {
      return res.status(400).json({ success: false, message: "id debe ser numérico.", code: "ID_INVALIDO" });
    }

    const [columnas, snapsRes, eventosRes] = await Promise.all([
      columnasDe(tablaReal),
      query(
        `SELECT anio, semana, avance, estatus, fecha
         FROM ${qid(SCHEMA)}.snapshots_semanales
         WHERE tabla = $1 AND obra_id = $2
         ORDER BY anio, semana::int`,
        [tablaReal, obraIdInt]
      ),
      /* usuario + porcentajes para la bitácora pública — nunca motivo (texto libre). */
      query(
        `SELECT timestamp, delta, usuario, porcentaje_anterior, porcentaje_nuevo, "ESTATUS ANTERIOR", "ESTATUS NUEVO"
         FROM ${qid(SCHEMA)}.auditoria
         WHERE tabla = $1 AND obra_id = $2
         ORDER BY timestamp`,
        [tablaReal, obraIdInt]
      ),
    ]);

    /* Estatus EN VIVO de la tabla — una sola obra, costo despreciable.
       Nunca confiar en el estatus del último snapshot semanal para decidir
       si una alerta aplica: la obra puede haber llegado a TERMINADA/
       INAUGURADA/CANCELADO después de la última captura. */
    const campoIdLive = findColumn(columnas, ALIAS.id);
    const campoEstatusLive = findColumn(columnas, ALIAS.estatus);
    const campoProgramaLive = findColumn(columnas, ALIAS.programa);
    const campoAvanceLive = findColumn(columnas, ALIAS.avance);
    const campoLongKmLive = findColumn(columnas, ALIAS.longitud_km);
    let estatusVivo = null;
    let programaVivo = null;
    let avanceVivo = null;
    let longitudKmVivo = null;
    if (campoIdLive && (campoEstatusLive || campoProgramaLive || campoAvanceLive || campoLongKmLive)) {
      const filaRes = await query(
        `SELECT ${campoEstatusLive ? `${qid(campoEstatusLive)}::text` : "NULL::text"} AS estatus,
                ${campoProgramaLive ? `${qid(campoProgramaLive)}::text` : "NULL::text"} AS programa,
                ${campoAvanceLive ? `NULLIF(${qid(campoAvanceLive)}::text, '')::numeric` : "NULL::numeric"} AS avance,
                ${campoLongKmLive ? `${qid(campoLongKmLive)}::numeric` : "NULL::numeric"} AS longitud_km
         FROM ${qid(SCHEMA)}.${qid(tablaReal)}
         WHERE ${qid(campoIdLive)}::text = $1
         LIMIT 1`,
        [String(obraIdInt)]
      );
      if (filaRes.rows[0]?.estatus) estatusVivo = normalizarEstatus(filaRes.rows[0].estatus);
      programaVivo = filaRes.rows[0]?.programa || null;
      avanceVivo = filaRes.rows[0]?.avance !== null && filaRes.rows[0]?.avance !== undefined ? Number(filaRes.rows[0].avance) : null;
      longitudKmVivo = filaRes.rows[0]?.longitud_km !== null && filaRes.rows[0]?.longitud_km !== undefined ? Number(filaRes.rows[0].longitud_km) : null;
    }

    const serie = snapsRes.rows.map((r) => {
      const motivoAnomalia = esAnomalia(tablaReal, r.anio, Number(r.semana));
      return {
        periodo: `${r.anio}-W${r.semana}`,
        semana: Number(r.semana),
        anio: r.anio,
        avance: r.avance !== null ? Number(r.avance) : null,
        estatus: normalizarEstatus(r.estatus),
        anomalia: !!motivoAnomalia,
        fecha: r.fecha,
        ...(motivoAnomalia ? { motivo_anomalia: motivoAnomalia } : {}),
      };
    });
    const serieValida = serie.filter((p) => !p.anomalia && p.avance !== null);

    const estatusAproximado = estatusVivo || (serieValida.length ? serieValida[serieValida.length - 1].estatus : "SIN INICIAR");

    /* "Semana actual"/"variación semanal" deben reflejar el valor EN VIVO
       contra la última semana capturada, no quedarse con la foto semanal
       vieja si el operador ya actualizó hoy y el cron semanal todavía no
       capturó ese dato (ver conPuntoVivo). Sin punto vivo nuevo,
       serieParaAlertas === serieValida y el resultado es idéntico al de
       antes. semana_actual.periodo nunca se muestra en el frontend, así
       que no importa que diga "ACTUAL" en vez de un periodo real. */
    const serieParaAlertas = conPuntoVivo(serieValida, avanceVivo, estatusAproximado);

    /* Una obra terminada/inaugurada (o al 100%) nunca puede ser foco — ni
       rojo ni amarillo. RETROCESO_DETECTADO es persistente por diseño dentro
       de calcularAlertas (no respeta estatus por su cuenta), así que aquí se
       fuerza vacío para que un retroceso de hace meses, ya con la obra
       entregada, no siga contando como alerta activa. El histórico semanal
       (serie/indicadores, devueltos más abajo) no se toca — solo afecta si
       cuenta como foco activo. */
    const obraTerminadaOCompleta = ESTATUS_SIN_ESTANCAMIENTO.includes(estatusAproximado) || (avanceVivo !== null && avanceVivo >= 100);
    const alertasRojo = (!obraTerminadaOCompleta && tieneAlertasHabilitadas(programaVivo)) ? calcularAlertas(serieParaAlertas, estatusAproximado) : [];

    const semanaActual = serieParaAlertas[serieParaAlertas.length - 1] || null;
    const semanaAnterior = serieParaAlertas.length >= 2 ? serieParaAlertas[serieParaAlertas.length - 2] : null;
    const variacionSemanal =
      semanaActual && semanaAnterior ? +(semanaActual.avance - semanaAnterior.avance).toFixed(2) : null;

    const programasLookup = await obtenerProgramasAvanceEsperado();
    const ritmoEsperado = resolverRitmoEsperado(programaVivo, longitudKmVivo, programasLookup);
    /* El rojo tiene prioridad: si ya hay estancada/retroceso, el amarillo no
       aporta nada nuevo, solo ruido — nunca se muestran ambos a la vez. */
    const alertaAmarillo = (obraTerminadaOCompleta || alertasRojo.length > 0) ? null : calcularFocoAmarillo(variacionSemanal, ritmoEsperado);
    const alertas = [...alertasRojo, ...(alertaAmarillo ? [alertaAmarillo] : [])];
    const indicadores = calcularIndicadores(serieValida);
    indicadores.semanas_excluidas_por_anomalia = serie.filter((p) => p.anomalia).length;

    let tiempoPromedio = null;
    if (eventosRes.rows.length >= 2) {
      const tiempos = eventosRes.rows.map((r) => new Date(r.timestamp).getTime());
      const diffs = [];
      for (let i = 1; i < tiempos.length; i++) diffs.push(tiempos[i] - tiempos[i - 1]);
      tiempoPromedio = +(diffs.reduce((s, d) => s + d, 0) / diffs.length / 86400000).toFixed(1);
    }
    indicadores.tiempo_promedio_entre_actualizaciones_dias = tiempoPromedio;
    indicadores.proxima_a_terminar =
      (semanaActual?.avance ?? 0) >= 90 && estatusAproximado === "EN PROCESO";
    indicadores.lista_para_inauguracion =
      (semanaActual?.avance ?? 0) >= 100 && estatusAproximado === "TERMINADA";

    const hitos = construirHitos(eventosRes.rows);

    const eventos = eventosRes.rows.map((r) => ({
      timestamp: r.timestamp,
      usuario: r.usuario,
      porcentaje_anterior: r.porcentaje_anterior !== null ? Number(r.porcentaje_anterior) : null,
      porcentaje_nuevo: r.porcentaje_nuevo !== null ? Number(r.porcentaje_nuevo) : null,
    }));

    res.json({
      success: true,
      tabla: tablaReal,
      id: obraIdInt,
      semana_actual: semanaActual ? { periodo: semanaActual.periodo, avance: semanaActual.avance, fecha: semanaActual.fecha } : null,
      semana_anterior: semanaAnterior ? { periodo: semanaAnterior.periodo, avance: semanaAnterior.avance, fecha: semanaAnterior.fecha } : null,
      variacion_semanal: variacionSemanal,
      alertas: alertas.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion })),
      serie,
      indicadores,
      hitos,
      eventos,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Resumen de Focos Rojos por FRENTE — Nivel UTOPÍA ──
   Capa nueva e independiente de getResumenAlertas/getResumenObraSemanal:
   NO se integra a esos endpoints, NO toca PROGRAMAS_SIN_ALERTAS (la obra
   UTOPIA sigue excluida de alertas a su propio nivel, sin cambios). Aquí
   el foco rojo se calcula por frente, reutilizando calcularAlertas() tal
   cual — mismo algoritmo, sin duplicar lógica.
   Fuente: tabla viva uto_2025 (frentes actuales) + snapshots_frentes_utopias
   (tabla hija dedicada, migración 008 — separada de snapshots_semanales a
   propósito: nunca compite por filas con el histórico de obras normales, y
   distingue origen='cron'|'backfill' — ver semanaService.js).
   GET /api/evolucion/frentes-resumen?clave=<clave_unica de la obra UTOPIA> */
/* Compartida entre getResumenFrentesObra (detalle público de una obra) y
   getResumenAlertas (conteo de Programa/DG): UTOPIAS no tiene avance propio
   confiable a nivel obra (columna congelada), así que su foco rojo a nivel
   obra se decide aquí, a partir de sus frentes — cualquier frente con
   alerta activa basta para marcar la obra completa, mismo criterio que
   obras normales (decisión 2026-06-25). */
async function construirResumenFrentesUtopia(claveUnica) {
  const [frentesRes, cargaRes] = await Promise.all([
    query(
      `SELECT id, frente, avance_real, estatus, monto_con_iva
       FROM ${qid(SCHEMA)}.uto_2025
       WHERE clave_unica = $1
       ORDER BY frente`,
      [String(claveUnica)]
    ),
    query(
      `SELECT MAX(updated_at) AS ultima_carga FROM ${qid(SCHEMA)}.uto_2025 WHERE clave_unica = $1`,
      [String(claveUnica)]
    ),
  ]);
  const ultimaCargaUtopias = cargaRes.rows[0]?.ultima_carga ?? null;

  if (frentesRes.rows.length === 0) {
    return {
      clave_unica: claveUnica,
      frentes: [],
      resumen: { total_frentes: 0, frentes_con_alerta: 0, focos_rojos: { estancada: 0, retroceso: 0 } },
      evolucion_obra: { serie: [], alertas: [], avance_actual: null, avance_anterior: null, variacion_semanal: null, ultima_carga_utopias: null },
    };
  }

    const frenteIds = frentesRes.rows.map((f) => f.id);
    const snapsRes = await query(
      `SELECT frente_id AS obra_id, anio, semana, avance, estatus, fecha
       FROM ${qid(SCHEMA)}.snapshots_frentes_utopias
       WHERE frente_id = ANY($1::integer[])
       ORDER BY frente_id, anio, semana::int`,
      [frenteIds]
    );

    const snapsPorFrente = new Map();
    for (const r of snapsRes.rows) {
      if (!snapsPorFrente.has(r.obra_id)) snapsPorFrente.set(r.obra_id, []);
      snapsPorFrente.get(r.obra_id).push(r);
    }

    let totalEstancada = 0, totalRetroceso = 0, totalAmarillo = 0;
    /* CONSTRUCCION DE UTOPIAS siempre es modo PORCENTAJE (2.0%/semana) — un
       solo lookup, mismo ritmo para todos los frentes de cualquier utopía. */
    const programasLookup = await obtenerProgramasAvanceEsperado();
    const ritmoEsperadoUtopias = resolverRitmoEsperado("CONSTRUCCION DE UTOPIAS", null, programasLookup);
    const frentes = frentesRes.rows.map((f) => {
      const snaps = snapsPorFrente.get(f.id) || [];
      /* uto_2025.avance_real SIEMPRE se guarda en escala decimal 0-1
         (importarDesdeExcel aplica toDecimal() en cada carga, sin excepción
         — a diferencia de los históricos crudos de UTP, que sí mezclaban
         escalas). El snapshot semanal genérico no escala nada al capturar,
         así que aquí se normaliza a 0-100 para que serie/avance_actual y los
         mensajes de calcularAlertas (que embeben "%") sean consistentes. */
      const serie = snaps.map((r) => ({
        periodo: `${r.anio}-W${r.semana}`,
        semana: Number(r.semana),
        anio: r.anio,
        avance: r.avance !== null ? Math.round(Number(r.avance) * 100 * 100) / 100 : null,
        estatus: normalizarEstatus(r.estatus),
        fecha: r.fecha,
      }));
      const serieValida = serie.filter((p) => p.avance !== null);
      const estatusActualNorm = normalizarEstatus(f.estatus);
      /* RETROCESO_DETECTADO es persistente para siempre por diseño (ver
         calcularAlertas) y no respeta estatus terminal — correcto para
         obras normales (queda como bandera histórica), pero en frentes
         INAUGURADA/TERMINADA/CANCELADO no debe seguir mostrando un retroceso
         de hace meses como si fuera un problema activo. Se fuerza vacío aquí.
         Tampoco se evalúan frentes de SUPERVISIÓN: su avance no está
         homologado entre semanas (contratos distintos bajo el mismo nombre,
         ej. "Sup. Obras exteriores") y genera falsos focos rojos. */
      const esSupervision = /^SUP\.?\s|SUPERVISI[OÓ]N/i.test(String(f.frente || "").trim());
      /* El texto de estatus en uto_2025 a veces no se actualiza aunque el
         avance ya llegue a 100% (queda "EN PROCESO" desactualizado) — un
         frente completo nunca debe contar como foco rojo, sin importar lo
         que diga ese texto. */
      const avanceCompleto = f.avance_real !== null && Number(f.avance_real) >= 1;
      const esTerminalOExcluido = ESTATUS_SIN_ESTANCAMIENTO.includes(estatusActualNorm) || esSupervision || avanceCompleto;

      /* La variación semanal (y por tanto el foco rojo/amarillo) deben
         comparar contra el avance EN VIVO de uto_2025, no quedarse con la
         última foto semanal si el frente ya se actualizó hoy y el cron
         semanal todavía no la capturó (mismo criterio que obras normales,
         ver conPuntoVivo). Sin punto vivo nuevo, serieParaAlertas ===
         serieValida y el resultado es idéntico al de antes. */
      const avanceVivoFrente = f.avance_real !== null ? Number(f.avance_real) * 100 : null;
      const serieParaAlertas = conPuntoVivo(serieValida, avanceVivoFrente, estatusActualNorm);
      const alertasRojo = esTerminalOExcluido ? [] : calcularAlertas(serieParaAlertas, estatusActualNorm);

      const actual = serieParaAlertas[serieParaAlertas.length - 1] || null;
      const anterior = serieParaAlertas.length >= 2 ? serieParaAlertas[serieParaAlertas.length - 2] : null;
      const variacionSemanal = actual && anterior ? +(actual.avance - anterior.avance).toFixed(2) : null;

      /* Mismo criterio que el foco rojo: un frente terminal/excluido tampoco
         puede estar "retrasado" — ya no aplica una meta de ritmo semanal.
         Tampoco si ya está estancado/con retroceso: el rojo tiene prioridad,
         el amarillo encima solo mete ruido. */
      const alertaAmarillo = (esTerminalOExcluido || alertasRojo.length > 0) ? null : calcularFocoAmarillo(variacionSemanal, ritmoEsperadoUtopias);
      const alertas = [...alertasRojo, ...(alertaAmarillo ? [alertaAmarillo] : [])];

      if (alertas.some((a) => a.codigo === "ESTANCADA")) totalEstancada++;
      if (alertas.some((a) => a.codigo === "RETROCESO_DETECTADO")) totalRetroceso++;
      if (alertas.some((a) => a.codigo === "AVANCE_RETRASADO")) totalAmarillo++;

      return {
        frente_id: f.id,
        nombre_frente: f.frente,
        estatus_actual: estatusActualNorm,
        avance_actual: actual ? actual.avance : null,
        avance_anterior: anterior ? anterior.avance : null,
        variacion_semanal: variacionSemanal,
        serie,
        alertas: alertas.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion })),
      };
    });

    /* ── Evolución general de la obra — promedio simple de todos los frentes,
       semana a semana. Se agrega cada frente con el mismo peso (1 frente = 1 voto). */
    const porPeriodo = new Map();
    for (const f of frentes) {
      for (const p of f.serie) {
        if (p.avance === null) continue;
        if (!porPeriodo.has(p.periodo)) porPeriodo.set(p.periodo, { semana: p.semana, anio: p.anio, fecha: p.fecha, num: 0, den: 0 });
        const acc = porPeriodo.get(p.periodo);
        acc.num += p.avance;
        acc.den += 1;
      }
    }
    const serieObra = [...porPeriodo.values()]
      .filter((a) => a.den > 0)
      .map((a) => ({
        periodo: `${a.anio}-W${a.semana}`,
        semana: a.semana,
        anio: a.anio,
        avance: Math.round((a.num / a.den) * 100) / 100,
        fecha: a.fecha,
      }))
      .sort((a, b) => a.anio - b.anio || a.semana - b.semana);

    let numVivo = 0, denVivo = 0;
    for (const f of frentes) {
      if (f.avance_actual === null) continue;
      numVivo += f.avance_actual;
      denVivo += 1;
    }
    const avanceVivoObra = denVivo > 0 ? Math.round((numVivo / denVivo) * 100) / 100 : null;

    const obraTerminada = frentes.length > 0 && frentes.every((f) => ESTATUS_SIN_ESTANCAMIENTO.includes(f.estatus_actual));
    const estatusObraAprox = obraTerminada ? "TERMINADA" : "EN PROCESO";
    const serieObraParaAlertas = conPuntoVivo(serieObra, avanceVivoObra, estatusObraAprox);
    /* Igual que por frente: RETROCESO_DETECTADO ignora estatus por diseño,
       se fuerza vacío aquí si la obra ya está terminada/inaugurada. */
    const alertasObra = obraTerminada ? [] : calcularAlertas(serieObraParaAlertas, estatusObraAprox);

    const actualObra = serieObra[serieObra.length - 1] || null;
    const anteriorObra = serieObra.length >= 2 ? serieObra[serieObra.length - 2] : null;

  return {
    clave_unica: claveUnica,
    frentes,
    resumen: {
      total_frentes: frentes.length,
      frentes_con_alerta: frentes.filter((f) => f.alertas.length > 0).length,
      focos_rojos: { estancada: totalEstancada, retroceso: totalRetroceso },
      focos_amarillos: { avance_retrasado: totalAmarillo },
    },
    evolucion_obra: {
      serie: serieObra,
      alertas: alertasObra.map((a) => ({ codigo: a.codigo, descripcion: a.descripcion })),
      avance_actual: avanceVivoObra,
      avance_anterior: anteriorObra ? anteriorObra.avance : null,
      variacion_semanal: avanceVivoObra !== null && anteriorObra ? +(avanceVivoObra - anteriorObra.avance).toFixed(2) : null,
      ultima_carga_utopias: ultimaCargaUtopias,
    },
  };
}

exports.getResumenFrentesObra = async (req, res) => {
  try {
    const { clave } = req.query;
    if (!clave) {
      return res.status(400).json({ success: false, message: "clave (clave_unica) es requerido.", code: "MISSING_FIELDS" });
    }
    const resultado = await construirResumenFrentesUtopia(clave);
    res.json({ success: true, ...resultado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEvolucionObra = async (req, res) => {
  try {
    const { tabla, id } = req.query;
    if (!tabla || id === undefined || id === null || id === "") {
      return res.status(400).json({ success: false, message: "tabla e id son requeridos.", code: "MISSING_FIELDS" });
    }

    const tablaReal = await resolverTabla(tabla);
    if (!tablaReal) {
      return res.status(400).json({ success: false, message: `La tabla "${tabla}" no existe.`, code: "TABLA_INVALIDA" });
    }

    const columnas = await columnasDe(tablaReal);
    const campos = Object.fromEntries(
      Object.entries(ALIAS).map(([key, aliases]) => [key, findColumn(columnas, aliases)])
    );

    if (!campos.id) {
      return res.status(400).json({ success: false, message: `La tabla "${tablaReal}" no tiene columna id compatible.`, code: "ID_COLUMN_MISSING" });
    }

    const filaRes = await query(
      `SELECT
         ${qid(campos.id)}::text AS id,
         ${campos.nombre ? `${qid(campos.nombre)}::text` : "NULL::text"} AS nombre_obra,
         ${campos.programa ? `${qid(campos.programa)}::text` : "NULL::text"} AS programa,
         ${campos.dg ? `${qid(campos.dg)}::text` : "NULL::text"} AS seguimiento,
         ${campos.alcaldia ? `${qid(campos.alcaldia)}::text` : "NULL::text"} AS alcaldia,
         ${campos.estatus ? `${qid(campos.estatus)}::text` : "NULL::text"} AS estatus_actual,
         ${campos.avance ? `${qid(campos.avance)}::text` : "NULL::text"} AS avance_actual,
         ${campos.clave_unica ? `${qid(campos.clave_unica)}::text` : "NULL::text"} AS clave_unica,
         ${campos.fecha_inauguracion ? `${qid(campos.fecha_inauguracion)}::text` : "NULL::text"} AS fecha_inauguracion
       FROM ${qid(SCHEMA)}.${qid(tablaReal)}
       WHERE ${qid(campos.id)}::text = $1
       LIMIT 1`,
      [String(id)]
    );

    if (filaRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }
    const fila = filaRes.rows[0];
    const avanceActual = Number(String(fila.avance_actual || "0").replace(",", ".")) || 0;
    const estatusActualNorm = normalizarEstatus(fila.estatus_actual);

    const obraIdInt = parseInt(fila.id, 10);

    const [snapshotRes, eventosRes] = await Promise.all([
      query(
        `SELECT anio, semana, avance, estatus, fecha
         FROM ${qid(SCHEMA)}.snapshots_semanales
         WHERE tabla = $1 AND obra_id = $2
         ORDER BY anio, semana::int`,
        [tablaReal, obraIdInt]
      ),
      query(
        `SELECT timestamp, usuario, accion, motivo,
                porcentaje_anterior, porcentaje_nuevo, delta,
                "ESTATUS ANTERIOR", "ESTATUS NUEVO"
         FROM ${qid(SCHEMA)}.auditoria
         WHERE tabla = $1 AND obra_id = $2
         ORDER BY timestamp`,
        [tablaReal, obraIdInt]
      ),
    ]);

    const serie = snapshotRes.rows.map((r) => {
      const motivoAnomalia = esAnomalia(tablaReal, r.anio, Number(r.semana));
      return {
        periodo: `${r.anio}-W${r.semana}`,
        semana: Number(r.semana),
        anio: r.anio,
        avance: r.avance !== null ? Number(r.avance) : null,
        estatus: normalizarEstatus(r.estatus),
        anomalia: !!motivoAnomalia,
        fecha: r.fecha,
        ...(motivoAnomalia ? { motivo_anomalia: motivoAnomalia } : {}),
      };
    });

    const eventos = eventosRes.rows.map((r) => ({
      timestamp: r.timestamp,
      usuario: r.usuario,
      accion: r.accion,
      motivo: r.motivo,
      porcentaje_anterior: r.porcentaje_anterior !== null ? Number(r.porcentaje_anterior) : null,
      porcentaje_nuevo: r.porcentaje_nuevo !== null ? Number(r.porcentaje_nuevo) : null,
      delta: r.delta !== null ? Number(r.delta) : null,
      estatus_anterior: normalizarEstatus(r["ESTATUS ANTERIOR"]),
      estatus_nuevo: normalizarEstatus(r["ESTATUS NUEVO"]),
    }));

    const serieValida = serie.filter((p) => !p.anomalia && p.avance !== null);
    const indicadores = calcularIndicadores(serieValida);
    indicadores.semanas_excluidas_por_anomalia = serie.filter((p) => p.anomalia).length;

    let tiempoPromedio = null;
    if (eventosRes.rows.length >= 2) {
      const tiempos = eventosRes.rows.map((r) => new Date(r.timestamp).getTime());
      const diffs = [];
      for (let i = 1; i < tiempos.length; i++) diffs.push(tiempos[i] - tiempos[i - 1]);
      tiempoPromedio = +(diffs.reduce((s, d) => s + d, 0) / diffs.length / 86400000).toFixed(1);
    }
    indicadores.tiempo_promedio_entre_actualizaciones_dias = tiempoPromedio;
    indicadores.proxima_a_terminar = avanceActual >= 90 && estatusActualNorm === "EN PROCESO";
    indicadores.lista_para_inauguracion = avanceActual >= 100 && estatusActualNorm === "TERMINADA" && !fila.fecha_inauguracion;

    const alertas = tieneAlertasHabilitadas(fila.programa) ? calcularAlertas(serieValida, estatusActualNorm) : [];

    const hitos = construirHitos(eventosRes.rows.map((r) => ({
      timestamp: r.timestamp,
      delta: r.delta,
      "ESTATUS ANTERIOR": r["ESTATUS ANTERIOR"],
      "ESTATUS NUEVO": r["ESTATUS NUEVO"],
    })));

    res.json({
      success: true,
      obra: {
        tabla: tablaReal,
        id: obraIdInt,
        clave_unica: fila.clave_unica || null,
        nombre_obra: fila.nombre_obra || "SIN DATO",
        programa: fila.programa || null,
        seguimiento: fila.seguimiento || null,
        alcaldia: fila.alcaldia || null,
        estatus_actual: estatusActualNorm,
        avance_actual: avanceActual,
      },
      serie,
      eventos,
      hitos,
      indicadores,
      alertas,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
