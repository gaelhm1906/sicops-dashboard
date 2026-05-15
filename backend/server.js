require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const path       = require("path");

const logger       = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const { initCron } = require("./utils/cron");

/* ── Rutas ── */
const authRoutes      = require("./routes/auth");
const obrasRoutes     = require("./routes/obras");   // GET ?tabla + PUT /update + flujo 3 pasos
const controlRoutes   = require("./routes/control");
const reportesRoutes  = require("./routes/reportes");
const pgRoutes        = require("./routes/pg");
const dashboardRoutes = require("./routes/dashboard");
const geoRoutes       = require("./routes/geo");
const geojsonRoutes   = require("./routes/geojson");
const sistemaRoutes   = require("./routes/sistema");
const semanaRoutes    = require("./routes/semana");
const kpisRoutes      = require("./routes/kpis");
const auditoriaRoutes = require("./routes/auditoria");
const modulosRoutes   = require("./routes/modulos");
const utopiasRoutes   = require("./routes/utopias");

const app  = express();
const PORT = process.env.PORT || 3001;
const frontendBuildPath = path.resolve(__dirname, "..", "build");

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://plataformasobse.info",
  "https://www.plataformasobse.info",
  "https://srv1574556.hstgr.cloud",
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite peticiones sin Origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(Object.assign(new Error("CORS_ORIGIN_BLOCKED"), { status: 403, code: "CORS_ORIGIN_BLOCKED" }));
  },
  methods:     ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

/* ── Body parsing ── */
app.use(bodyParser.json({ limit: "10kb" }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ── Logger de peticiones ── */
app.use(logger.requestLogger);

/* ── Health check ── */
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "SICOPS API",
    version: "1.0.0",
    env:     process.env.NODE_ENV,
    uptime:  Math.floor(process.uptime()),
  });
});

/* ── Rutas API ── */
app.use("/api/auth",      authRoutes);
app.use("/api/obras",     obrasRoutes);     // GET ?tabla, PUT /update, flujo 3 pasos
app.use("/api/sistema",   sistemaRoutes);
app.use("/api/semana",    semanaRoutes);
app.use("/api/control",   controlRoutes);
app.use("/api/reportes",  reportesRoutes);
app.use("/api/pg",        pgRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/geo",       geoRoutes);
app.use("/api/geojson",   geojsonRoutes);
app.use("/api/kpis",      kpisRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/modulos",   modulosRoutes);
app.use("/api/utopias",   utopiasRoutes);

app.use(express.static(frontendBuildPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  return res.sendFile(path.join(frontendBuildPath, "index.html"));
});

/* ── 404 ── */
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint no encontrado",
    code:    "NOT_FOUND",
  });
});

/* ── Error handler global ── */
app.use(errorHandler);

/* ── Iniciar servidor ── */
if (require.main === module) {
  app.listen(PORT, async () => {
    const log = require("./middleware/logger");
    log.info("server", `SICOPS API corriendo en http://localhost:${PORT}`);
    log.info("server", `Entorno: ${process.env.NODE_ENV}`);

    const { testConnection, inicializarDB } = require("./config/pg");
    const ok = await testConnection();
    if (ok) {
      await inicializarDB();
      initCron();
    }
  });
}

module.exports = app; // para tests
