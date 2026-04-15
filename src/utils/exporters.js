/**
 * utils/exporters.js
 * Exportar datos a CSV o JSON con descarga automática en el navegador.
 */

// ── Helper: dispara la descarga de un Blob ─────────────────────────
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Escapa un valor para incluirlo en CSV ─────────────────────────
function escapeCsvValue(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  // Si contiene coma, comilla o salto de línea, envuelve en comillas
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exporta un array de objetos a CSV.
 * @param {Object[]} data      Filas (array de objetos planos)
 * @param {string}   filename  Nombre del archivo (sin extensión)
 * @param {Object}   [opts]
 * @param {string[]} [opts.columns]  Subset de claves a incluir (en orden)
 * @param {Object}   [opts.labels]   { key: "Etiqueta" } para personalizar encabezados
 * @param {string[]} [opts.meta]     Líneas de comentario al inicio (#...)
 */
export function exportToCSV(data, filename, opts = {}) {
  if (!data?.length) return;

  const columns = opts.columns || Object.keys(data[0]);
  const labels  = opts.labels  || {};
  const meta    = opts.meta    || [];

  const headerRow = columns.map((c) => escapeCsvValue(labels[c] || c)).join(",");
  const dataRows  = data.map((row) =>
    columns.map((c) => escapeCsvValue(row[c])).join(",")
  );

  const metaLines = meta.map((m) => `# ${m}`);
  const csv = [...metaLines, headerRow, ...dataRows].join("\n");

  downloadBlob(`\uFEFF${csv}`, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Exporta un valor serializable a JSON.
 * @param {*}      data      Cualquier valor serializable
 * @param {string} filename  Nombre del archivo (sin extensión)
 */
export function exportToJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, `${filename}.json`, "application/json");
}

/**
 * Exporta el resumen de un corte histórico.
 * Genera tanto CSV como JSON con metadatos del período.
 *
 * @param {Object} corte   Objeto normalizado: { periodo, fechaCierre, totalObras, actualizadas, noActualizadas, obras[] }
 * @param {string} formato "csv" | "json"
 */
export function exportarCorte(corte, formato = "csv") {
  const safeFilename = `corte-${corte.periodo.replace(/[^a-zA-Z0-9-]/g, "-")}`;

  if (formato === "json") {
    exportToJSON(
      {
        periodo:        corte.periodo,
        fecha_cierre:   corte.fechaCierre,
        resumen: {
          total_obras:    corte.totalObras,
          actualizadas:   corte.actualizadas,
          no_actualizadas: corte.noActualizadas,
        },
        obras: corte.obras,
      },
      safeFilename
    );
    return;
  }

  // CSV
  exportToCSV(
    corte.obras,
    safeFilename,
    {
      columns: ["id", "nombre", "programa", "porcentaje", "estado", "usuario"],
      labels: {
        id:         "ID",
        nombre:     "Nombre",
        programa:   "Programa",
        porcentaje: "% Avance",
        estado:     "Estado",
        usuario:    "Confirmado Por",
      },
      meta: [
        `Reporte SICOPS — Período: ${corte.periodo}`,
        `Fecha cierre: ${corte.fechaCierre}`,
        `Total: ${corte.totalObras} | Actualizadas: ${corte.actualizadas} | Pendientes: ${corte.noActualizadas}`,
      ],
    }
  );
}
