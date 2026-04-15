require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");

const logger       = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const { initCron } = require("./utils/cron");

/* ── Rutas ── */
const authRoutes      = require("./routes/auth");
const obrasRoutes     = require("./routes/obras");
const controlRoutes   = require("./routes/control");
const reportesRoutes  = require("./routes/reportes");
const pgRoutes        = require("./routes/pg");
const dashboardRoutes = require("./routes/dashboard");
const geoRoutes       = require("./routes/geo");
const sistemaRoutes   = require("./routes/sistema");

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── CORS ── */
app.use(cors({
  origin:      ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods:     ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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
app.use("/api/obras",     obrasRoutes);
app.use("/api/control",   controlRoutes);
app.use("/api/sistema",   sistemaRoutes);
app.use("/api/reportes",  reportesRoutes);
app.use("/api/pg",        pgRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/geo",       geoRoutes);

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
    initCron();

    // Validar conexión PostgreSQL al arrancar
    const { testConnection } = require("./config/pg");
    await testConnection();
  });
}

module.exports = app; // para tests
