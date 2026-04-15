/**
 * utils/cron.js
 * Automatización de cierre diario a las 12:00
 * y reapertura a las 00:00.
 */
const cron   = require("node-cron");
const db     = require("../config/db");
const logger = require("../middleware/logger");

/* ── Calcula el número de semana ISO ── */
function getWeekNumber(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getPeriodo(date = new Date()) {
  const year = date.getFullYear();
  const week = String(getWeekNumber(date)).padStart(2, "0");
  return `${year}-W${week}`;
}

/* ── Lógica de cierre ── */
function ejecutarCierreAutomatico() {
  logger.info("cron", "Iniciando cierre automático del sistema...");
  try {
    const control = db.read("control_sistema");

    if (control.estado !== "abierto") {
      logger.info("cron", "Sistema ya cerrado, omitiendo cierre automático.");
      return;
    }

    const obras       = db.read("obras");
    const total       = obras.length;
    const actualizadas = obras.filter((o) => o.estado === "actualizada").length;
    const noAct       = total - actualizadas;
    const ahora       = new Date().toISOString();
    const periodo     = control.periodo_actual;

    /* 1 — Snapshot histórico */
    const historico = db.read("historico");
    const yaExiste  = historico.some((h) => h.periodo === periodo);

    if (!yaExiste) {
      historico.push({
        id:           `corte_${periodo}`,
        periodo,
        fecha_cierre: ahora,
        generado_en:  ahora,
        resumen: {
          total_obras:              total,
          actualizadas,
          no_actualizadas:          noAct,
          porcentaje_actualizacion: total > 0 ? +((actualizadas / total) * 100).toFixed(2) : 0,
        },
        snapshot_obras: obras.map((o) => ({
          id:             o.id,
          porcentaje_avance: o.porcentaje_avance,
          estado:         o.estado,
          confirmado_por: o.confirmado_por,
        })),
      });
      db.write("historico", historico);
      logger.info("cron", `Snapshot histórico generado para período ${periodo}`);
    }

    /* 2 — Registrar en auditoría */
    db.insert("auditoria", {
      timestamp:          ahora,
      usuario:            "sistema",
      obra_id:            null,
      accion:             "cierre_automatico",
      porcentaje_anterior: null,
      porcentaje_nuevo:   null,
      delta:              null,
      confirmado:         true,
      cambio_id:          `cierre_${periodo}`,
      ip:                 "127.0.0.1",
      resumen:            { total, actualizadas, no_actualizadas: noAct },
    });

    /* 3 — Cerrar el sistema */
    const proximaApertura = new Date();
    proximaApertura.setHours(24, 0, 0, 0); // medianoche siguiente

    db.updateSingle("control_sistema", {
      estado:            "cerrado",
      bloqueado_edicion: true,
      ultimo_cierre:     ahora,
      cerrado_por:       "sistema (automático)",
      proxima_apertura:  proximaApertura.toISOString(),
    });

    logger.info("cron", `Cierre automático completado. Total: ${total} | Actualizadas: ${actualizadas} | No actualizadas: ${noAct}`);
  } catch (err) {
    logger.error("cron", `Error en cierre automático: ${err.message}`);
  }
}

/* ── Lógica de apertura ── */
function ejecutarAperturaAutomatica() {
  logger.info("cron", "Iniciando apertura automática del sistema...");
  try {
    const ahora   = new Date();
    const periodo = getPeriodo(ahora);

    /* Calcular próxima clausura (12:00 de hoy) */
    const clausura = new Date(ahora);
    clausura.setHours(12, 0, 0, 0);

    db.updateSingle("control_sistema", {
      estado:             "abierto",
      bloqueado_edicion:  false,
      fecha_apertura:     ahora.toISOString(),
      proxima_clausura:   clausura.toISOString(),
      periodo_actual:     periodo,
      abierto_por:        "sistema (automático)",
      cerrado_por:        null,
    });

    logger.info("cron", `Apertura automática completada. Período: ${periodo}`);
  } catch (err) {
    logger.error("cron", `Error en apertura automática: ${err.message}`);
  }
}

/* ── Registrar los cron jobs ── */
function initCron() {
  /* Cierre: todos los días a las 12:00:00 */
  cron.schedule("0 0 12 * * *", ejecutarCierreAutomatico, {
    scheduled: true,
    timezone:  "America/Santiago",
  });

  /* Apertura: todos los días a las 00:00:00 */
  cron.schedule("0 0 0 * * *", ejecutarAperturaAutomatica, {
    scheduled: true,
    timezone:  "America/Santiago",
  });

  logger.info("cron", "Cron jobs registrados: cierre 12:00 | apertura 00:00 (America/Santiago)");
}

module.exports = {
  initCron,
  ejecutarCierreAutomatico,
  ejecutarAperturaAutomatica,
  getPeriodo,
};
