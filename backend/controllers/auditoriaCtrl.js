/**
 * controllers/auditoriaCtrl.js
 * Exportación a Excel de la tabla auditoria por programa.
 *
 * GET /api/auditoria/export?programa=XXX
 */
const ExcelJS = require("exceljs");
const { query, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

async function exportarExcel(req, res) {
  const { programa } = req.query;

  if (!programa || !programa.trim()) {
    return res.status(400).json({
      success: false,
      message: 'El parámetro "programa" es requerido.',
      code:    "MISSING_PROGRAMA",
    });
  }

  const programaTrim = programa.trim();

  try {
    /* Validar que el programa existe en auditoria.tabla (case-insensitive) */
    const validacion = await query(
      `SELECT COUNT(*)::int AS total FROM ${SCHEMA}.auditoria WHERE LOWER(tabla) = LOWER($1)`,
      [programaTrim]
    );

    if (validacion.rows[0].total === 0) {
      return res.status(404).json({
        success: false,
        message: `No hay registros de auditoría para el programa "${programaTrim}".`,
        code:    "PROGRAMA_NOT_FOUND",
      });
    }

    /* Consulta con TODOS los campos exactos */
    const result = await query(
      `SELECT
         id,
         timestamp,
         usuario,
         tabla,
         obra_id,
         porcentaje_anterior,
         porcentaje_nuevo,
         delta,
         motivo,
         ip,
         "ESTATUS ANTERIOR",
         "ESTATUS NUEVO",
         "NOMBRE DEL SITIO INTERVENIDO",
         semana,
         anio
       FROM ${SCHEMA}.auditoria
       WHERE LOWER(tabla) = LOWER($1)
       ORDER BY timestamp DESC`,
      [programaTrim]
    );

    /* Construir Excel */
    const workbook  = new ExcelJS.Workbook();
    workbook.creator = "SICOPS";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Auditoria");

    worksheet.columns = [
      { header: "ID",                  key: "id",                             width: 10 },
      { header: "Fecha",               key: "timestamp",                      width: 26 },
      { header: "Usuario",             key: "usuario",                        width: 22 },
      { header: "Programa (Tabla)",    key: "tabla",                          width: 32 },
      { header: "Obra ID",             key: "obra_id",                        width: 10 },
      { header: "Porcentaje Anterior", key: "porcentaje_anterior",            width: 20 },
      { header: "Porcentaje Nuevo",    key: "porcentaje_nuevo",               width: 18 },
      { header: "Delta",               key: "delta",                          width: 10 },
      { header: "Motivo",              key: "motivo",                         width: 32 },
      { header: "IP",                  key: "ip",                             width: 16 },
      { header: "Estatus Anterior",    key: "ESTATUS ANTERIOR",               width: 20 },
      { header: "Estatus Nuevo",       key: "ESTATUS NUEVO",                  width: 20 },
      { header: "Nombre del Sitio",    key: "NOMBRE DEL SITIO INTERVENIDO",   width: 42 },
      { header: "Semana",              key: "semana",                         width: 10 },
      { header: "Año",                 key: "anio",                           width: 10 },
    ];

    /* Estilo del encabezado */
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type:    "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;

    /* Agregar filas */
    result.rows.forEach((row) => {
      worksheet.addRow({
        id:                             row.id,
        timestamp:                      row.timestamp,
        usuario:                        row.usuario,
        tabla:                          row.tabla,
        obra_id:                        row.obra_id,
        porcentaje_anterior:            row.porcentaje_anterior,
        porcentaje_nuevo:               row.porcentaje_nuevo,
        delta:                          row.delta,
        motivo:                         row.motivo,
        ip:                             row.ip,
        "ESTATUS ANTERIOR":             row["ESTATUS ANTERIOR"],
        "ESTATUS NUEVO":                row["ESTATUS NUEVO"],
        "NOMBRE DEL SITIO INTERVENIDO": row["NOMBRE DEL SITIO INTERVENIDO"],
        semana:                         row.semana,
        anio:                           row.anio,
      });
    });

    /* Filas alternas para legibilidad */
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type:    "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCE6F1" },
        };
      }
    });

    /* Nombre seguro del archivo */
    const fecha        = new Date().toISOString().slice(0, 10);
    const nombreSeguro = programaTrim.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const nombreArchivo = `auditoria_${nombreSeguro}_${fecha}.xlsx`;

    logger.info("auditoria-export", `Excel generado: ${nombreArchivo} (${result.rows.length} registros)`);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error("auditoria-export", `Error: ${err.message}`);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Error al generar el archivo Excel.",
        detail:  err.message,
      });
    }
  }
}

module.exports = { exportarExcel };
