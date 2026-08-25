/**
 * controllers/reporteCoberturaCtrl.js
 * Reporte Ejecutivo de Control de Cobertura.
 *
 * GET /api/cobertura/reporte  — JSON completo con KPIs, aggregaciones DG/Programa y listado de obras
 * GET /api/cobertura/excel    — Descarga XLSX con 4 hojas institucionales
 */

const { query, SCHEMA } = require("../config/pg");
const ExcelJS = require("exceljs");
const { getProgSeguimientoMap, applySegMap } = require("../utils/seguimientoMap");

/* ── SQL base: igual que coberturaCtrl + total_conceptos ── */
const BASE_SQL = `
  WITH todas_obras AS (
    SELECT
      clave_unica,
      "NOMBRE_OBRA"  AS nombre_obra,
      "PROGRAMA"     AS programa,
      "DG"           AS dg,
      "ALCALDIA"     AS alcaldia,
      ''::text       AS area
    FROM "${SCHEMA}".obras_puntos
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
    UNION
    SELECT
      clave_unica,
      "NOMBRE_OBRA"  AS nombre_obra,
      "PROGRAMA"     AS programa,
      "DG"           AS dg,
      "ALCALDIA"     AS alcaldia,
      ''::text       AS area
    FROM "${SCHEMA}".obras_lineas
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
    UNION
    SELECT
      clave_unica,
      "NOMBRE_OBRA"  AS nombre_obra,
      "PROGRAMA"     AS programa,
      "DG"           AS dg,
      "ALCALDIA"     AS alcaldia,
      ''::text       AS area
    FROM "${SCHEMA}".obras_poligonos
    WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::text) <> ''
  ),
  alcances_agg AS (
    SELECT
      BTRIM(clave_unica::text)        AS clave_unica,
      COUNT(*)::int                   AS total_alcances,
      COUNT(DISTINCT concepto)::int   AS total_conceptos,
      MAX(fecha_captura)              AS ultima_captura,
      (ARRAY_AGG(usuario_actualizacion ORDER BY fecha_captura DESC))[1] AS ultimo_usuario
    FROM "${SCHEMA}".alcances_obras
    GROUP BY BTRIM(clave_unica::text)
  )
  SELECT
    BTRIM(o.clave_unica::text)      AS clave_unica,
    o.nombre_obra,
    o.programa,
    o.dg,
    o.alcaldia,
    o.area,
    (a.clave_unica IS NOT NULL)     AS tiene_alcances,
    COALESCE(a.total_alcances,  0)  AS total_alcances,
    COALESCE(a.total_conceptos, 0)  AS total_conceptos,
    a.ultima_captura,
    a.ultimo_usuario,
    t.tipo_alcance                  AS tipo_alcance_obra
  FROM todas_obras o
  LEFT JOIN alcances_agg a ON a.clave_unica = BTRIM(o.clave_unica::text)
  LEFT JOIN "${SCHEMA}".alcances_obras_tipo t ON t.clave_unica = BTRIM(o.clave_unica::text)
  WHERE
    ($1::text IS NULL OR o.programa   = $1)
    AND ($2::text IS NULL OR o.alcaldia = $2)
    AND ($3::int  IS NULL OR EXTRACT(YEAR FROM a.ultima_captura) = $3)
  ORDER BY o.programa, BTRIM(o.clave_unica::text)
`;

function parseParams({ programa, dg, alcaldia, anio }) {
  return {
    sqlParams: [programa || null, alcaldia || null, anio ? parseInt(anio, 10) : null],
    dgFilter:  dg || null,
  };
}

/* ── Aggregaciones en JS ── */
function buildAggregations(rows) {
  const dgMap   = {};
  const progMap = {};

  for (const r of rows) {
    const dg   = r.dg       || "SIN DIRECCIÓN";
    const prog = r.programa || "SIN PROGRAMA";

    if (!dgMap[dg]) {
      dgMap[dg] = {
        dg,
        obras_total: 0, obras_con: 0, obras_sin: 0,
        total_alcances: 0, total_conceptos: 0,
        programas: new Set(),
      };
    }
    dgMap[dg].obras_total++;
    if (r.tiene_alcances) {
      dgMap[dg].obras_con++;
      dgMap[dg].total_alcances  += Number(r.total_alcances);
      dgMap[dg].total_conceptos += Number(r.total_conceptos);
    } else {
      dgMap[dg].obras_sin++;
    }
    if (r.programa) dgMap[dg].programas.add(r.programa);

    if (!progMap[prog]) {
      progMap[prog] = {
        programa: prog, dg,
        obras_total: 0, obras_con: 0, obras_sin: 0,
        total_alcances: 0, total_conceptos: 0,
        ultima_captura: null,
      };
    }
    progMap[prog].obras_total++;
    if (r.tiene_alcances) {
      progMap[prog].obras_con++;
      progMap[prog].total_alcances  += Number(r.total_alcances);
      progMap[prog].total_conceptos += Number(r.total_conceptos);
      if (r.ultima_captura && (!progMap[prog].ultima_captura || r.ultima_captura > progMap[prog].ultima_captura)) {
        progMap[prog].ultima_captura = r.ultima_captura;
      }
    } else {
      progMap[prog].obras_sin++;
    }
  }

  const pct = (con, total) =>
    total ? parseFloat(((con / total) * 100).toFixed(1)) : 0;

  const porDG = Object.values(dgMap)
    .map((d) => ({
      dg:                  d.dg,
      obras_total:         d.obras_total,
      obras_con_alcances:  d.obras_con,
      obras_sin_alcances:  d.obras_sin,
      cobertura_pct:       pct(d.obras_con, d.obras_total),
      total_alcances:      d.total_alcances,
      total_conceptos:     d.total_conceptos,
      programas_count:     d.programas.size,
      programas:           [...d.programas].sort(),
    }))
    .sort((a, b) => b.cobertura_pct - a.cobertura_pct);

  const porPrograma = Object.values(progMap)
    .map((p) => ({
      programa:            p.programa,
      dg:                  p.dg,
      obras_total:         p.obras_total,
      obras_con_alcances:  p.obras_con,
      obras_sin_alcances:  p.obras_sin,
      cobertura_pct:       pct(p.obras_con, p.obras_total),
      total_alcances:      p.total_alcances,
      total_conceptos:     p.total_conceptos,
      ultima_captura:      p.ultima_captura,
    }))
    .sort((a, b) => b.cobertura_pct - a.cobertura_pct);

  return { porDG, porPrograma };
}

/* ════════════════════════════════════════
   GET /api/cobertura/reporte
════════════════════════════════════════ */
exports.getReporte = async (req, res) => {
  const { sqlParams, dgFilter } = parseParams(req.query);
  try {
    const [result, segMap] = await Promise.all([
      query(BASE_SQL, sqlParams),
      getProgSeguimientoMap(),
    ]);
    const rows = applySegMap(result.rows, segMap, dgFilter);

    const conAlcances = rows.filter((r) => r.tiene_alcances);
    const sinAlcances = rows.filter((r) => !r.tiene_alcances);

    const totalAlcances   = conAlcances.reduce((s, r) => s + Number(r.total_alcances),  0);
    const totalConceptos  = conAlcances.reduce((s, r) => s + Number(r.total_conceptos), 0);
    const ultimaAct       = conAlcances.length
      ? conAlcances.reduce((mx, r) =>
          r.ultima_captura && r.ultima_captura > mx ? r.ultima_captura : mx,
          conAlcances[0].ultima_captura)
      : null;

    const dgsSet      = new Set(rows.map((r) => r.dg).filter(Boolean));
    const programasSet= new Set(rows.map((r) => r.programa).filter(Boolean));

    const { porDG, porPrograma } = buildAggregations(rows);

    res.json({
      success: true,
      generado_en: new Date().toLocaleString("es-MX"),
      filtros: {
        programa:  sqlParams[0],
        dg:        dgFilter,
        alcaldia:  sqlParams[1],
        anio:      sqlParams[2],
      },
      kpis: {
        total_obras:              rows.length,
        obras_con_alcances:       conAlcances.length,
        obras_sin_alcances:       sinAlcances.length,
        cobertura_pct:            rows.length
          ? parseFloat(((conAlcances.length / rows.length) * 100).toFixed(1))
          : 0,
        total_alcances:           totalAlcances,
        total_conceptos:          totalConceptos,
        dgs_participantes:        dgsSet.size,
        programas_participantes:  programasSet.size,
        ultima_actualizacion:     ultimaAct,
      },
      por_dg:              porDG,
      por_programa:        porPrograma,
      obras_con_alcances:  conAlcances,
      obras_sin_alcances:  sinAlcances,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════
   GET /api/cobertura/excel
════════════════════════════════════════ */
exports.exportarExcel = async (req, res) => {
  const { sqlParams, dgFilter } = parseParams(req.query);
  try {
    const [result, segMap] = await Promise.all([
      query(BASE_SQL, sqlParams),
      getProgSeguimientoMap(),
    ]);
    const rows = applySegMap(result.rows, segMap, dgFilter);

    const conAlcances    = rows.filter((r) => r.tiene_alcances);
    const sinAlcances    = rows.filter((r) => !r.tiene_alcances);
    const totalAlcances  = conAlcances.reduce((s, r) => s + Number(r.total_alcances),  0);
    const totalConceptos = conAlcances.reduce((s, r) => s + Number(r.total_conceptos), 0);
    const coberturaPct   = rows.length
      ? parseFloat(((conAlcances.length / rows.length) * 100).toFixed(1))
      : 0;

    const { porDG, porPrograma } = buildAggregations(rows);

    /* ── Estilos ── */
    const BURDEOS = "FF691C32";
    const VERDE   = "FF166534";
    const ROJO    = "FFB91C1C";
    const NARANJA = "FFD97706";
    const BEIGE   = "FFF5F3F0";
    const WHITE   = "FFFFFFFF";
    const GRIS    = "FF64748B";

    const hdrStyle = {
      font:      { bold: true, color: { argb: WHITE }, size: 10 },
      fill:      { type: "pattern", pattern: "solid", fgColor: { argb: BURDEOS } },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    };

    function rowFill(i) {
      return { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? BEIGE : WHITE } };
    }

    function pctFont(pct, i) {
      const argb = pct >= 70 ? VERDE : pct >= 40 ? NARANJA : ROJO;
      return { bold: true, color: { argb }, size: 10 };
    }

    function fmtDate(ts) {
      if (!ts) return "—";
      return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "SICOPS — PLATAFORMA SOBSE";
    wb.created = new Date();

    /* ── HOJA 1: RESUMEN EJECUTIVO ── */
    const ws1 = wb.addWorksheet("Resumen Ejecutivo");
    ws1.mergeCells("A1:C1");
    const titCell = ws1.getCell("A1");
    titCell.value = "PLATAFORMA SOBSE — CONTROL DE COBERTURA — REPORTE EJECUTIVO";
    titCell.style = {
      font:      { bold: true, size: 13, color: { argb: WHITE } },
      fill:      { type: "pattern", pattern: "solid", fgColor: { argb: BURDEOS } },
      alignment: { horizontal: "center", vertical: "middle" },
    };
    ws1.getRow(1).height = 28;

    ws1.mergeCells("A2:C2");
    const genCell = ws1.getCell("A2");
    genCell.value = `Generado: ${new Date().toLocaleString("es-MX")}`;
    genCell.style = {
      font: { size: 10, color: { argb: GRIS } },
      alignment: { horizontal: "center" },
    };

    ws1.addRow([]);
    const hdr1 = ws1.addRow(["INDICADOR", "VALOR", ""]);
    hdr1.eachCell((c) => { c.style = hdrStyle; });

    const kpiRows = [
      ["Total de obras",                    rows.length],
      ["Obras con alcances",                 conAlcances.length],
      ["Obras sin alcances",                 sinAlcances.length],
      ["Porcentaje de cobertura",            `${coberturaPct}%`],
      ["Total de alcances registrados",       totalAlcances],
      ["Total de conceptos registrados",      totalConceptos],
      ["DG participantes",                   new Set(rows.map((r) => r.dg).filter(Boolean)).size],
      ["Programas participantes",            new Set(rows.map((r) => r.programa).filter(Boolean)).size],
      ["Última actualización",               fmtDate(conAlcances.length
        ? conAlcances.reduce((mx, r) => r.ultima_captura > mx ? r.ultima_captura : mx, conAlcances[0].ultima_captura)
        : null)],
    ];
    kpiRows.forEach(([label, val], i) => {
      const r = ws1.addRow([label, val, ""]);
      r.getCell(1).style = { fill: rowFill(i), font: { size: 10 }, alignment: { vertical: "middle" } };
      r.getCell(2).style = { fill: rowFill(i), font: { bold: true, size: 11 }, alignment: { horizontal: "center", vertical: "middle" } };
    });
    ws1.columns = [{ width: 40 }, { width: 20 }, { width: 10 }];

    /* ── HOJA 2: POR DG ── */
    const ws2 = wb.addWorksheet("Por DG");
    ws2.columns = [
      { header: "DIRECCIÓN GENERAL",  key: "dg",                 width: 32 },
      { header: "OBRAS TOTAL",         key: "obras_total",        width: 14 },
      { header: "CON ALCANCES",        key: "obras_con_alcances", width: 16 },
      { header: "SIN ALCANCES",        key: "obras_sin_alcances", width: 16 },
      { header: "COBERTURA %",         key: "cobertura_pct",      width: 14 },
      { header: "TOTAL ALCANCES",      key: "total_alcances",     width: 16 },
      { header: "TOTAL CONCEPTOS",     key: "total_conceptos",    width: 18 },
      { header: "PROGRAMAS",           key: "programas_count",    width: 12 },
    ];
    ws2.getRow(1).eachCell((c) => { c.style = hdrStyle; });
    ws2.getRow(1).height = 24;
    ws2.views = [{ state: "frozen", ySplit: 1 }];

    porDG.forEach((d, i) => {
      const r = ws2.addRow({
        dg: d.dg, obras_total: d.obras_total,
        obras_con_alcances: d.obras_con_alcances, obras_sin_alcances: d.obras_sin_alcances,
        cobertura_pct: d.cobertura_pct,
        total_alcances: d.total_alcances, total_conceptos: d.total_conceptos,
        programas_count: d.programas_count,
      });
      const fill = rowFill(i);
      r.eachCell((c) => { c.style = { fill, font: { size: 10 }, alignment: { vertical: "middle" } }; });
      const pc = r.getCell("cobertura_pct");
      pc.value = `${d.cobertura_pct}%`;
      pc.style = { fill, font: pctFont(d.cobertura_pct, i), alignment: { horizontal: "center", vertical: "middle" } };
      r.getCell("obras_con_alcances").style = { fill, font: { bold: true, color: { argb: VERDE }, size: 10 }, alignment: { horizontal: "center", vertical: "middle" } };
      r.getCell("obras_sin_alcances").style = { fill, font: { bold: true, color: { argb: ROJO }, size: 10 }, alignment: { horizontal: "center", vertical: "middle" } };
    });

    /* ── HOJA 3: POR PROGRAMA ── */
    const ws3 = wb.addWorksheet("Por Programa");
    ws3.columns = [
      { header: "PROGRAMA",            key: "programa",           width: 42 },
      { header: "DG",                   key: "dg",                 width: 18 },
      { header: "OBRAS TOTAL",          key: "obras_total",        width: 14 },
      { header: "CON ALCANCES",         key: "obras_con_alcances", width: 16 },
      { header: "SIN ALCANCES",         key: "obras_sin_alcances", width: 16 },
      { header: "COBERTURA %",          key: "cobertura_pct",      width: 14 },
      { header: "TOTAL ALCANCES",       key: "total_alcances",     width: 16 },
      { header: "TOTAL CONCEPTOS",      key: "total_conceptos",    width: 18 },
      { header: "ÚLTIMA CAPTURA",       key: "ultima_captura",     width: 22 },
    ];
    ws3.getRow(1).eachCell((c) => { c.style = hdrStyle; });
    ws3.getRow(1).height = 24;
    ws3.views = [{ state: "frozen", ySplit: 1 }];

    porPrograma.forEach((p, i) => {
      const r = ws3.addRow({
        programa: p.programa, dg: p.dg,
        obras_total: p.obras_total,
        obras_con_alcances: p.obras_con_alcances,
        obras_sin_alcances: p.obras_sin_alcances,
        cobertura_pct: p.cobertura_pct,
        total_alcances: p.total_alcances,
        total_conceptos: p.total_conceptos,
        ultima_captura: fmtDate(p.ultima_captura),
      });
      const fill = rowFill(i);
      r.eachCell((c) => { c.style = { fill, font: { size: 10 }, alignment: { vertical: "middle" } }; });
      const pc = r.getCell("cobertura_pct");
      pc.value = `${p.cobertura_pct}%`;
      pc.style = { fill, font: pctFont(p.cobertura_pct, i), alignment: { horizontal: "center", vertical: "middle" } };
    });

    /* ── HOJA 4: DETALLE OBRAS ── */
    const ws4 = wb.addWorksheet("Detalle Obras");
    ws4.columns = [
      { header: "#",                   key: "num",               width: 6  },
      { header: "CLAVE ÚNICA",          key: "clave_unica",       width: 22 },
      { header: "NOMBRE DE LA OBRA",    key: "nombre_obra",       width: 45 },
      { header: "PROGRAMA",             key: "programa",          width: 32 },
      { header: "DG",                   key: "dg",                width: 16 },
      { header: "ALCALDÍA",             key: "alcaldia",          width: 18 },
      { header: "TIENE ALCANCES",       key: "tiene_alcances",    width: 16 },
      { header: "TOTAL ALCANCES",       key: "total_alcances",    width: 16 },
      { header: "TOTAL CONCEPTOS",      key: "total_conceptos",   width: 18 },
      { header: "TIPO",                 key: "tipo",              width: 14 },
      { header: "ÚLTIMA CAPTURA",       key: "ultima_captura",    width: 22 },
      { header: "RESPONSABLE",          key: "usuario",           width: 24 },
    ];
    ws4.getRow(1).eachCell((c) => { c.style = hdrStyle; });
    ws4.getRow(1).height = 24;
    ws4.views = [{ state: "frozen", ySplit: 1 }];

    rows.forEach((r, i) => {
      const row = ws4.addRow({
        num:            i + 1,
        clave_unica:    r.clave_unica,
        nombre_obra:    r.nombre_obra,
        programa:       r.programa,
        dg:             r.dg,
        alcaldia:       r.alcaldia,
        tiene_alcances: r.tiene_alcances ? "SÍ" : "NO",
        total_alcances: r.total_alcances,
        total_conceptos:r.total_conceptos,
        tipo:           r.tipo_alcance_obra || "—",
        ultima_captura: fmtDate(r.ultima_captura),
        usuario:        r.ultimo_usuario || "—",
      });
      const fill = rowFill(i);
      row.eachCell((c) => { c.style = { fill, font: { size: 10 }, alignment: { vertical: "middle" } }; });
      const tc = row.getCell("tiene_alcances");
      tc.style = r.tiene_alcances
        ? { fill, font: { bold: true, color: { argb: VERDE }, size: 10 }, alignment: { horizontal: "center" } }
        : { fill, font: { bold: true, color: { argb: ROJO  }, size: 10 }, alignment: { horizontal: "center" } };
    });

    const filename = `Cobertura_Alcances_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
