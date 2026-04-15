/**
 * controllers/reportesController.js
 * Generación de reportes y descargas.
 */
const db     = require("../config/db");
const logger = require("../middleware/logger");

/* ── GET /api/reportes/corte?periodo=2025-01-W01 ── */
function corte(req, res, next) {
  try {
    const { periodo } = req.query;
    if (!periodo) {
      return res.status(400).json({ success: false, message: "Parámetro 'periodo' requerido.", code: "MISSING_PERIODO" });
    }

    const historicos = db.read("historico");
    const corteData  = historicos.find((h) => h.periodo === periodo);
    if (!corteData) {
      return res.status(404).json({ success: false, message: `No existe corte para el período: ${periodo}` });
    }

    const obras = db.read("obras");

    /* ── Resumen general ── */
    const { total_obras, actualizadas, no_actualizadas } = corteData.resumen;
    const porcentaje_actualizacion = total_obras > 0
      ? +((actualizadas / total_obras) * 100).toFixed(2)
      : 0;

    /* ── Agrupación por programa ── */
    const por_programa = {};
    for (const snap of corteData.snapshot_obras) {
      const obra = obras.find((o) => o.id === snap.id);
      const prog = obra?.programa || "Sin programa";
      if (!por_programa[prog]) por_programa[prog] = { total: 0, actualizadas: 0, pendientes: 0 };
      por_programa[prog].total++;
      if (snap.estado === "actualizada") por_programa[prog].actualizadas++;
      else por_programa[prog].pendientes++;
    }

    /* ── Cambios significativos (delta > 10%) ── */
    const auditoria = db.read("auditoria");
    const fechaCierre = new Date(corteData.fecha_cierre);
    const fechaAnterior = new Date(fechaCierre.getTime() - 7 * 24 * 60 * 60 * 1000);

    const cambiosSignificativos = auditoria
      .filter((a) => {
        const ts = new Date(a.timestamp);
        return a.delta > 10 && ts >= fechaAnterior && ts <= fechaCierre;
      })
      .map((a) => {
        const obra = obras.find((o) => o.id === a.obra_id);
        return { obra: obra?.nombre || `Obra #${a.obra_id}`, delta: a.delta, usuario: a.usuario, timestamp: a.timestamp };
      });

    /* ── Agrupación por usuario ── */
    const por_usuario = {};
    for (const reg of auditoria) {
      const ts = new Date(reg.timestamp);
      if (reg.accion !== "actualizar" || ts < fechaAnterior || ts > fechaCierre) continue;
      if (!por_usuario[reg.usuario]) por_usuario[reg.usuario] = { actualizaciones: 0, obras: new Set() };
      por_usuario[reg.usuario].actualizaciones++;
      if (reg.obra_id) por_usuario[reg.usuario].obras.add(reg.obra_id);
    }
    const por_usuario_final = {};
    for (const [usr, datos] of Object.entries(por_usuario)) {
      por_usuario_final[usr] = { actualizaciones: datos.actualizaciones, obras: datos.obras.size };
    }

    res.json({
      success: true,
      data: {
        periodo,
        fecha_cierre:       corteData.fecha_cierre,
        resumen: {
          total_obras,
          actualizadas,
          no_actualizadas,
          porcentaje_actualizacion,
        },
        por_programa,
        cambios_significativos: cambiosSignificativos,
        por_usuario:            por_usuario_final,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/reportes/descargar?formato=csv&periodo=... ── */
function descargar(req, res, next) {
  try {
    const { formato = "csv", periodo } = req.query;
    if (!periodo) {
      return res.status(400).json({ success: false, message: "Parámetro 'periodo' requerido." });
    }

    const historicos = db.read("historico");
    const corteData  = historicos.find((h) => h.periodo === periodo);
    if (!corteData) {
      return res.status(404).json({ success: false, message: `No existe corte para el período: ${periodo}` });
    }

    const obras = db.read("obras");
    const snapshot = corteData.snapshot_obras.map((s) => {
      const obra = obras.find((o) => o.id === s.id);
      return {
        id:            s.id,
        nombre:        obra?.nombre       || `Obra #${s.id}`,
        programa:      obra?.programa     || "—",
        porcentaje:    s.porcentaje_avance,
        estado:        s.estado,
        confirmado_por: s.confirmado_por || "sin actualizar",
      };
    });

    logger.info("reportes", `Descarga ${formato.toUpperCase()} — período: ${periodo} — usuario: ${req.user?.email}`);

    if (formato.toLowerCase() === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="corte-${periodo}.json"`);
      return res.json({ periodo, fecha_cierre: corteData.fecha_cierre, resumen: corteData.resumen, obras: snapshot });
    }

    /* CSV */
    const headers = ["ID", "Nombre", "Programa", "Porcentaje", "Estado", "Confirmado Por"];
    const filas   = snapshot.map((s) =>
      [s.id, `"${s.nombre}"`, `"${s.programa}"`, s.porcentaje, s.estado, s.confirmado_por].join(",")
    );
    const csv = [
      `# Reporte SICOPS — Período: ${periodo}`,
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

/* ── GET /api/reportes/periodos ── */
function periodos(req, res, next) {
  try {
    const historicos = db.read("historico");
    const lista      = historicos.map((h) => ({
      periodo:      h.periodo,
      fecha_cierre: h.fecha_cierre,
      resumen:      h.resumen,
    }));
    res.json({ success: true, data: lista });
  } catch (err) {
    next(err);
  }
}

module.exports = { corte, descargar, periodos };
