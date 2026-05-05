/**
 * controllers/kpisCtrl.js
 * GET /api/kpis/summary
 *
 * Devuelve conteo por ESTATUS agrupado por tabla y por "DIRECCION GENERAL".
 * Solo procesa tablas que tengan las columnas "ESTATUS" y "DIRECCION GENERAL".
 */

const { query, listarTablas, columnasDe, SCHEMA } = require("../config/pg");
const logger = require("../middleware/logger");

function qid(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function kpisSummary(req, res) {
  const inicio = Date.now();

  try {
    const tablas = await listarTablas();

    const porTabla     = [];
    const acumDG       = {};   // { "DIRECCION GENERAL": { SIN_INICIAR, EN_PROCESO, TERMINADO, total } }
    let globalTotal    = 0;
    let globalSinIni   = 0;
    let globalEnProc   = 0;
    let globalTerm     = 0;
    let globalSumAvance = 0;

    for (const nombreTabla of tablas) {
      try {
        const columnas   = await columnasDe(nombreTabla);
        const colNombres = columnas.map((c) => c.column_name);

        const tieneEstatus = colNombres.some(
          (c) => c.toLowerCase() === "estatus"
        );
        const tieneDG = colNombres.some(
          (c) => c.toLowerCase() === "direccion general" || c.toLowerCase() === "direccion_general"
        );
        const tieneAvance = colNombres.some(
          (c) => c.toLowerCase() === "avance real" || c.toLowerCase() === "avance_real"
        );

        if (!tieneEstatus) continue;

        /* ── Conteo por ESTATUS para esta tabla ── */
        const countRes = await query(
          `SELECT
             COALESCE("ESTATUS", 'SIN INICIAR') AS estatus,
             COUNT(*) AS total
           FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
           GROUP BY "ESTATUS"
           ORDER BY "ESTATUS"`
        );

        const conteo = { SIN_INICIAR: 0, EN_PROCESO: 0, TERMINADO: 0, otros: 0, total: 0 };
        for (const row of countRes.rows) {
          const e = String(row.estatus).toUpperCase().trim();
          const n = parseInt(row.total, 10);
          conteo.total += n;
          if (e === "SIN INICIAR")  conteo.SIN_INICIAR += n;
          else if (e === "EN PROCESO") conteo.EN_PROCESO += n;
          else if (e === "TERMINADO")  conteo.TERMINADO  += n;
          else conteo.otros += n;
        }

        /* ── Promedio de avance si la columna existe ── */
        let promedioAvance = null;
        if (tieneAvance) {
          const avgRes = await query(
            `SELECT ROUND(AVG("AVANCE REAL"::numeric), 2) AS prom
             FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
             WHERE "AVANCE REAL" IS NOT NULL`
          );
          promedioAvance = parseFloat(avgRes.rows[0]?.prom) || 0;
          globalSumAvance += promedioAvance * conteo.total;
        }

        globalTotal  += conteo.total;
        globalSinIni += conteo.SIN_INICIAR;
        globalEnProc += conteo.EN_PROCESO;
        globalTerm   += conteo.TERMINADO;

        porTabla.push({
          tabla: nombreTabla,
          ...conteo,
          promedio_avance: promedioAvance,
        });

        /* ── Agrupado por DIRECCION GENERAL ── */
        if (tieneDG) {
          const dgRes = await query(
            `SELECT
               COALESCE("DIRECCION GENERAL", 'SIN DATO') AS dg,
               COALESCE("ESTATUS", 'SIN INICIAR') AS estatus,
               COUNT(*) AS total
             FROM ${qid(SCHEMA)}.${qid(nombreTabla)}
             GROUP BY "DIRECCION GENERAL", "ESTATUS"`
          );

          for (const row of dgRes.rows) {
            const dg = String(row.dg).trim();
            const e  = String(row.estatus).toUpperCase().trim();
            const n  = parseInt(row.total, 10);

            if (!acumDG[dg]) {
              acumDG[dg] = { SIN_INICIAR: 0, EN_PROCESO: 0, TERMINADO: 0, otros: 0, total: 0 };
            }
            acumDG[dg].total += n;
            if (e === "SIN INICIAR")   acumDG[dg].SIN_INICIAR += n;
            else if (e === "EN PROCESO") acumDG[dg].EN_PROCESO += n;
            else if (e === "TERMINADO")  acumDG[dg].TERMINADO  += n;
            else acumDG[dg].otros += n;
          }
        }
      } catch (tableErr) {
        logger.warn("kpis", `Skip ${nombreTabla}: ${tableErr.message}`);
      }
    }

    const porDireccionGeneral = Object.entries(acumDG)
      .map(([dg, stats]) => ({ direccion_general: dg, ...stats }))
      .sort((a, b) => b.total - a.total);

    const ms = Date.now() - inicio;
    logger.info("kpis", `Summary: ${globalTotal} obras, ${globalTerm} terminadas, ${ms}ms`);

    return res.json({
      success: true,
      resumen_global: {
        total:        globalTotal,
        SIN_INICIAR:  globalSinIni,
        EN_PROCESO:   globalEnProc,
        TERMINADO:    globalTerm,
        promedio_avance_global: globalTotal > 0
          ? +(globalSumAvance / globalTotal).toFixed(2)
          : 0,
      },
      por_tabla:             porTabla,
      por_direccion_general: porDireccionGeneral,
      ms,
    });
  } catch (err) {
    logger.error("kpis", `Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: "Error al calcular KPIs.",
      detail: err.message,
    });
  }
}

module.exports = { kpisSummary };
