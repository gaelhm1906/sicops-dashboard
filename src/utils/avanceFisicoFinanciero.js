/**
 * utils/avanceFisicoFinanciero.js
 * Persistencia MOCK (localStorage) para los dos formatos oficiales:
 *  - REQ-15 Informe del avance físico: fechas de ejecución + curva semanal
 *    (% programado vs % real).
 *  - REQ-16 Informe del avance financiero semanal: estimaciones (pagos),
 *    con deducciones/sanciones/retenciones tomadas de la Carátula del
 *    contrato (captura única, no se repiten aquí — minuta de definición
 *    técnica de Supervisión Externa, sección 10).
 */
import { generarSemanasAutomaticas, generarSemanaExtendida, ubicarSemana } from "./calculoSemanas";
import { getQuincenas, calcularProgramadoPorSemana } from "./programaObra";
import { esSesionReal } from "./seguimiento";
import { getAvanceFisicoServidor, putEjecucionServidor, putAvanceSemanaServidor, getEstimacionesServidor, putEstimacionesServidor } from "../api/psCapturaOperativaApi";

const FISICO_PREFIX = "avance_fisico::";
const FINANCIERO_PREFIX = "avance_financiero::";
const TASA_IVA = 0.16;
const LIMITE_SEMANAS_EXTENDIDAS = 52;

const obraIdsConocidosFisico = new Map();
const obraIdsConocidosFinanciero = new Map();

/* Ajuste de minuta: las fechas programadas ya no se capturan aquí —
   vienen de la Carátula del contrato (fecha_inicio + dias_naturales).
   Aquí solo se registran las fechas REALES de ejecución. */
export const EJECUCION_VACIA = {
  fecha_inicio_real: "",
  fecha_terminacion_real: "",
  diferimiento: "",
};

/* ── Avance físico (REQ-15): ejecución + curva semanal ──
   Las semanas ya NO se capturan a mano: se derivan de fecha inicio/término
   (ver utils/calculoSemanas.js). Lo único que persiste aquí es el % real
   que el usuario observa por semana, indexado por número de semana. */

export function getAvanceFisico(obraKey) {
  try {
    const raw = localStorage.getItem(FISICO_PREFIX + obraKey);
    const data = raw ? JSON.parse(raw) : null;
    return {
      ejecucion: { ...EJECUCION_VACIA, ...(data?.ejecucion || {}) },
      avanceRealPorSemana: data?.avanceRealPorSemana || {},
    };
  } catch {
    return { ejecucion: { ...EJECUCION_VACIA }, avanceRealPorSemana: {} };
  }
}

export function guardarEjecucion(obraKey, ejecucion) {
  const actual = getAvanceFisico(obraKey);
  const next = { ...actual, ejecucion };
  localStorage.setItem(FISICO_PREFIX + obraKey, JSON.stringify(next));
  if (esSesionReal()) {
    const obraId = obraIdsConocidosFisico.get(obraKey);
    if (obraId) putEjecucionServidor(obraId, ejecucion).catch(() => {});
  }
  return next;
}

/* Sesión PS real: trae ejecución + avance real por semana ya registrados
   en el servidor, y registra el obraId para que guardarEjecucion()/
   guardarAvanceRealSemana() sincronicen de vuelta. No hace nada para el
   resto de sesiones. */
export async function hidratarAvanceFisicoDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidosFisico.set(obraKey, obraId);
  try {
    const d = await getAvanceFisicoServidor(obraId);
    localStorage.setItem(FISICO_PREFIX + obraKey, JSON.stringify({
      ejecucion: d.ejecucion ? { fecha_inicio_real: (d.ejecucion.fecha_inicio_real || "").slice(0, 10), fecha_terminacion_real: (d.ejecucion.fecha_terminacion_real || "").slice(0, 10), diferimiento: d.ejecucion.diferimiento || "" } : EJECUCION_VACIA,
      avanceRealPorSemana: d.avanceRealPorSemana || {},
    }));
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

/**
 * Ajuste de minuta (3ª reunión, "Presentación de avances"): el avance
 * real se reporta por DOS fuentes distintas — Supervisión Externa
 * (reporta lo ejecutado por el contratista; la oficial, la que se usa
 * para calcular retenciones) y Supervisión Interna/Residente de Obra
 * (avala o corrige ese reporte). La contratista NO captura información
 * directamente. `fuente` es "supervision" o "supervision_interna".
 */
export function guardarAvanceRealSemana(obraKey, numero, avanceReal, fuente = "supervision") {
  const actual = getAvanceFisico(obraKey);
  const actualSemana = actual.avanceRealPorSemana[numero] || {};
  const next = {
    ...actual,
    avanceRealPorSemana: {
      ...actual.avanceRealPorSemana,
      [numero]: { ...actualSemana, [fuente]: Number(avanceReal) || 0 },
    },
  };
  localStorage.setItem(FISICO_PREFIX + obraKey, JSON.stringify(next));
  if (esSesionReal()) {
    const obraId = obraIdsConocidosFisico.get(obraKey);
    if (obraId) putAvanceSemanaServidor(obraId, numero, avanceReal, fuente).catch(() => {});
  }
  return next;
}

/**
 * Combina semanas ya programadas (avanceProgramado) con el avance real
 * capturado por semana, y aplica la extensión automática por desfase
 * (minuta 3ª reunión, "Presentación de avances", punto 3): si al llegar
 * al final del calendario contractual alguna serie real capturada
 * todavía no llega a 100%, se habilita la SIGUIENTE semana (programado
 * fijo en 100%, ya no hay nada más que programar) para que el usuario
 * siga registrando avance real ahí. Solo se abre una semana a la vez —
 * hasta que esa también se capture y siga sin llegar a 100%, no se abre
 * otra— para no generar de golpe filas vacías que nadie ha pedido.
 * Función pura: recibe `avanceRealPorSemana` ya cargado (persistido o en
 * edición en memoria), no lee storage — así sirve tanto para vistas de
 * solo lectura (Informe, Financiero) como para el formulario de captura,
 * que necesita reaccionar a lo que el usuario está escribiendo antes de
 * guardar.
 */
export function semanasConAvanceReal(semanasProgramadas, avanceRealPorSemana) {
  const real = (numero) => avanceRealPorSemana[numero] || {};

  const semanas = semanasProgramadas.map((s) => ({
    ...s,
    avanceReal: real(s.numero).supervision ?? 0,
    avanceRealInterna: real(s.numero).supervision_interna ?? null,
  }));

  if (semanas.length === 0) return semanas;

  for (let i = 0; i < LIMITE_SEMANAS_EXTENDIDAS; i++) {
    const ultima = semanas[semanas.length - 1];
    const r = real(ultima.numero);
    const hayCaptura = r.supervision != null || r.supervision_interna != null;
    const faltaLlegar = (r.supervision != null && r.supervision < 100) || (r.supervision_interna != null && r.supervision_interna < 100);
    if (!hayCaptura || !faltaLlegar) break;

    const inicioSiguiente = new Date(`${ultima.periodoAl}T00:00:00`);
    inicioSiguiente.setDate(inicioSiguiente.getDate() + 1);
    const nueva = generarSemanaExtendida(ultima.numero + 1, inicioSiguiente.toISOString().slice(0, 10));
    if (!nueva) break;
    const rNueva = real(nueva.numero);
    semanas.push({
      ...nueva,
      avanceReal: rNueva.supervision ?? 0,
      avanceRealInterna: rNueva.supervision_interna ?? null,
      extendida: true,
    });
  }

  return semanas;
}

/**
 * Atajo para las vistas de solo lectura (Informe, Avance Financiero):
 * arma el calendario contractual desde la Carátula, lo cruza con el
 * programa de obra (quincenas) y el avance real YA GUARDADO, y aplica
 * la extensión por desfase. El formulario de captura (CapturaAvanceFisico)
 * no usa este atajo — necesita reaccionar a lo que el usuario está
 * escribiendo antes de guardar, así que llama a semanasConAvanceReal()
 * directamente con su estado en memoria.
 */
export function construirSemanasFisico(obraKey, caratula) {
  const fechaInicio = caratula?.fecha_inicio;
  const diasNat = Number(caratula?.dias_naturales) || 0;
  if (!fechaInicio || diasNat <= 0) return [];

  const fin = new Date(`${fechaInicio}T00:00:00`);
  fin.setDate(fin.getDate() + diasNat - 1);
  const fechaTermino = fin.toISOString().slice(0, 10);

  const base = generarSemanasAutomaticas(fechaInicio, fechaTermino);
  const quincenas = getQuincenas(obraKey);
  const conProgramado = calcularProgramadoPorSemana(base, quincenas);
  const { avanceRealPorSemana } = getAvanceFisico(obraKey);
  return semanasConAvanceReal(conProgramado, avanceRealPorSemana);
}

/* ── Avance financiero (REQ-16): estimaciones ──────────────────────── */

export function getAvanceFinanciero(obraKey) {
  try {
    const raw = localStorage.getItem(FINANCIERO_PREFIX + obraKey);
    const data = raw ? JSON.parse(raw) : null;
    return {
      estimaciones: Array.isArray(data?.estimaciones) ? data.estimaciones : [],
    };
  } catch {
    return { estimaciones: [] };
  }
}

function guardar(obraKey, estado) {
  localStorage.setItem(FINANCIERO_PREFIX + obraKey, JSON.stringify(estado));
  if (esSesionReal()) {
    const obraId = obraIdsConocidosFinanciero.get(obraKey);
    if (obraId) putEstimacionesServidor(obraId, estado.estimaciones).catch(() => {});
  }
  return estado;
}

/* Sesión PS real: trae las estimaciones ya registradas en el servidor y
   registra el obraId para que guardar() sincronice de vuelta. No hace
   nada para el resto de sesiones. */
export async function hidratarAvanceFinancieroDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidosFinanciero.set(obraKey, obraId);
  try {
    const { estimaciones } = await getEstimacionesServidor(obraId);
    if (estimaciones?.length) {
      localStorage.setItem(FINANCIERO_PREFIX + obraKey, JSON.stringify({ estimaciones }));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

/* `Date.now()` solo no basta como id cuando se agregan varias
   estimaciones en el mismo ciclo síncrono (ej. el generador de ejemplo
   de demoInformeCompleto.js, que agrega dos seguidas) — caen en el
   mismo milisegundo y terminan con el MISMO id. El sufijo aleatorio
   elimina la colisión — mismo patrón que en contratos.js/programaObra.js. */
function idUnico(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function agregarEstimacion(obraKey, fila) {
  const actual = getAvanceFinanciero(obraKey);
  const cruda = {
    id: idUnico("est"),
    noEstimacion: fila.noEstimacion || actual.estimaciones.length + 1,
    /* Ajuste de reunión (12 de agosto): la carátula oficial en papel
       etiqueta cada estimación con su propia clave (EST 01, 01 EST...) y
       la de finiquito lleva sufijo "F" (04F) — el sistema ya trae el
       consecutivo (`noEstimacion`), esto es el identificador que el
       usuario escribe para que coincida con el documento físico. */
    identificador: fila.identificador || "",
    periodoDel: fila.periodoDel || "",
    periodoAl: fila.periodoAl || "",
    fechaEntrega: fila.fechaEntrega || "",
    montoSinIva: Number(fila.montoSinIva) || 0,
    deduccionesTotales: Number(fila.deduccionesTotales) || 0,
  };
  return guardar(obraKey, { ...actual, estimaciones: [...actual.estimaciones, cruda] });
}

export function eliminarEstimacion(obraKey, id) {
  const actual = getAvanceFinanciero(obraKey);
  return guardar(obraKey, { ...actual, estimaciones: actual.estimaciones.filter((e) => e.id !== id) });
}

/**
 * Calcula cada estimación en cadena. Ajuste de minuta (3ª reunión,
 * "Presentación de avances", 5.4 — simplificación temporal): en esta
 * primera etapa NO se desglosan retenciones, sanciones ni entregas
 * extemporáneas — el usuario captura el monto TOTAL de deducciones que
 * ya trae la carátula de su estimación (documento en papel), y:
 *   Líquido = monto con IVA − deducciones totales
 * Motivo (según la minuta): permitir la captura inmediata sin exigir a
 * las áreas un cálculo que hoy no dominan, y sustituir la fórmula de
 * deducciones por % que traía el sistema antes, cuyo origen no estaba
 * determinado. El desglose fino (deducciones específicas, sanciones,
 * retención por atraso — antes calculado aquí) vuelve en una segunda
 * etapa, una vez revisados los contratos vigentes; los campos
 * `deducciones`/`sanciones`/`retencion_porcentaje` siguen en la
 * Carátula del contrato para entonces, solo que hoy no los usa este
 * cálculo.
 */
export function calcularEstimacionesFinanciero(estimacionesCrudas, caratula, semanasFisico) {
  const importeTotalConIva = Number(caratula?.importe_total) || 0;

  let acumuladoConIva = 0;

  return estimacionesCrudas.map((e) => {
    const montoSinIva = Number(e.montoSinIva) || 0;
    const iva = Math.round(montoSinIva * TASA_IVA * 100) / 100;
    const montoConIva = Math.round((montoSinIva + iva) * 100) / 100;
    const deduccionesTotales = Number(e.deduccionesTotales) || 0;
    const liquido = Math.round((montoConIva - deduccionesTotales) * 100) / 100;

    const semana = ubicarSemana(semanasFisico, e.fechaEntrega);

    acumuladoConIva += montoConIva;

    return {
      ...e,
      iva,
      montoConIva,
      deduccionesTotales,
      liquido,
      acumuladoConIva: Math.round(acumuladoConIva * 100) / 100,
      porcentajeAcumulado: importeTotalConIva > 0 ? Math.min(100, (acumuladoConIva / importeTotalConIva) * 100) : 0,
      semanaNumero: semana?.numero ?? null,
    };
  });
}

/**
 * Saldo pendiente por estimar (5.2 de la minuta): el monto del contrato
 * ya cubierto por estimaciones y lo que falta por estimar, descontando
 * automáticamente el acumulado. Ej. de la minuta: contrato $2,250,328.82
 * con IVA, estimaciones por $1,500,000 → pendiente $750,328.82.
 */
export function saldoPendientePorEstimar(estimacionesCalculadas, caratula) {
  const importeTotal = Number(caratula?.importe_total) || 0;
  const ultima = estimacionesCalculadas[estimacionesCalculadas.length - 1];
  const acumulado = ultima?.acumuladoConIva ?? 0;
  const diferencia = Math.round((importeTotal - acumulado) * 100) / 100;
  /* Ajuste de reunión (12 de agosto, "la lógica debe cerrar en cero"):
     el IVA se redondea POR estimación (10.6 de la minuta), así que la
     suma de varias estimaciones puede quedar a un centavo del importe
     total del contrato aunque cada una esté bien calculada — es un
     residuo de redondeo compuesto, no un pendiente real por cobrar. La
     estimación de finiquito existe precisamente para cerrar el
     contrato, así que un desfase de ±1 centavo se cierra en cero en
     vez de arrastrarse como saldo. */
  const pendiente = Math.abs(diferencia) <= 0.01 ? 0 : Math.max(0, diferencia);
  return { importeTotal, acumulado, pendiente };
}

/**
 * Avance financiero semanal (10.6): ubica el % acumulado de cada
 * estimación en su semana; las semanas sin estimación quedan en blanco
 * (para detectar visualmente huecos y su correlación con sanciones).
 */
/**
 * Convierte un % de avance en el monto que representa sobre el importe
 * total del contrato (C/IVA) — columna "IMPORTE REAL C/IVA" del formato
 * oficial: no basta con mostrar el %, hay que traducirlo a dinero.
 */
export function importeRealDeAvance(pctReal, importeTotal) {
  if (pctReal == null) return null;
  const total = Number(importeTotal) || 0;
  return (Number(pctReal) / 100) * total;
}

/**
 * Ajuste de minuta (5.2 — deficiencia detectada en la demostración): en
 * las semanas sin estimación la curva financiera caía a cero. El
 * sistema ahora arrastra el último % acumulado hasta que ingrese una
 * nueva estimación, para que la curva sea continua (no discontinua).
 */
export function avanceFinancieroPorSemana(semanasFisico, estimacionesCalculadas) {
  const porSemana = {};
  for (const e of estimacionesCalculadas) {
    if (e.semanaNumero == null) continue;
    porSemana[e.semanaNumero] = e.porcentajeAcumulado;
  }
  let ultimoConocido = null;
  return semanasFisico.map((s) => {
    if (porSemana[s.numero] != null) ultimoConocido = porSemana[s.numero];
    return {
      numero: s.numero,
      periodoDel: s.periodoDel,
      periodoAl: s.periodoAl,
      porcentajeFinanciero: ultimoConocido,
    };
  });
}
