const jwt = require("jsonwebtoken");

const SECRET  = process.env.JWT_SECRET  || "sicops_dev_secret";
const EXPIRES = process.env.JWT_EXPIRES_IN || "8h";

/**
 * Genera un JWT firmado con los datos del usuario.
 */
function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

/**
 * Verifica y decodifica un JWT.
 * Lanza JsonWebTokenError / TokenExpiredError si es inválido.
 */
function verify(token) {
  return jwt.verify(token, SECRET);
}

/**
 * Extrae el token del header Authorization: Bearer <token>
 * Retorna null si no existe o el formato es incorrecto.
 */
function extractFromHeader(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  if (!parts[1] || ["null", "undefined"].includes(parts[1].toLowerCase())) return null;
  return parts[1];
}

module.exports = { sign, verify, extractFromHeader };
