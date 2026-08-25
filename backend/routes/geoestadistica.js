const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/geoestadisticaCtrl");
const { authRequired, requireRole } = require("../middleware/auth");

const GEO = requireRole("GEOESTADISTICA", "ADMIN");

/* ── Consultas (GEOESTADISTICA + ADMIN) ── */
router.get("/obras",                        authRequired, GEO, ctrl.getObras);
router.get("/obras/:clave",                 authRequired, GEO, ctrl.getObraDetalle);
router.get("/catalogo",                     authRequired, GEO, ctrl.getCatalogo);
router.get("/catalogo-programa",            authRequired, GEO, ctrl.getCatalogoPrograma);
router.get("/verificar-clave",              authRequired, GEO, ctrl.verificarClave);
router.get("/auditoria",                    authRequired, GEO, ctrl.getAuditoria);
router.get("/motivos-baja",                 authRequired, GEO, ctrl.getMotivosBaja);

/* ── Verificar dependencias (pre-check antes de corrección) ── */
router.post("/obras/verificar-dependencias", authRequired, GEO, ctrl.verificarDependencias);

/* ── Operaciones de escritura (solo GEOESTADISTICA + ADMIN) ── */
router.post("/obras/alta",                  authRequired, GEO, ctrl.altaObra);
router.put("/obras/:clave/atributos",       authRequired, GEO, ctrl.modificarAtributos);
router.put("/obras/:clave/baja",            authRequired, GEO, ctrl.bajaLogica);
router.put("/obras/:clave/reactivar",       authRequired, GEO, ctrl.reactivarObra);
router.put("/obras/:clave/corregir-clave",  authRequired, GEO, ctrl.corregirClaveUnica);

module.exports = router;
