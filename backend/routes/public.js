/**
 * routes/public.js
 * Rutas públicas — sin autenticación, CORS abierto (*).
 * Montadas en /api/public ANTES del middleware cors restrictivo.
 */
const express = require("express");
const router  = express.Router();

const baloncanchasCtrl = require("../controllers/baloncanchasCtrl");

/* GET /api/public/balon.geojson — StoryMap "El Balón Vuelve al Barrio" */
router.get("/balon.geojson", baloncanchasCtrl.getGeoJSON);

module.exports = router;
