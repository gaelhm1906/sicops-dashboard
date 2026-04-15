/**
 * controllers/controlController.js
 * Gestión del estado del sistema (abierto/cerrado).
 */
const db     = require("../config/db");
const logger = require("../middleware/logger");
const { ejecutarCierreAutomatico, ejecutarAperturaAutomatica, getPeriodo } = require("../utils/cron");

let sistemaAbierto = false;

function syncSistemaAbierto(control) {
  sistemaAbierto = !!(control && control.estado === "abierto" && !control.bloqueado_edicion);
  return sistemaAbierto;
}

function getControlState() {
  const control = db.read("control_sistema");
  syncSistemaAbierto(control);
  return control;
}

function calcularClausura(ahora) {
  const clausura = new Date(ahora);
  clausura.setHours(12, 0, 0, 0);
  if (clausura <= ahora) {
    clausura.setDate(clausura.getDate() + 1);
  }
  return clausura;
}

function abrirSistema(usuario) {
  const ahora = new Date();
  const clausura = calcularClausura(ahora);
  const periodo = getPeriodo(ahora);
  const updated = db.updateSingle("control_sistema", {
    estado:            "abierto",
    bloqueado_edicion: false,
    fecha_apertura:    ahora.toISOString(),
    proxima_clausura:  clausura.toISOString(),
    periodo_actual:    periodo,
    abierto_por:       usuario,
    cerrado_por:       null,
  });
  syncSistemaAbierto(updated);
  return { updated, periodo };
}

function cerrarSistema(usuario) {
  ejecutarCierreAutomatico();
  const control = db.read("control_sistema");
  const updated = db.updateSingle("control_sistema", {
    estado:            "cerrado",
    bloqueado_edicion: true,
    ultimo_cierre:     new Date().toISOString(),
    cerrado_por:       usuario,
  });
  syncSistemaAbierto(updated);
  return updated;
}

/* ── GET /api/control/estado ── */
function estado(req, res, next) {
  try {
    const control = getControlState();
    const ahora   = new Date();
    const abierto = control.estado === "abierto" && !control.bloqueado_edicion;

    let tiempoRestanteMinutos = null;
    if (abierto && control.proxima_clausura) {
      const clausura = new Date(control.proxima_clausura);
      tiempoRestanteMinutos = Math.max(0, Math.floor((clausura - ahora) / 60000));
    }

    res.json({
      success: true,
      estado:  control.estado,
      abierto,
      bloqueado_edicion:        control.bloqueado_edicion,
      proxima_clausura:         control.proxima_clausura,
      tiempo_restante_minutos:  tiempoRestanteMinutos,
      periodo_actual:           control.periodo_actual,
      fecha_apertura:           control.fecha_apertura,
      ultimo_cierre:            control.ultimo_cierre,
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/control/abrir  (solo DG o ADMIN) ── */
function abrir(req, res, next) {
  try {
    const control = getControlState();

    if (control.estado === "abierto") {
      return res.status(400).json({
        success: false,
        message: "El sistema ya está abierto.",
        code:    "ALREADY_OPEN",
      });
    }

    const { updated, periodo } = abrirSistema(req.user.email);

    logger.info("control", `Sistema abierto manualmente por: ${req.user.email} | período: ${periodo}`);

    res.json({
      success: true,
      message: "Sistema abierto correctamente.",
      periodo,
      estado:  updated,
      abierto: sistemaAbierto,
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/control/cerrar (solo DG o ADMIN) ── */
function cerrar(req, res, next) {
  try {
    const control = getControlState();

    if (control.estado === "cerrado") {
      return res.status(400).json({
        success: false,
        message: "El sistema ya está cerrado.",
        code:    "ALREADY_CLOSED",
      });
    }

    const updated = cerrarSistema(req.user.email);

    const obras       = db.read("obras");
    const total       = obras.length;
    const actualizadas = obras.filter((o) => o.estado === "actualizada").length;
    const noAct       = total - actualizadas;

    logger.info("control", `Sistema cerrado manualmente por: ${req.user.email}`);

    res.json({
      success: true,
      message: "Sistema cerrado correctamente.",
      estado:  updated,
      abierto: sistemaAbierto,
      resumen: {
        total_obras:     total,
        actualizadas,
        no_actualizadas: noAct,
        porcentaje:      total > 0 ? +((actualizadas / total) * 100).toFixed(2) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

function toggle(req, res, next) {
  try {
    const control = getControlState();
    if (control.estado === "abierto" && !control.bloqueado_edicion) {
      const updated = cerrarSistema(req.user.email);
      return res.json({
        success: true,
        message: "Sistema cerrado correctamente.",
        abierto: false,
        estado: updated,
      });
    }

    const { updated, periodo } = abrirSistema(req.user.email);
    res.json({
      success: true,
      message: "Sistema abierto correctamente.",
      abierto: true,
      periodo,
      estado: updated,
    });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/control/auditoria ── */
function auditoria(req, res, next) {
  try {
    const { obra_id, usuario, pagina = 1, limite = 20 } = req.query;
    let registros = db.read("auditoria").reverse(); // más recientes primero

    if (obra_id) registros = registros.filter((r) => r.obra_id === parseInt(obra_id, 10));
    if (usuario) registros = registros.filter((r) => r.usuario === usuario);

    const total   = registros.length;
    const pag     = Math.max(1, parseInt(pagina, 10));
    const lim     = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const paginas = Math.max(1, Math.ceil(total / lim));
    const data    = registros.slice((pag - 1) * lim, pag * lim);

    res.json({ success: true, data, total, pagina: pag, paginas });
  } catch (err) {
    next(err);
  }
}

module.exports = { estado, abrir, cerrar, auditoria, toggle };
