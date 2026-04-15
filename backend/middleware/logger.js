/**
 * middleware/logger.js
 * Logger de peticiones HTTP y mensajes internos.
 * Escribe en logs/app.log y en consola (desarrollo).
 */
const fs   = require("fs");
const path = require("path");

const LOG_DIR  = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");
const LEVEL    = process.env.LOG_LEVEL || "info";
const IS_DEV   = process.env.NODE_ENV !== "production";

/* Asegurar que el directorio de logs exista */
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[LEVEL];
}

function timestamp() {
  return new Date().toISOString();
}

function formatLine(level, modulo, mensaje) {
  return `[${timestamp()}] [${level.toUpperCase().padEnd(5)}] [${modulo}] ${mensaje}\n`;
}

function writeToFile(line) {
  try {
    fs.appendFileSync(LOG_FILE, line, "utf-8");
  } catch { /* Si falla la escritura no queremos romper la petición */ }
}

function log(level, modulo, mensaje) {
  if (!shouldLog(level)) return;
  const line = formatLine(level, modulo, mensaje);
  writeToFile(line);
  if (IS_DEV) {
    const colors = { error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[36m", debug: "\x1b[90m" };
    const reset  = "\x1b[0m";
    process.stdout.write(`${colors[level] || ""}${line.trim()}${reset}\n`);
  }
}

/* Métodos de nivel */
const info  = (m, msg) => log("info",  m, msg);
const warn  = (m, msg) => log("warn",  m, msg);
const error = (m, msg) => log("error", m, msg);
const debug = (m, msg) => log("debug", m, msg);

/* ── Middleware Express: loguea cada petición ── */
function requestLogger(req, res, next) {
  const start    = Date.now();
  const { method, originalUrl } = req;
  const usuario  = req.user?.email || "anon";

  res.on("finish", () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const level  = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    log(level, "http", `${method} ${originalUrl} ${status} ${ms}ms [${usuario}]`);
  });

  next();
}

module.exports = { info, warn, error, debug, requestLogger, log };
