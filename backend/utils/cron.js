const cron = require("node-cron");

const logger = require("../middleware/logger");
const { ensureSemanaInicial, getSemanaISO, iniciarSemana } = require("../services/semanaService");

function getPeriodo(date = new Date()) {
  return getSemanaISO(date).periodo;
}

async function ejecutarCambioSemanaAutomatico() {
  try {
    await ensureSemanaInicial();
    const resultado = await iniciarSemana({ usuario: "auto", manual: false });

    if (resultado.creada) {
      logger.info("cron", `Cambio semanal ejecutado automaticamente: ${resultado.semana.periodo}`);
      return;
    }

    logger.info("cron", `Semana ya activa, sin cambios: ${resultado.semana.periodo}`);
  } catch (err) {
    if (err.code === "LEGACY_WEEK_BLOCKED") {
      logger.warn("cron", `Cambio semanal omitido: ${err.message}`);
      return;
    }
    logger.error("cron", `Error en cambio semanal automatico: ${err.message}`);
  }
}

function initCron() {
  cron.schedule("0 0 0 * * 2", ejecutarCambioSemanaAutomatico, {
    scheduled: true,
    timezone: "America/Mexico_City",
  });

  logger.info("cron", "Cron semanal registrado: cambio de semana los martes 00:00 (America/Mexico_City)");
}

module.exports = {
  initCron,
  getPeriodo,
  getSemanaISO,
  ejecutarCambioSemanaAutomatico,
};
