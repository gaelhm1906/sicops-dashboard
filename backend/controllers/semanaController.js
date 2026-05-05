const logger = require("../middleware/logger");
const {
  SEMANA_MINIMA,
  ensureSemanaInicial,
  getSemanaActiva,
  iniciarSemana,
} = require("../services/semanaService");

async function actual(req, res, next) {
  try {
    await ensureSemanaInicial();
    const semana = await getSemanaActiva();

    if (!semana) {
      return res.status(404).json({
        success: false,
        message: "No existe una semana activa configurada.",
        code: "SEMANA_NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      data: {
        id: semana.id,
        semana: Number(semana.semana),
        anio: Number(semana.anio),
        periodo: semana.periodo,
        activa: !!semana.activa,
        fecha_inicio: semana.fecha_inicio,
        fecha_cierre: semana.fecha_cierre,
        semana_minima: SEMANA_MINIMA,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function iniciar(req, res, next) {
  try {
    const usuario = req.user?.email || req.user?.username || "admin";
    const resultado = await iniciarSemana({ usuario, manual: true });

    logger.info("semana", `Inicio manual de semana solicitado por ${usuario}`);

    return res.json({
      success: true,
      creada: resultado.creada,
      data: resultado.semana,
      message: resultado.creada
        ? `Semana ${resultado.semana.periodo} iniciada correctamente.`
        : `La semana ${resultado.semana.periodo} ya estaba activa.`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  actual,
  iniciar,
};
