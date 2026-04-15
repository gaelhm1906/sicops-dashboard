/**
 * controllers/authController.js
 */
const db = require("../config/db");
const jwtUtil = require("../utils/jwt");
const logger = require("../middleware/logger");

function getDGFromUser(username) {
  if (!username || !String(username).startsWith("actualizacion_")) return null;
  return String(username).replace("actualizacion_", "").toUpperCase();
}

function normalizeUsuarioInput(rawInput) {
  if (!rawInput) return "";
  const normalized = String(rawInput).trim().toLowerCase();
  if (!normalized.includes("@")) return normalized;
  return normalized.split("@")[0];
}

function resolveUsuarioAccount(username) {
  if (!username) return null;

  const exactMatch = db.findOne("usuarios", (u) => String(u.usuario).toLowerCase() === username);
  if (exactMatch) return exactMatch;

  const aliasCandidate = `actualizacion_${username}`;
  return db.findOne("usuarios", (u) => String(u.usuario).toLowerCase() === aliasCandidate) || null;
}

async function login(req, res, next) {
  try {
    const usuarioInput = normalizeUsuarioInput(req.body.usuario || req.body.email || "");
    const passwordInput = req.body.password || "";

    if (!usuarioInput || !passwordInput) {
      return res.status(400).json({
        success: false,
        message: "Usuario y contraseña son requeridos.",
        code: "MISSING_FIELDS",
      });
    }

    const usuario = resolveUsuarioAccount(usuarioInput);
    if (!usuario || !usuario.activo) {
      logger.warn("auth", `Intento de login fallido para: ${usuarioInput}`);
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas.",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (usuario.password !== passwordInput) {
      logger.warn("auth", `Contraseña incorrecta para: ${usuarioInput}`);
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas.",
        code: "INVALID_CREDENTIALS",
      });
    }

    const dg = getDGFromUser(usuario.usuario);

    const payload = {
      id: usuario.id,
      email: usuario.usuario,
      username: usuario.usuario,
      dg,
      nombre: usuario.nombre,
      rol: usuario.rol,
      programa: usuario.programa || null,
    };
    const token = jwtUtil.sign(payload);

    logger.info("auth", `Login exitoso: ${usuario.usuario} (rol: ${usuario.rol})`);

    return res.json({
      success: true,
      token,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.usuario,
        username: usuario.usuario,
        dg,
        rol: usuario.rol,
        programa: usuario.programa || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  logger.info("auth", `Logout: ${req.user?.email || "anon"}`);
  res.json({ success: true, message: "Sesión cerrada correctamente." });
}

function me(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { login, logout, me };
