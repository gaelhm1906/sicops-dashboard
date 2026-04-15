/**
 * middleware/auth.js
 * Verifica el JWT en cada ruta protegida.
 */
const { verify, extractFromHeader } = require("../utils/jwt");
const logger = require("./logger");

/**
 * Middleware de autenticación obligatoria.
 * Extrae el JWT del header Authorization: Bearer <token>,
 * lo verifica y agrega req.user con los datos decodificados.
 */
function authRequired(req, res, next) {
  const token = extractFromHeader(req.headers["authorization"]);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token no proporcionado. Debe autenticarse.",
      code:    "TOKEN_MISSING",
    });
  }

  try {
    const decoded = verify(token);
    req.user  = decoded;       // { id, email, rol, nombre, iat, exp }
    req.token = token;
    next();
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError";
    logger.warn("auth", `Token ${isExpired ? "expirado" : "inválido"}: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: isExpired ? "Sesión expirada. Inicie sesión nuevamente." : "Token inválido.",
      code:    isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }
}

/**
 * Middleware de rol. Solo permite el acceso si el usuario tiene uno de los roles indicados.
 * Debe usarse DESPUÉS de authRequired.
 * @param  {...string} roles - Roles permitidos, ej: "DG", "admin"
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "No autenticado.", code: "NOT_AUTHENTICATED" });
    }
    if (!roles.includes(req.user.rol)) {
      logger.warn("auth", `Acceso denegado para ${req.user.email} (rol: ${req.user.rol}) en ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: "No tiene permisos para realizar esta acción.",
        code:    "FORBIDDEN",
      });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };
