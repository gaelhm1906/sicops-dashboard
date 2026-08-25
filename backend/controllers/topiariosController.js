/**
 * controllers/topiariosController.js
 * Persistencia en JSON — sin base de datos.
 * Módulo aislado del core SICOPS.
 */
const path    = require("path");
const fs      = require("fs");
const ExcelJS = require("exceljs");

const DATA_DIR  = path.join(__dirname, "../data/topiarios");
const DATA_FILE = path.join(DATA_DIR, "topiarios.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readData() {
  ensureStorage();
  try   { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}

function writeData(data) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function generateId(data) {
  const year = new Date().getFullYear();
  if (!data.length) return `TOP-CDMX-${year}-0001`;
  const nums = data.map((d) => {
    const m = /TOP-CDMX-\d{4}-(\d+)$/.exec(d.id || "");
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = Math.max(...nums) + 1;
  return `TOP-CDMX-${year}-${String(next).padStart(4, "0")}`;
}

/* Construye geom GeoJSON Point a partir de lat/lng */
function buildGeom(lat, lng) {
  return { type: "Point", coordinates: [Number(lng), Number(lat)] };
}

/* ── Listar ── */
exports.listar = (_req, res) => {
  try {
    res.json({ success: true, data: readData() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Guardar ── */
exports.guardar = (req, res) => {
  try {
    const { tipo, modalidad, lat, lng, geom, direccion, colonia, alcaldia } = req.body;
    if (!tipo?.trim() || !modalidad || lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos: tipo, modalidad, lat y lng son requeridos.",
      });
    }
    const data = readData();
    const registro = {
      id:        generateId(data),
      tipo:      tipo.trim().toUpperCase(),
      modalidad: String(modalidad).toUpperCase(),
      geom:      geom || buildGeom(lat, lng),
      lat:       Number(lat),
      lng:       Number(lng),
      direccion: (direccion  || "").trim(),
      colonia:   (colonia    || "").trim(),
      alcaldia:  (alcaldia   || "").trim(),
      usuario:   req.user?.username || req.user?.email || "sistema",
      fecha:     new Date().toISOString(),
    };
    data.push(registro);
    writeData(data);
    res.json({ success: true, data: registro });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Promover PROPUESTA → INSTALACION ── */
exports.promover = (req, res) => {
  try {
    const { id } = req.params;
    const data   = readData();
    const idx    = data.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Registro no encontrado." });
    }
    if (data[idx].modalidad !== "PROPUESTA") {
      return res.status(400).json({
        success: false,
        message: "Solo se pueden promover registros en estado PROPUESTA.",
      });
    }
    data[idx].modalidad            = "INSTALACION";
    data[idx].fecha_actualizacion  = new Date().toISOString();
    data[idx].usuario_actualizacion = req.user?.username || req.user?.email || "sistema";
    writeData(data);
    res.json({ success: true, data: data[idx] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Eliminar ── */
exports.eliminar = (req, res) => {
  try {
    const { id } = req.params;
    const data   = readData();
    const idx    = data.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Registro no encontrado." });
    }
    const [removed] = data.splice(idx, 1);
    writeData(data);
    res.json({ success: true, data: removed });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Exportar CSV ── */
exports.exportarCsv = (_req, res) => {
  try {
    const data = readData();
    const esc  = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cols = ["ID", "Tipo", "Modalidad", "Fecha", "Fecha Actualización", "Usuario", "Usuario Actualización", "Latitud", "Longitud", "Dirección", "Colonia", "Alcaldía"];
    const rows = data.map((r) => [
      esc(r.id), esc(r.tipo), esc(r.modalidad),
      esc(r.fecha), esc(r.fecha_actualizacion || ""),
      esc(r.usuario), esc(r.usuario_actualizacion || ""),
      r.lat, r.lng,
      esc(r.direccion), esc(r.colonia), esc(r.alcaldia),
    ].join(","));
    const csv = [cols.join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="topiarios.csv"');
    res.send("﻿" + csv);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Exportar Excel ── */
exports.exportarExcel = async (_req, res) => {
  try {
    const data = readData();
    const wb   = new ExcelJS.Workbook();
    wb.creator = "SICOPS-Topiarios";
    wb.created = new Date();

    const ws = wb.addWorksheet("Topiarios CDMX");
    ws.columns = [
      { header: "ID",                   key: "id",                    width: 24 },
      { header: "Tipo",                 key: "tipo",                  width: 24 },
      { header: "Modalidad",            key: "modalidad",             width: 14 },
      { header: "Fecha Registro",       key: "fecha",                 width: 26 },
      { header: "Fecha Actualización",  key: "fecha_actualizacion",   width: 26 },
      { header: "Usuario",              key: "usuario",               width: 20 },
      { header: "Usuario Actualiz.",    key: "usuario_actualizacion", width: 22 },
      { header: "Latitud",              key: "lat",                   width: 14 },
      { header: "Longitud",             key: "lng",                   width: 14 },
      { header: "Dirección",            key: "direccion",             width: 40 },
      { header: "Colonia",              key: "colonia",               width: 26 },
      { header: "Alcaldía",             key: "alcaldia",              width: 26 },
    ];

    data.forEach((r) => ws.addRow(r));

    ws.getRow(1).eachCell((cell) => {
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF691C32" } };
      cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.border = { bottom: { style: "thin", color: { argb: "FF4F0E21" } } };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="topiarios.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ── Exportar GeoJSON ── */
exports.exportarGeoJSON = (_req, res) => {
  try {
    const data = readData();
    const features = data
      .map((r) => {
        /* Compatibilidad hacia atrás: registros sin geom usan lat/lng */
        const geometry = r.geom
          || (r.lat != null && r.lng != null ? buildGeom(r.lat, r.lng) : null);
        if (!geometry) return null;
        return {
          type:     "Feature",
          geometry,
          properties: {
            id:                    r.id,
            tipo:                  r.tipo,
            modalidad:             r.modalidad,
            direccion:             r.direccion  || "",
            colonia:               r.colonia    || "",
            alcaldia:              r.alcaldia   || "",
            usuario:               r.usuario    || "",
            fecha:                 r.fecha      || "",
            fecha_actualizacion:   r.fecha_actualizacion   || null,
            usuario_actualizacion: r.usuario_actualizacion || null,
          },
        };
      })
      .filter(Boolean);

    const geojson = { type: "FeatureCollection", features };

    res.setHeader("Content-Type",        "application/geo+json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="topiarios.geojson"');
    res.json(geojson);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
