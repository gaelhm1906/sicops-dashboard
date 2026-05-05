const { query, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");
const { listarPeriodosSemana, obtenerCortePorPeriodo } = require("../services/semanaService");

async function cargarCorteConSemana(periodo) {
  const corte = await obtenerCortePorPeriodo(periodo);
  if (!corte) return null;

  const auditoriaRes = await query(
    `
      SELECT *
      FROM ${SCHEMA}.auditoria
      WHERE semana = $1 AND anio = $2
      ORDER BY timestamp DESC, id DESC
    `,
    [corte.semana, corte.anio]
  );

  return { corte, auditoria: auditoriaRes.rows };
}

async function corte(req, res, next) {
  try {
    const { periodo } = req.query;
    if (!periodo) {
      return res.status(400).json({ success: false, message: "Parametro 'periodo' requerido.", code: "MISSING_PERIODO" });
    }

    const data = await cargarCorteConSemana(periodo);
    if (!data) {
      return res.status(404).json({ success: false, message: `No existe corte para el periodo: ${periodo}` });
    }

    const { corte: corteData, auditoria } = data;

    const porPrograma = {};
    for (const snap of corteData.snapshot_obras) {
      const programa = snap.programa || "Sin programa";
      if (!porPrograma[programa]) {
        porPrograma[programa] = { total: 0, actualizadas: 0, pendientes: 0 };
      }
      porPrograma[programa].total += 1;
      const estatus = String(snap.estado || "").toUpperCase();
      if (estatus.includes("ENTREGAD") || estatus.includes("TERMINAD")) {
        porPrograma[programa].actualizadas += 1;
      } else {
        porPrograma[programa].pendientes += 1;
      }
    }

    const cambiosSignificativos = auditoria
      .filter((row) => Number(row.delta || 0) > 10)
      .map((row) => ({
        obra: row["NOMBRE DEL SITIO INTERVENIDO"] || `Obra #${row.obra_id}`,
        delta: Number(row.delta || 0),
        usuario: row.usuario,
        timestamp: row.timestamp,
      }));

    const porUsuarioMap = {};
    for (const row of auditoria) {
      if (!row.usuario) continue;
      if (!porUsuarioMap[row.usuario]) {
        porUsuarioMap[row.usuario] = { actualizaciones: 0, obras: new Set() };
      }
      porUsuarioMap[row.usuario].actualizaciones += 1;
      if (row.obra_id) porUsuarioMap[row.usuario].obras.add(row.obra_id);
    }

    const porUsuario = Object.fromEntries(
      Object.entries(porUsuarioMap).map(([usuario, value]) => [
        usuario,
        { actualizaciones: value.actualizaciones, obras: value.obras.size },
      ])
    );

    res.json({
      success: true,
      data: {
        periodo,
        fecha_cierre: corteData.fecha_cierre,
        resumen: corteData.resumen,
        por_programa: porPrograma,
        cambios_significativos: cambiosSignificativos,
        por_usuario: porUsuario,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function descargar(req, res, next) {
  try {
    const { formato = "csv", periodo } = req.query;
    if (!periodo) {
      return res.status(400).json({ success: false, message: "Parametro 'periodo' requerido." });
    }

    const corteData = await obtenerCortePorPeriodo(periodo);
    if (!corteData) {
      return res.status(404).json({ success: false, message: `No existe corte para el periodo: ${periodo}` });
    }

    const snapshot = corteData.snapshot_obras.map((row) => ({
      id: row.id,
      nombre: row.nombre || `Obra #${row.id}`,
      programa: row.programa || "-",
      porcentaje: row.porcentaje_avance,
      estado: row.estado,
      confirmado_por: row.confirmado_por || "sin actualizar",
    }));

    logger.info("reportes", `Descarga ${formato.toUpperCase()} del periodo ${periodo} por ${req.user?.email || "anonimo"}`);

    if (formato.toLowerCase() === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="corte-${periodo}.json"`);
      return res.json({
        periodo,
        fecha_cierre: corteData.fecha_cierre,
        resumen: corteData.resumen,
        obras: snapshot,
      });
    }

    const headers = ["ID", "Nombre", "Programa", "Porcentaje", "Estado", "Confirmado Por"];
    const filas = snapshot.map((row) =>
      [row.id, `"${String(row.nombre).replace(/"/g, '""')}"`, `"${String(row.programa).replace(/"/g, '""')}"`, row.porcentaje, row.estado, row.confirmado_por].join(",")
    );
    const csv = [
      `# Reporte SICOPS - Periodo: ${periodo}`,
      `# Fecha cierre: ${corteData.fecha_cierre}`,
      `# Total: ${corteData.resumen.total_obras} | Actualizadas: ${corteData.resumen.actualizadas}`,
      "",
      headers.join(","),
      ...filas,
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="corte-${periodo}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function periodos(req, res, next) {
  try {
    const semanas = await listarPeriodosSemana();
    const data = semanas.map((row) => ({
      periodo: row.periodo,
      fecha_cierre: row.fecha_cierre || row.created_at,
      semana: Number(row.semana),
      anio: Number(row.anio),
      activa: !!row.activa,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { corte, descargar, periodos };
