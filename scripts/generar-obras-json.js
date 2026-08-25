/**
 * scripts/generar-obras-json.js
 * Regenera public/data/obras.json (snapshot estático para modo offline)
 * a partir de los CSV fuente en /data — misma transformación que usa
 * backend/controllers/csvObrasCtrl.js en modo conectado, para que ambos
 * caminos expongan siempre los mismos campos (incluido `anio`).
 *
 * Uso: node scripts/generar-obras-json.js
 */
const fs = require("fs");
const path = require("path");
const { cargarObras } = require("../backend/controllers/csvObrasCtrl");

const obras = cargarObras();
const features = obras.map((obra) => ({
  type: "Feature",
  geometry: null,
  properties: { ...obra },
}));

const geojson = { type: "FeatureCollection", features };
const outPath = path.join(__dirname, "..", "public", "data", "obras.json");
fs.writeFileSync(outPath, JSON.stringify(geojson));

console.log(`Generadas ${features.length} obras -> ${outPath}`);
