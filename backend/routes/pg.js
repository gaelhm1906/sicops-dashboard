const express = require("express");
const router  = express.Router();

const ctrl             = require("../controllers/pgController");
const { authRequired } = require("../middleware/auth");

/**
 * GET /api/pg/obras
 * Lista obras de todas las tablas del schema sig_sobse.
 * Query: ?tabla=nombre_tabla&pagina=1&limite=200
 */
router.get("/obras", authRequired, ctrl.listarObras);

module.exports = router;
