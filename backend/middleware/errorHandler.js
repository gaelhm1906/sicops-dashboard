/**
 * middleware/errorHandler.js
 * Manejador global de errores Express.
 * Captura todos los errores no manejados y los formatea.
 */
const logger = require("./logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  /* Determinar código de estado */
  let status  = err.status || err.statusCode || 500;
  let message = err.message || "Error interno del servidor.";
  let code    = err.code    || "INTERNAL_ERROR";

  /* Errores conocidos de JWT (pueden llegar aquí si no son capturados en middleware) */
  if (err.name === "JsonWebTokenError")  { status = 401; code = "TOKEN_INVALID"; }
  if (err.name === "TokenExpiredError")  { status = 401; code = "TOKEN_EXPIRED"; message = "Sesión expirada."; }

  /* Error de parseo de JSON en body */
  if (err.type === "entity.parse.failed") {
    status  = 400;
    message = "JSON malformado en el cuerpo de la petición.";
    code    = "INVALID_JSON";
  }

  /* Loguear */
  const logLevel = status >= 500 ? "error" : "warn";
  logger[logLevel](
    "errorHandler",
    `${status} ${code} — ${message} [${req.method} ${req.originalUrl}] [${req.user?.email || "anon"}]`
  );

  if (status >= 500 && err.stack) {
    logger.error("errorHandler", err.stack);
  }

  res.status(status).json({
    success: false,
    message,
    code,
    ...(process.env.NODE_ENV === "development" && status >= 500
      ? { stack: err.stack }
      : {}),
  });
}

module.exports = errorHandler;
