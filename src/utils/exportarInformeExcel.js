/**
 * utils/exportarInformeExcel.js
 * Descarga del Informe de avance físico financiero en .xlsx.
 *
 * Ajuste de fondo (área técnica, 11 de agosto): la carátula trae los
 * DOS contratos (obra y supervisión externa, cada uno como registro
 * independiente con su propio importe), la tabla general ya no compara
 * "supervisión interna vs. externa" (lógica equivocada — son dos
 * contratos, no dos observadores del mismo dato), cada tabla lleva su
 * encabezado (número/descripción/empresa/monto) y los montos/
 * porcentajes se cierran a dos decimales.
 *
 * Nota honesta: ExcelJS no soporta insertar gráficos nativos de Excel
 * (solo celdas, estilos e imágenes) — por eso la hoja "GRÁFICA" trae los
 * datos ya listos para seleccionar e insertar un gráfico de líneas con
 * dos clics en Excel, en vez de traer el gráfico ya incrustado.
 */
import ExcelJS from "exceljs";
import { importeRealDeAvance, saldoPendientePorEstimar } from "./avanceFisicoFinanciero";

const GRIS_ENCABEZADO = "FFD9D9D9";
const GUINDA = "FF691C32";
const ORO = "FFEFE2CB";
const AMARILLO = "FFFFF2CC";
const VERDE_CLARO = "FFCCFFCC";

function formatoMoneda(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatoPct(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function bandaTitulo(sheet, texto, fila, colInicio, colFin, opciones = {}) {
  sheet.mergeCells(fila, colInicio, fila, colFin);
  const celda = sheet.getCell(fila, colInicio);
  celda.value = texto;
  celda.font = { bold: true, size: opciones.size || 10 };
  celda.alignment = { horizontal: "center", vertical: "middle" };
  celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opciones.color || GRIS_ENCABEZADO } };
  for (let c = colInicio; c <= colFin; c++) {
    sheet.getCell(fila, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  }
  return fila + 1;
}

function escribirFilaValores(sheet, fila, colInicio, valores, opciones = {}) {
  const { numFmtCols = [], highlightArgb = null } = opciones;
  valores.forEach((v, i) => {
    const celda = sheet.getCell(fila, colInicio + i);
    celda.value = v;
    celda.font = { size: 8 };
    if (numFmtCols.includes(i)) celda.numFmt = "$#,##0.00";
    celda.alignment = { horizontal: i === 1 ? "left" : "center" };
    celda.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    if (highlightArgb) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: highlightArgb } };
  });
}

function filaEtiquetaValor(sheet, fila, etiqueta, valor, colEtiqueta = 1, colValorInicio = 2, colValorFin = 4) {
  const cEtiqueta = sheet.getCell(fila, colEtiqueta);
  cEtiqueta.value = etiqueta;
  cEtiqueta.font = { bold: true, size: 9 };
  cEtiqueta.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

  sheet.mergeCells(fila, colValorInicio, fila, colValorFin);
  const cValor = sheet.getCell(fila, colValorInicio);
  cValor.value = valor ?? "—";
  cValor.font = { size: 9 };
  cValor.alignment = { wrapText: true };
  for (let c = colValorInicio; c <= colValorFin; c++) {
    sheet.getCell(fila, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  }
  return fila + 1;
}

/* Encabezado por tabla (ajuste de fondo): una supervisión puede cubrir
   varias empresas con un mismo contrato — sin número/descripción/
   empresa/monto a la vista es imposible saber de qué empresa es cada
   tabla. */
function encabezadoContrato(sheet, fila, etiqueta, caratula, vacio, colFin = 4) {
  fila = bandaTitulo(sheet, etiqueta, fila, 1, colFin, { color: ORO });
  if (vacio) {
    sheet.mergeCells(fila, 1, fila, colFin);
    const celda = sheet.getCell(fila, 1);
    celda.value = "Sin contrato de supervisión vinculado todavía.";
    celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    return fila + 1;
  }
  fila = filaEtiquetaValor(sheet, fila, "No. DE CONTRATO", caratula.numero_contrato, 1, 2, colFin);
  fila = filaEtiquetaValor(sheet, fila, "DESCRIPCIÓN", caratula.objeto_contrato, 1, 2, colFin);
  fila = filaEtiquetaValor(sheet, fila, "EMPRESA", caratula.contratista, 1, 2, colFin);
  fila = filaEtiquetaValor(sheet, fila, "MONTO CON IVA", formatoMoneda(caratula.importe_total), 1, 2, colFin);
  return fila;
}

function hojaCaratula(workbook, caratula, caratulaSupervision, obra) {
  const sheet = workbook.addWorksheet("CARATULA");
  sheet.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
  const haySupervision = !!caratulaSupervision?.numero_contrato;

  let fila = 1;
  fila = bandaTitulo(sheet, "CONTRATO DE OBRA", fila, 1, 4, { size: 11 });
  fila = filaEtiquetaValor(sheet, fila, "NOMBRE CONSTRUCTORA", caratula.contratista);
  fila = filaEtiquetaValor(sheet, fila, "REPRESENTANTE LEGAL", caratula.representante_legal);
  fila = filaEtiquetaValor(sheet, fila, "DIRECCIÓN FISCAL", caratula.domicilio_fiscal);
  fila = filaEtiquetaValor(sheet, fila, "No. DE CONTRATO", caratula.numero_contrato);
  fila = filaEtiquetaValor(sheet, fila, "FECHA", caratula.fecha_contrato);
  fila = filaEtiquetaValor(sheet, fila, "OBJETO DEL CONTRATO", caratula.objeto_contrato);
  fila = filaEtiquetaValor(sheet, fila, "IMPORTE SIN IVA", formatoMoneda(caratula.importe_sin_iva));
  fila = filaEtiquetaValor(sheet, fila, "I.V.A.", formatoMoneda(caratula.iva));
  fila = filaEtiquetaValor(sheet, fila, "IMPORTE TOTAL C/IVA", formatoMoneda(caratula.importe_total));
  fila = filaEtiquetaValor(sheet, fila, "FECHA DE INICIO PROGRAMADA", caratula.fecha_inicio);
  fila = filaEtiquetaValor(sheet, fila, "FECHA DE TERMINACIÓN PROGRAMADA", caratula.fecha_termino);
  fila = filaEtiquetaValor(sheet, fila, "DÍAS NATURALES", caratula.dias_naturales);
  fila = filaEtiquetaValor(sheet, fila, "NÚMERO DE FRENTES", caratula.numero_frentes);
  fila = filaEtiquetaValor(sheet, fila, "ALCANCE POR FRENTE", caratula.alcance_frentes);
  fila += 1;

  fila = bandaTitulo(sheet, "CONTRATO DE SUPERVISIÓN EXTERNA", fila, 1, 4, { color: ORO });
  if (haySupervision) {
    fila = filaEtiquetaValor(sheet, fila, "No. DE CONTRATO", caratulaSupervision.numero_contrato);
    fila = filaEtiquetaValor(sheet, fila, "EMPRESA", caratulaSupervision.contratista);
    fila = filaEtiquetaValor(sheet, fila, "REPRESENTANTE LEGAL", caratulaSupervision.representante_legal);
    fila = filaEtiquetaValor(sheet, fila, "OBJETO DEL CONTRATO", caratulaSupervision.objeto_contrato);
    fila = filaEtiquetaValor(sheet, fila, "IMPORTE TOTAL C/IVA", formatoMoneda(caratulaSupervision.importe_total));
    fila = filaEtiquetaValor(sheet, fila, "FECHA DE INICIO", caratulaSupervision.fecha_inicio);
  } else {
    sheet.mergeCells(fila, 1, fila, 4);
    const celda = sheet.getCell(fila, 1);
    celda.value = "Sin contrato de supervisión vinculado todavía.";
    celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    fila += 1;
  }
  fila += 1;

  fila = bandaTitulo(sheet, "DATOS CONTRACTUALES FINANCIEROS (CONTRATO DE OBRA)", fila, 1, 4);
  for (const d of caratula.deducciones || []) {
    fila = filaEtiquetaValor(sheet, fila, `DEDUCCIÓN — ${d.concepto}`, formatoPct(d.porcentaje));
  }
  for (const s of caratula.sanciones || []) {
    fila = filaEtiquetaValor(sheet, fila, `SANCIÓN — ${s.concepto}`, `${formatoPct(s.porcentaje)} · ${s.diasPermitidos} días permitidos`);
  }
  fila = filaEtiquetaValor(sheet, fila, "RETENCIÓN POR ATRASO", formatoPct(caratula.retencion_porcentaje || 0));

  return sheet;
}

/* Tabla de avance por semana — Programado / Real / Financiero / Importe
   real c/IVA (ajuste de reunión, 12 de agosto, A2: el % financiero se
   agrega, no sustituye el importe — el formato oficial trae los dos).
   Solo se usa en la hoja "TABLA GENERAL"; la hoja "GRÁFICA" tiene su
   propia tabla (tablaSerieFinanciera, sin importe, calcada del Excel
   original). */
function tablaAvance(sheet, filaInicio, colInicio, semanas, financiero, importeTotal) {
  let fila = filaInicio;
  fila = bandaTitulo(sheet, "AVANCE POR SEMANA", fila, colInicio, colInicio + 5, { color: AMARILLO });

  const financieroPorSemana = {};
  for (const f of financiero || []) financieroPorSemana[f.numero] = f.porcentajeFinanciero;

  const headerFila = fila;
  const encabezados = ["No.", "PERIODO", "% PROG.", "% REAL", "% FINANCIERO", "IMPORTE REAL C/IVA"];
  encabezados.forEach((h, i) => {
    const celda = sheet.getCell(headerFila, colInicio + i);
    celda.value = h;
    celda.font = { bold: true, size: 8 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_ENCABEZADO } };
    celda.alignment = { horizontal: "center", wrapText: true };
    celda.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  fila += 1;

  for (const s of semanas) {
    const esUltima = s.numero === semanas[semanas.length - 1].numero;
    const valores = [
      s.numero,
      `${s.periodoDel} al ${s.periodoAl}`,
      formatoPct(s.avanceProgramado),
      formatoPct(s.avanceReal),
      formatoPct(financieroPorSemana[s.numero] ?? 0),
      formatoMoneda(importeRealDeAvance(s.avanceReal, importeTotal) ?? 0),
    ];
    escribirFilaValores(sheet, fila, colInicio, valores, { highlightArgb: esUltima ? VERDE_CLARO : null, numFmtCols: [5] });
    fila += 1;
  }
  return fila;
}

function hojaTablaGeneral(workbook, caratula, caratulaSupervision, semanasFisico, opciones = {}) {
  const { faltaCaratulaSupervision = false, semanasFisicoSupervision = [], semanasFinanciero = [], semanasFinancieroSupervision = [] } = opciones;
  const sheet = workbook.addWorksheet("TABLA GENERAL");
  sheet.columns = [{ width: 6 }, { width: 22 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 16 }];

  let fila = encabezadoContrato(sheet, 1, "CONTRATO DE OBRA", caratula, false, 6);
  fila = tablaAvance(sheet, fila, 1, semanasFisico, semanasFinanciero, caratula.importe_total);
  fila += 1;

  const haySupervision = !!caratulaSupervision?.numero_contrato;
  fila = encabezadoContrato(sheet, fila, "CONTRATO DE SUPERVISIÓN EXTERNA", caratulaSupervision, !haySupervision, 6);
  if (haySupervision) {
    if (faltaCaratulaSupervision) {
      const celda = sheet.getCell(fila, 1);
      sheet.mergeCells(fila, 1, fila, 6);
      celda.value = "Falta completar la carátula de este contrato para calcular su avance.";
      celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    } else if (semanasFisicoSupervision.length === 0) {
      const celda = sheet.getCell(fila, 1);
      sheet.mergeCells(fila, 1, fila, 6);
      celda.value = "Sin avance capturado todavía.";
      celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    } else {
      tablaAvance(sheet, fila, 1, semanasFisicoSupervision, semanasFinancieroSupervision, caratulaSupervision.importe_total);
    }
  }
  return sheet;
}

function bloqueEstimaciones(sheet, filaInicio, colFin, etiquetaContrato, caratula, estimaciones, vacio) {
  let fila = encabezadoContrato(sheet, filaInicio, etiquetaContrato, caratula, vacio, colFin);
  fila += 1;

  if (vacio) return fila;

  if (estimaciones.length === 0) {
    const celda = sheet.getCell(fila, 1);
    sheet.mergeCells(fila, 1, fila, colFin);
    celda.value = "Sin estimaciones capturadas.";
    celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    return fila + 2;
  }

  const headerFila = fila;
  const encabezados = ["No. ESTIMACIÓN", "IDENTIFICADOR", "PERIODO", "SIN IVA", "CON IVA", "DEDUCCIONES", "LÍQUIDO A PAGAR", "% ACUMULADO", "SEMANA"];
  encabezados.forEach((h, i) => {
    const celda = sheet.getCell(headerFila, i + 1);
    celda.value = h;
    celda.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GUINDA } };
    celda.alignment = { horizontal: "center", wrapText: true };
    celda.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  fila += 1;

  for (const e of estimaciones) {
    const valores = [
      e.noEstimacion,
      e.identificador || "—",
      `${e.periodoDel} al ${e.periodoAl}`,
      formatoMoneda(e.montoSinIva),
      formatoMoneda(e.montoConIva),
      formatoMoneda(e.deduccionesTotales),
      formatoMoneda(e.liquido),
      formatoPct(e.porcentajeAcumulado),
      e.semanaNumero ?? "—",
    ];
    escribirFilaValores(sheet, fila, 1, valores, { numFmtCols: [3, 4, 5, 6] });
    fila += 1;
  }

  fila += 1;
  const saldo = saldoPendientePorEstimar(estimaciones, caratula);
  fila = bandaTitulo(sheet, "SALDO PENDIENTE POR ESTIMAR", fila, 1, 9);
  fila = filaEtiquetaValor(sheet, fila, "IMPORTE DEL CONTRATO", formatoMoneda(saldo.importeTotal), 1, 2, 4);
  fila = filaEtiquetaValor(sheet, fila, "ESTIMADO A LA FECHA", formatoMoneda(saldo.acumulado), 1, 2, 4);
  fila = filaEtiquetaValor(sheet, fila, "PENDIENTE POR ESTIMAR", formatoMoneda(saldo.pendiente), 1, 2, 4);

  return fila + 1;
}

function hojaEstimaciones(workbook, caratula, estimacionesCalculadas, caratulaSupervision, opciones = {}) {
  const { faltaCaratulaSupervision = false, estimacionesCalculadasSupervision = [] } = opciones;
  const sheet = workbook.addWorksheet("ESTIMACIONES");
  sheet.columns = [
    { width: 12 }, { width: 14 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 10 },
  ];

  let fila = bloqueEstimaciones(sheet, 1, 9, "CONTRATO DE OBRA", caratula, estimacionesCalculadas, false);

  const haySupervision = !!caratulaSupervision?.numero_contrato;
  fila += 1;
  if (!haySupervision) {
    bloqueEstimaciones(sheet, fila, 9, "CONTRATO DE SUPERVISIÓN EXTERNA", caratulaSupervision, [], true);
  } else if (faltaCaratulaSupervision) {
    fila = encabezadoContrato(sheet, fila, "CONTRATO DE SUPERVISIÓN EXTERNA", caratulaSupervision, false, 9);
    const celda = sheet.getCell(fila, 1);
    sheet.mergeCells(fila, 1, fila, 9);
    celda.value = "Falta completar la carátula de este contrato para calcular sus estimaciones.";
    celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
  } else {
    bloqueEstimaciones(sheet, fila, 9, "CONTRATO DE SUPERVISIÓN EXTERNA", caratulaSupervision, estimacionesCalculadasSupervision, false);
  }

  return sheet;
}

/* La gráfica combina programado + real + financiero — ya no hay
   columna de "supervisión interna" (lógica eliminada, ajuste de
   fondo). Va después de las estimaciones porque el % financiero solo
   existe una vez que se reportaron. Título + banda de contratista +
   resaltado verde en la última semana: calcado de la hoja "GRÁFICA"
   del Excel original (captura del área usuaria, 12 de agosto). */
function tablaSerieFinanciera(sheet, filaInicio, titulo, semanasFinancieroPorSemana, caratula) {
  let fila = bandaTitulo(sheet, titulo, filaInicio, 1, 5, { size: 11 });
  fila = bandaTitulo(sheet, caratula.contratista || "—", fila, 1, 5, { color: GUINDA });
  sheet.getCell(fila - 1, 1).font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
  fila += 1;

  const headerFila = fila;
  ["SEMANA No.", "PERIODO", "% PROGRAMADO", "% REAL", "% AVANCE FINANCIERO"].forEach((h, i) => {
    const celda = sheet.getCell(headerFila, i + 1);
    celda.value = h;
    celda.font = { bold: true, size: 8 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_ENCABEZADO } };
    celda.alignment = { horizontal: "center", wrapText: true };
    celda.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  fila += 1;

  if (semanasFinancieroPorSemana.length === 0) {
    const celda = sheet.getCell(fila, 1);
    sheet.mergeCells(fila, 1, fila, 5);
    celda.value = "Sin avance capturado todavía.";
    celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    fila += 1;
  } else {
    for (const s of semanasFinancieroPorSemana) {
      const esUltima = s.numero === semanasFinancieroPorSemana[semanasFinancieroPorSemana.length - 1].numero;
      const valores = [
        s.numero,
        `${s.periodoDel} al ${s.periodoAl}`,
        formatoPct(s.avanceProgramado),
        s.avanceReal != null ? formatoPct(s.avanceReal) : "—",
        s.porcentajeFinanciero != null ? formatoPct(s.porcentajeFinanciero) : "—",
      ];
      escribirFilaValores(sheet, fila, 1, valores, { highlightArgb: esUltima ? VERDE_CLARO : null });
      fila += 1;
    }
  }

  fila += 1;
  const nota = sheet.getCell(fila, 1);
  sheet.mergeCells(fila, 1, fila, 5);
  nota.value = "Para ver la curva: selecciona esta tabla en Excel → Insertar → Gráfico de líneas.";
  nota.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };

  fila += 2;
  fila = filaEtiquetaValor(sheet, fila, "FECHA DE INICIO PROGRAMADA", caratula.fecha_inicio, 1, 2, 3);
  fila = filaEtiquetaValor(sheet, fila, "FECHA DE TERMINACIÓN", caratula.fecha_termino, 1, 2, 3);

  return fila + 2;
}

function hojaGrafica(workbook, semanasFinancieroPorSemana, caratula, opciones = {}) {
  const { caratulaSupervision, faltaCaratulaSupervision = false, semanasFinancieroPorSemanaSupervision = [] } = opciones;
  const sheet = workbook.addWorksheet("GRAFICA");
  sheet.columns = [{ width: 10 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 18 }];

  let fila = tablaSerieFinanciera(sheet, 1, "CURVA DE AVANCE — CONTRATO DE OBRA", semanasFinancieroPorSemana, caratula);

  const haySupervision = !!caratulaSupervision?.numero_contrato;
  if (haySupervision) {
    fila += 1;
    if (faltaCaratulaSupervision) {
      fila = bandaTitulo(sheet, "CURVA DE AVANCE — CONTRATO DE SUPERVISIÓN EXTERNA", fila, 1, 5, { size: 11, color: ORO });
      const celda = sheet.getCell(fila, 1);
      sheet.mergeCells(fila, 1, fila, 5);
      celda.value = "Falta completar la carátula de este contrato para calcular su curva.";
      celda.font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    } else {
      tablaSerieFinanciera(sheet, fila, "CURVA DE AVANCE — CONTRATO DE SUPERVISIÓN EXTERNA", semanasFinancieroPorSemanaSupervision, caratulaSupervision);
    }
  }

  return sheet;
}

export async function exportarInformeExcel({
  obra,
  caratula,
  caratulaSupervision,
  semanasFisico,
  semanasFinanciero,
  estimacionesCalculadas,
  faltaCaratulaSupervision = false,
  semanasFisicoSupervision = [],
  semanasFinancieroSupervision = [],
  estimacionesCalculadasSupervision = [],
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SEGUIMIENTO_PS 2.0";
  workbook.created = new Date();

  hojaCaratula(workbook, caratula, caratulaSupervision, obra);
  hojaTablaGeneral(workbook, caratula, caratulaSupervision, semanasFisico, { faltaCaratulaSupervision, semanasFisicoSupervision, semanasFinanciero, semanasFinancieroSupervision });
  hojaEstimaciones(workbook, caratula, estimacionesCalculadas, caratulaSupervision, { faltaCaratulaSupervision, estimacionesCalculadasSupervision });

  const semanasFinancieroCompleto = semanasFisico.map((s) => ({
    ...s,
    porcentajeFinanciero: semanasFinanciero.find((f) => f.numero === s.numero)?.porcentajeFinanciero ?? null,
  }));
  const semanasFinancieroCompletoSupervision = semanasFisicoSupervision.map((s) => ({
    ...s,
    porcentajeFinanciero: semanasFinancieroSupervision.find((f) => f.numero === s.numero)?.porcentajeFinanciero ?? null,
  }));
  hojaGrafica(workbook, semanasFinancieroCompleto, caratula, {
    caratulaSupervision,
    faltaCaratulaSupervision,
    semanasFinancieroPorSemanaSupervision: semanasFinancieroCompletoSupervision,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const nombreObra = (obra?.nombre_obra || obra?.nombre || "obra").replace(/[^a-z0-9]/gi, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `Informe_Avance_Fisico_Financiero_${nombreObra}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
