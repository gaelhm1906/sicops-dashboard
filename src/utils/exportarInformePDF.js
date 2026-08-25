/**
 * utils/exportarInformePDF.js
 * Descarga del Informe de avance físico financiero en .pdf, replicando
 * visualmente las mismas secciones que exportarInformeExcel.js
 * (Carátula, Tabla General, Estimaciones) pero además incrusta la
 * gráfica real — a diferencia de Excel, un PDF sí puede llevar una
 * imagen embebida, así que capturamos con html2canvas el mismo
 * componente <LineChartAvance> que el usuario ve en pantalla (mismos
 * colores, misma curva) en vez de recrearlo.
 *
 * Ajuste de fondo (área técnica, 11 de agosto): título "INFORME DE
 * AVANCE FÍSICO FINANCIERO", numeración 1 / 2.1 / 2.2, dos contratos
 * (obra y supervisión, cada uno como registro independiente) con su
 * propio encabezado por tabla, una sola gráfica (programado + real +
 * financiero) después de las estimaciones, y montos/porcentajes
 * cerrados a dos decimales.
 *
 * Ajuste de reunión (12 de agosto — "división por hojas de cada
 * sección" + "formato profesional al imprimir"): cada contrato de
 * cada sección (Carátula, 2.1, 2.2) va en su propia página — nunca
 * comparten hoja obra y supervisión — y todas las páginas llevan pie
 * de página (folio + fecha de generación + "Página X de Y"); las de
 * continuación (2+) además repiten un encabezado angosto con el
 * nombre del informe y de la obra, para que una hoja suelta impresa
 * siga siendo identificable por sí sola.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { importeRealDeAvance, saldoPendientePorEstimar } from "./avanceFisicoFinanciero";

const GUINDA = [105, 28, 50];
const ORO = [188, 149, 92];
const GRIS_ENCABEZADO = [217, 217, 217];
const VERDE_CLARO = [204, 255, 204];
const MARGEN = 32;

function formatoMoneda(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
}

function formatoPct(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function anchoUtilDe(doc) {
  return doc.internal.pageSize.getWidth() - MARGEN * 2;
}

function asegurarEspacio(doc, y, alturaNecesaria) {
  const alturaPagina = doc.internal.pageSize.getHeight();
  if (y + alturaNecesaria > alturaPagina - 30) {
    doc.addPage();
    return 40;
  }
  return y;
}

function tituloSeccion(doc, texto, y, color = GUINDA) {
  const ancho = anchoUtilDe(doc);
  doc.setFillColor(...color);
  doc.rect(MARGEN, y, ancho, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(texto, MARGEN + ancho / 2, y + 11, { align: "center" });
  doc.setTextColor(0, 0, 0);
  return y + 16;
}

function tablaEtiquetaValor(doc, y, filas) {
  const ancho = anchoUtilDe(doc);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    tableWidth: ancho,
    body: filas,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: ancho * 0.32 } },
  });
  return doc.lastAutoTable.finalY + 4;
}

function seccionEtiquetaValor(doc, y, titulo, filas, color) {
  if (filas.length === 0) return y;
  const alturaEstimada = 16 + filas.length * 14 + 10;
  y = asegurarEspacio(doc, y, alturaEstimada);
  y = tituloSeccion(doc, titulo, y, color);
  return tablaEtiquetaValor(doc, y, filas);
}

/* Encabezado por tabla (ajuste de fondo): una supervisión puede cubrir
   varias empresas con un mismo contrato — sin número/descripción/
   empresa/monto a la vista es imposible saber de qué empresa es cada
   tabla. */
function encabezadoContrato(doc, y, etiqueta, caratula, vacio) {
  if (vacio) {
    y = asegurarEspacio(doc, y, 30);
    y = tituloSeccion(doc, etiqueta, y, ORO);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Sin contrato de supervisión vinculado todavía.", MARGEN, y + 10);
    doc.setFont("helvetica", "normal");
    return y + 18;
  }
  return seccionEtiquetaValor(doc, y, etiqueta, [
    ["No. DE CONTRATO", caratula.numero_contrato || "—"],
    ["DESCRIPCIÓN", caratula.objeto_contrato || "—"],
    ["EMPRESA", caratula.contratista || "—"],
    ["MONTO CON IVA", formatoMoneda(caratula.importe_total)],
  ], ORO);
}

function formatoFechaGeneracion() {
  return new Date().toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* Ajuste de reunión (12 de agosto): "una hoja por sección" — cada
   contrato (obra/supervisión) de cada sección (Carátula/2.1/2.2) va en
   su propia página, y todas las páginas de continuación (2+) repiten
   un encabezado angosto con el nombre del informe y de la obra, para
   que una hoja suelta impresa sea identificable por sí sola. */
function dibujarEncabezadoContinuacion(doc, nombreObra) {
  const anchoPagina = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GUINDA);
  doc.text("INFORME DE AVANCE FÍSICO FINANCIERO", MARGEN, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(nombreObra, anchoPagina - MARGEN, 20, { align: "right" });
  doc.setDrawColor(...GUINDA);
  doc.setLineWidth(1);
  doc.line(MARGEN, 26, anchoPagina - MARGEN, 26);
  doc.setTextColor(0, 0, 0);
}

/* Pie de página profesional: folio + fecha de generación a la
   izquierda, "Página X de Y" a la derecha — en TODAS las páginas
   (incluida la portada). Se dibuja al final, en una pasada sobre todas
   las páginas ya generadas, porque el total de páginas solo se conoce
   hasta que el documento está completo. */
function dibujarPiePagina(doc, pagina, totalPaginas, fechaGeneracion) {
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const yPie = altoPagina - 22;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(MARGEN, yPie, anchoPagina - MARGEN, yPie);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(`SEGUIMIENTO_PS 2.0 · Generado el ${fechaGeneracion}`, MARGEN, yPie + 11);
  doc.text(`Página ${pagina} de ${totalPaginas}`, anchoPagina - MARGEN, yPie + 11, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

async function capturarElemento(el, anchoDestino) {
  if (!el) return null;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const dataUrl = canvas.toDataURL("image/png");
  const alto = (canvas.height / canvas.width) * anchoDestino;
  return { dataUrl, alto };
}

/* Tabla de avance semanal — Programado / Real / Financiero (ajuste de
   reunión, 12 de agosto, A2). Con `importeTotal` agrega una sexta
   columna de Importe real c/IVA — para el "Informe general de avance"
   (2.1), que sí la trae en el formato oficial. Sin ese argumento se
   queda en 5 columnas: es la misma tabla que se usa como "pie de
   gráfica" (A3), calcada de la hoja "GRÁFICA" del Excel original (esa
   hoja no lleva importe). */
function tablaAvancePDF(doc, y, semanas, financiero, importeTotal) {
  if (semanas.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Sin avance capturado todavía.", MARGEN, y + 8);
    doc.setFont("helvetica", "normal");
    return y + 20;
  }
  const financieroPorSemana = {};
  for (const f of financiero || []) financieroPorSemana[f.numero] = f.porcentajeFinanciero;
  const conImporte = importeTotal != null;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [conImporte
      ? ["No.", "PERIODO", "% PROG.", "% REAL", "% FINANCIERO", "IMPORTE REAL C/IVA"]
      : ["No.", "PERIODO", "% PROG.", "% REAL", "% FINANCIERO"]],
    body: semanas.map((s) => {
      const fila = [
        s.numero,
        `${s.periodoDel} al ${s.periodoAl}`,
        formatoPct(s.avanceProgramado),
        formatoPct(s.avanceReal),
        formatoPct(financieroPorSemana[s.numero] ?? 0),
      ];
      if (conImporte) fila.push(formatoMoneda(importeRealDeAvance(s.avanceReal, importeTotal) ?? 0));
      return fila;
    }),
    styles: { fontSize: 8, cellPadding: 3, halign: "center" },
    headStyles: { fillColor: GRIS_ENCABEZADO, textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 1: { halign: "left" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === semanas.length - 1) {
        data.cell.styles.fillColor = VERDE_CLARO;
      }
    },
  });
  return doc.lastAutoTable.finalY + 18;
}

/* Tabla de estimaciones + saldo pendiente — reutilizada para el
   contrato de obra y para el de supervisión. */
function tablaEstimacionesPDF(doc, y, estimaciones, caratula) {
  if (estimaciones.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Sin estimaciones capturadas.", MARGEN, y + 8);
    doc.setFont("helvetica", "normal");
    return y + 20;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [["No.", "IDENTIF.", "PERIODO", "SIN IVA", "CON IVA", "DEDUCCIONES", "LÍQUIDO", "% ACUM.", "SEM."]],
    body: estimaciones.map((e) => [
      e.noEstimacion,
      e.identificador || "—",
      `${e.periodoDel} al ${e.periodoAl}`,
      formatoMoneda(e.montoSinIva),
      formatoMoneda(e.montoConIva),
      formatoMoneda(e.deduccionesTotales),
      formatoMoneda(e.liquido),
      formatoPct(e.porcentajeAcumulado),
      e.semanaNumero ?? "—",
    ]),
    styles: { fontSize: 7, cellPadding: 3, halign: "center" },
    headStyles: { fillColor: GUINDA, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 2: { halign: "left" } },
  });
  y = doc.lastAutoTable.finalY + 18;

  const saldo = saldoPendientePorEstimar(estimaciones, caratula);
  return seccionEtiquetaValor(doc, y, "SALDO PENDIENTE POR ESTIMAR", [
    ["IMPORTE DEL CONTRATO", formatoMoneda(saldo.importeTotal)],
    ["ESTIMADO A LA FECHA", formatoMoneda(saldo.acumulado)],
    ["PENDIENTE POR ESTIMAR", formatoMoneda(saldo.pendiente)],
  ]);
}

export async function exportarInformePDF({
  obra,
  caratula,
  caratulaSupervision,
  semanasFisico,
  semanasFinanciero = [],
  estimacionesCalculadas,
  lineChartEl,
  faltaCaratulaSupervision,
  semanasFisicoSupervision = [],
  semanasFinancieroSupervision = [],
  estimacionesCalculadasSupervision = [],
  lineChartElSupervision,
}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const nombreObra = obra?.nombre_obra || obra?.nombre || "Obra";
  const ancho = anchoUtilDe(doc);
  const haySupervision = !!caratulaSupervision?.numero_contrato;

  doc.setFillColor(...GUINDA);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 46, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("INFORME DE AVANCE FÍSICO FINANCIERO", MARGEN, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(nombreObra, MARGEN, 34);
  doc.setTextColor(0, 0, 0);

  let y = 62;

  /* ── 1. Carátula — una hoja por contrato (ajuste de reunión, 12 de
     agosto: "una división por hojas de cada sección" para que el
     informe se lea e imprima como un expediente, no como una lista
     corrida). ── */
  y = tituloSeccion(doc, "1. CARÁTULA — CONTRATO DE OBRA", y);
  y += 4;
  y = seccionEtiquetaValor(doc, y, "DATOS DEL CONTRATO", [
    ["No. DE CONTRATO", caratula.numero_contrato || "—"],
    ["CONTRATISTA", caratula.contratista || "—"],
    ["REPRESENTANTE LEGAL", caratula.representante_legal || "—"],
    ["DIRECCIÓN FISCAL", caratula.domicilio_fiscal || "—"],
    ["OBJETO DEL CONTRATO", caratula.objeto_contrato || "—"],
    ["IMPORTE SIN IVA", formatoMoneda(caratula.importe_sin_iva)],
    ["I.V.A.", formatoMoneda(caratula.iva)],
    ["IMPORTE TOTAL C/IVA", formatoMoneda(caratula.importe_total)],
    ["FECHA DE INICIO PROGRAMADA", caratula.fecha_inicio || "—"],
    ["FECHA DE TERMINACIÓN PROGRAMADA", caratula.fecha_termino || "—"],
    ["DÍAS NATURALES", caratula.dias_naturales || "—"],
    ["NÚMERO DE FRENTES", caratula.numero_frentes || "—"],
  ]);
  y = seccionEtiquetaValor(doc, y, "DATOS CONTRACTUALES FINANCIEROS", [
    ...(caratula.deducciones || []).map((d) => [`DEDUCCIÓN — ${d.concepto}`, formatoPct(d.porcentaje)]),
    ...(caratula.sanciones || []).map((s) => [`SANCIÓN — ${s.concepto}`, `${formatoPct(s.porcentaje)} · ${s.diasPermitidos} días permitidos`]),
    ["RETENCIÓN POR ATRASO", formatoPct(caratula.retencion_porcentaje || 0)],
  ]);

  doc.addPage();
  y = 40;
  y = tituloSeccion(doc, "1. CARÁTULA — CONTRATO DE SUPERVISIÓN EXTERNA", y, ORO);
  y += 4;
  if (haySupervision) {
    seccionEtiquetaValor(doc, y, "DATOS DEL CONTRATO", [
      ["No. DE CONTRATO", caratulaSupervision.numero_contrato || "—"],
      ["EMPRESA", caratulaSupervision.contratista || "—"],
      ["REPRESENTANTE LEGAL", caratulaSupervision.representante_legal || "—"],
      ["OBJETO DEL CONTRATO", caratulaSupervision.objeto_contrato || "—"],
      ["IMPORTE TOTAL C/IVA", formatoMoneda(caratulaSupervision.importe_total)],
      ["FECHA DE INICIO", caratulaSupervision.fecha_inicio || "—"],
    ], ORO);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Sin contrato de supervisión vinculado todavía.", MARGEN, y + 10);
    doc.setFont("helvetica", "normal");
  }

  /* ── 2.1 Informe general de avance — una hoja por contrato ── */
  doc.addPage();
  y = 40;
  y = tituloSeccion(doc, "2.1 INFORME GENERAL DE AVANCE — CONTRATO DE OBRA", y);
  y += 4;
  y = encabezadoContrato(doc, y, "DATOS DEL CONTRATO", caratula, false);
  tablaAvancePDF(doc, y, semanasFisico, semanasFinanciero, caratula.importe_total);

  doc.addPage();
  y = 40;
  y = tituloSeccion(doc, "2.1 INFORME GENERAL DE AVANCE — CONTRATO DE SUPERVISIÓN EXTERNA", y, ORO);
  y += 4;
  y = encabezadoContrato(doc, y, "DATOS DEL CONTRATO", caratulaSupervision, !haySupervision);
  if (haySupervision) {
    if (faltaCaratulaSupervision) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Falta completar la carátula de este contrato para calcular su avance.", MARGEN, y + 8);
      doc.setFont("helvetica", "normal");
    } else {
      tablaAvancePDF(doc, y, semanasFisicoSupervision, semanasFinancieroSupervision, caratulaSupervision.importe_total);
    }
  }

  /* ── 2.2 Informe presupuestal — una hoja por contrato ── */
  doc.addPage();
  y = 40;
  y = tituloSeccion(doc, "2.2 INFORME PRESUPUESTAL — CONTRATO DE OBRA", y);
  y += 4;
  y = encabezadoContrato(doc, y, "DATOS DEL CONTRATO", caratula, false);
  y = tablaEstimacionesPDF(doc, y, estimacionesCalculadas, caratula);

  /* La gráfica va DESPUÉS de las estimaciones — el financiero solo
     existe una vez que se reportaron (ajuste de fondo). Una sola
     imagen: programado + real + financiero juntos, seguida de la
     tabla al pie con semana + los tres avances (A3, reunión 12 de
     agosto) — así se lee el % exacto de cada punto sin ir a otra
     hoja. */
  const imgLinea = await capturarElemento(lineChartEl, ancho);
  if (imgLinea) {
    y = asegurarEspacio(doc, y, imgLinea.alto + 40);
    y = tituloSeccion(doc, "CURVA DE AVANCE — PROGRAMADO, REAL Y FINANCIERO", y) + 8;
    doc.addImage(imgLinea.dataUrl, "PNG", MARGEN, y, ancho, imgLinea.alto);
    y += imgLinea.alto + 12;
    tablaAvancePDF(doc, y, semanasFisico, semanasFinanciero);
  }

  doc.addPage();
  y = 40;
  y = tituloSeccion(doc, "2.2 INFORME PRESUPUESTAL — CONTRATO DE SUPERVISIÓN EXTERNA", y, ORO);
  y += 4;
  y = encabezadoContrato(doc, y, "DATOS DEL CONTRATO", caratulaSupervision, !haySupervision);
  if (haySupervision) {
    if (faltaCaratulaSupervision) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Falta completar la carátula de este contrato para calcular sus estimaciones.", MARGEN, y + 8);
      doc.setFont("helvetica", "normal");
    } else {
      y = tablaEstimacionesPDF(doc, y, estimacionesCalculadasSupervision, caratulaSupervision);

      if (estimacionesCalculadasSupervision.length > 0) {
        const imgLineaSupervision = await capturarElemento(lineChartElSupervision, ancho);
        if (imgLineaSupervision) {
          y = asegurarEspacio(doc, y, imgLineaSupervision.alto + 40);
          y = tituloSeccion(doc, "CURVA DE AVANCE — PROGRAMADO, REAL Y FINANCIERO (SUPERVISIÓN)", y, ORO) + 8;
          doc.addImage(imgLineaSupervision.dataUrl, "PNG", MARGEN, y, ancho, imgLineaSupervision.alto);
          y += imgLineaSupervision.alto + 12;
          tablaAvancePDF(doc, y, semanasFisicoSupervision, semanasFinancieroSupervision);
        }
      }
    }
  }

  /* ── Observaciones — hoja propia ── */
  if ((caratula.observaciones || []).length > 0) {
    doc.addPage();
    y = 40;
    y = tituloSeccion(doc, "OBSERVACIONES DE LA CARÁTULA", y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      body: caratula.observaciones.map((o) => [o.texto]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      theme: "grid",
    });
  }

  /* Encabezado de continuación + pie de página en TODAS las hojas —
     se hace al final porque el total de páginas solo se sabe hasta
     que el documento está completo. */
  const totalPaginas = doc.internal.getNumberOfPages();
  const fechaGeneracion = formatoFechaGeneracion();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    if (pagina > 1) dibujarEncabezadoContinuacion(doc, nombreObra);
    dibujarPiePagina(doc, pagina, totalPaginas, fechaGeneracion);
  }

  const nombreArchivo = nombreObra.replace(/[^a-z0-9]/gi, "_");
  doc.save(`Informe_Avance_Fisico_Financiero_${nombreArchivo}.pdf`);
}
