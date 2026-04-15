const express = require("express");
const router  = express.Router();

const { login, logout, me } = require("../controllers/authController");
const { authRequired }      = require("../middleware/auth");

/**
 * POST /api/auth/login
 * Autentica al usuario y devuelve un JWT.
 */
router.post("/login", login);

/**
 * POST /api/auth/logout
 * Cierra la sesión (notifica al cliente; el token se invalida en frontend).
 */
router.post("/logout", authRequired, logout);

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado actual.
 */
router.get("/me", authRequired, me);

module.exports = router;
