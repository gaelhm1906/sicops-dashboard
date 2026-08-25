/**
 * utils/reportExport.js
 * Motor de exportación PDF — portado de Centro de Mando (reportExport.ts).
 * Usa window.print() en ventana nueva: mismo método que los reportes institucionales SOBSE.
 */

/** Estilos CSS inyectados en la ventana de impresión */
export const reportExportStyles = `
  .report-page {
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
  }
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    border-bottom: 3px solid #691C32;
    margin-bottom: 24px;
    padding-bottom: 16px;
  }
  .report-header-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    min-width: 0;
    flex: 1 1 320px;
  }
  .report-header-logo {
    height: 50px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
    flex-shrink: 0;
  }
  .report-header-copy { min-width: 0; }
  .report-header-section {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #9ca3af;
    margin: 0 0 4px;
  }
  .report-header-title {
    font-size: 26px;
    line-height: 1.15;
    font-weight: 900;
    color: #111827;
    margin: 0;
  }
  .report-header-subtitle {
    font-size: 14px;
    font-weight: 700;
    color: #691C32;
    margin: 6px 0 0;
  }
  .report-header-date {
    font-size: 11px;
    color: #6b7280;
    margin: 0;
    text-align: right;
  }
  .avoid-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .page-break {
    page-break-before: always;
    break-before: always;
  }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .avoid-break { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

/**
 * Abre una ventana nueva con el HTML del reporte y ejecuta window.print().
 * El usuario guarda como PDF desde el diálogo del navegador.
 * Método idéntico al usado en todos los reportes del Centro de Mando SOBSE.
 */
export async function openPrintWindow(contentHtml, windowTitle) {
  const safeTitle = String(windowTitle || "Reporte")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) {
    alert("Habilita las ventanas emergentes para poder generar el PDF.");
    return;
  }

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  @page { margin: 10mm; size: A4 portrait; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; background: white; margin: 0; padding: 20px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
  div[style*="page-break-inside:avoid"], div[style*="page-break-inside: avoid"] { page-break-inside: avoid; break-inside: avoid; }
  tr[style*="page-break-inside:avoid"], tr[style*="page-break-inside: avoid"] { page-break-inside: avoid; break-inside: avoid; }
  div[style*="break-after:avoid"], div[style*="break-after: avoid"] { break-after: avoid; page-break-after: avoid; }
  ${reportExportStyles}
</style>
</head>
<body>
${contentHtml}
</body>
</html>`);
  win.document.close();

  /* Esperar a que carguen imágenes (logo base64) antes de imprimir */
  await new Promise((resolve) => {
    const imgs = win.document.querySelectorAll("img");
    if (imgs.length === 0) { setTimeout(resolve, 300); return; }
    let loaded = 0;
    const done = () => { if (++loaded >= imgs.length) resolve(); };
    imgs.forEach((img) => {
      if (img.complete) done();
      else { img.onload = done; img.onerror = done; }
    });
    setTimeout(resolve, 1200); // fallback máximo
  });

  win.print();
  win.onafterprint = () => win.close();
}
