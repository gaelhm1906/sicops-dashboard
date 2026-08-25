/**
 * controllers/csvObrasCtrl.js
 *
 * Fuente de datos LOCAL para desarrollo — lee los CSV exportados en /data
 * (obras_puntos, obras_lineas, obras_poligonos) en lugar de consultar
 * PostgreSQL. Se activa temporalmente para validar el frontend sin depender
 * de una base de datos real; no toca ni reemplaza la lógica de pgController/
 * obrasCtrl, que sigue intacta para cuando se conecte una BD real.
 *
 * No parsea geometría (WKB) — geometry siempre es null. Suficiente para
 * listado/captura; el visor de mapas seguirá necesitando una BD real.
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DATA_DIR = path.join(__dirname, "..", "..", "data");

const TABLAS = ["obras_puntos", "obras_lineas", "obras_poligonos"];

let cache = null;

function leerCsv(nombreTabla) {
  const filePath = path.join(DATA_DIR, `${nombreTabla}.csv`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

function colorPorEstatus(estatus, avance) {
  const estado = String(estatus || "").toUpperCase();
  if (estado.includes("ENTREGAD") || estado.includes("INAUGUR")) return "#2196f3";
  if (estado.includes("CANCELAD")) return "#6b7280";
  const n = Number(avance);
  if (!Number.isFinite(n)) return "#9e9e9e";
  if (n > 70) return "#4caf50";
  if (n >= 30) return "#ff9800";
  return "#f44336";
}

function cargarObras() {
  if (cache) return cache;

  const todas = [];
  for (const tabla of TABLAS) {
    let filas;
    try {
      filas = leerCsv(tabla);
    } catch (err) {
      console.warn(`[csvObrasCtrl] No se pudo leer ${tabla}.csv:`, err.message);
      continue;
    }

    for (const row of filas) {
      const avance = Number(row["AVANCE REAL"]);
      const avanceFinal = Number.isFinite(avance) ? avance : 0;
      const estatus = row.ESTATUS || (avanceFinal >= 100 ? "TERMINADO" : avanceFinal > 0 ? "EN PROCESO" : "SIN INICIAR");
      const id = row.id || row.IDENTIFICADOR || `${tabla}-${todas.length}`;

      todas.push({
        id_obra: String(id),
        nombre: row.NOMBRE_OBRA || "SIN DATO",
        nombre_obra: row.NOMBRE_OBRA || "SIN DATO",
        direccion_general: (row.DG || "SIN DIRECCION").trim().toUpperCase(),
        dg_responsable: row.RESPONSABLE_DG || null,
        programa: (row.PROGRAMA || tabla).trim(),
        alcaldia: row.ALCALDIA || null,
        avance_real: avanceFinal,
        estatus,
        anio: (row.YEAR || "").toString().trim() || null,
        ultima_actualizacion: row["FECHA ACTUALIZACION"] || null,
        color: colorPorEstatus(estatus, avanceFinal),
        tabla,
        clave_unica: row.clave_unica || null,
        modo_calculo_avance: "GENERAL",
      });
    }
  }

  cache = todas;
  return todas;
}

/* GET /api/geojson/obras — mismo shape que obrasCtrl.geoJsonByDg, sin geometría */
function geoJsonFromCsv(req, res) {
  try {
    const obras = cargarObras();
    const features = obras.map((obra) => ({
      type: "Feature",
      geometry: null,
      properties: { ...obra },
    }));
    res.json({ type: "FeatureCollection", features, total: features.length, success: true });
  } catch (err) {
    console.error("[csvObrasCtrl] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { geoJsonFromCsv, cargarObras };
