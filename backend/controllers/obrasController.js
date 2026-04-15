/**
 * controllers/obrasController.js
 * Gestión de obras: lectura, actualización con flujo de 2 pasos.
 */
const { v4: uuidv4 } = (() => {
  try { return require("crypto"); } catch { return { randomUUID: () => Date.now().toString(36) }; }
})();

const db       = require("../config/db");
const logger   = require("../middleware/logger");
const {
  validarRangoPorcentaje,
  evaluarDelta,
  validarSistemaAbierto,
  validarCodigoVerbal,
} = require("../utils/validators");

/* Store en memoria para cambios pendientes (TTL 10 min) */
const cambiosPendientes = new Map();
const TTL_PENDIENTE = 10 * 60 * 1000; // 10 minutos

function generarCambioId() {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function limpiarCambiosExpirados() {
  const ahora = Date.now();
  for (const [id, cambio] of cambiosPendientes.entries()) {
    if (ahora - cambio.creado > TTL_PENDIENTE) {
      cambiosPendientes.delete(id);
    }
  }
}

/* ── GET /api/obras ── */
function listar(req, res, next) {
  try {
    let obras = db.read("obras");
    const { programa, estado, pagina = 1, limite = 10, orden = "nombre", dir = "asc" } = req.query;

    if (programa) obras = obras.filter((o) => o.programa === programa);
    if (estado)   obras = obras.filter((o) => o.estado   === estado);

    /* Ordenamiento */
    obras.sort((a, b) => {
      let va = a[orden], vb = b[orden];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });

    const total   = obras.length;
    const pag     = Math.max(1, parseInt(pagina, 10));
    const lim     = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const paginas = Math.max(1, Math.ceil(total / lim));
    const data    = obras.slice((pag - 1) * lim, pag * lim);

    res.json({ success: true, data, total, pagina: pag, paginas, limite: lim });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/obras/:id ── */
function obtener(req, res, next) {
  try {
    const id   = parseInt(req.params.id, 10);
    const obra = db.findById("obras", id);
    if (!obra) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }
    res.json({ success: true, data: obra });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/obras/historico?periodo=2025-01-W01 ── */
function historico(req, res, next) {
  try {
    const { periodo } = req.query;
    const historicos  = db.read("historico");

    if (periodo) {
      const corte = historicos.find((h) => h.periodo === periodo);
      if (!corte) {
        return res.status(404).json({ success: false, message: `No existe histórico para el período ${periodo}.` });
      }
      /* Enriquecer con nombre y programa */
      const obras = db.read("obras");
      const snapshot = corte.snapshot_obras.map((s) => {
        const obra = obras.find((o) => o.id === s.id);
        return { ...s, nombre: obra?.nombre, programa: obra?.programa };
      });
      return res.json({ success: true, data: { ...corte, snapshot_obras: snapshot }, periodo });
    }

    /* Sin filtro: lista todos los períodos disponibles */
    const periodos = historicos.map((h) => ({
      id:          h.id,
      periodo:     h.periodo,
      fecha_cierre: h.fecha_cierre,
      resumen:     h.resumen,
    }));
    res.json({ success: true, data: periodos });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/obras/:id/editar ── */
function iniciarEdicion(req, res, next) {
  try {
    limpiarCambiosExpirados();

    const id    = parseInt(req.params.id, 10);
    const { porcentaje_nuevo, motivo } = req.body;
    const usuario = req.user;

    /* Verificar sistema abierto */
    const control = db.read("control_sistema");
    const sysVal  = validarSistemaAbierto(control);
    if (!sysVal.valido) {
      return res.status(400).json({ success: false, message: sysVal.mensaje, codigo: sysVal.codigo });
    }

    /* Verificar obra */
    const obra = db.findById("obras", id);
    if (!obra) {
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }

    /* Validar rango */
    const rangoVal = validarRangoPorcentaje(porcentaje_nuevo);
    if (!rangoVal.valido) {
      return res.status(400).json({ success: false, message: rangoVal.mensaje, code: "RANGO_INVALIDO" });
    }

    const nuevo    = Number(porcentaje_nuevo);
    const anterior = obra.porcentaje_avance;

    /* Validar delta */
    const deltaInfo = evaluarDelta(anterior, nuevo);
    if (!deltaInfo.valido) {
      return res.status(400).json({
        success: false,
        message: deltaInfo.mensaje,
        codigo:  deltaInfo.codigo,
        delta:   deltaInfo.delta,
      });
    }

    /* Guardar cambio pendiente */
    const cambioId = generarCambioId();
    cambiosPendientes.set(cambioId, {
      cambioId,
      obraId:    id,
      anterior,
      nuevo,
      delta:     deltaInfo.delta,
      motivo:    motivo || "",
      usuario:   usuario.email,
      creado:    Date.now(),
      paso:      1,
    });

    logger.info("obras", `Edición iniciada: obra ${id} | ${anterior}% → ${nuevo}% | usuario: ${usuario.email}`);

    res.json({
      success:    true,
      message:    "Cambio pendiente de confirmación.",
      cambio_id:  cambioId,
      anterior,
      nuevo,
      delta:      deltaInfo.delta,
      validacion: { valido: true, alertas: deltaInfo.alertas, tipo: deltaInfo.tipo },
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/obras/:id/confirmar/step1 ── */
function confirmarStep1(req, res, next) {
  try {
    const { cambio_id } = req.body;

    if (!cambio_id) {
      return res.status(400).json({ success: false, message: "cambio_id es requerido.", code: "MISSING_CAMBIO_ID" });
    }

    const cambio = cambiosPendientes.get(cambio_id);
    if (!cambio) {
      return res.status(400).json({ success: false, message: "Cambio no encontrado o expirado.", code: "CAMBIO_EXPIRADO" });
    }

    if (Date.now() - cambio.creado > TTL_PENDIENTE) {
      cambiosPendientes.delete(cambio_id);
      return res.status(400).json({ success: false, message: "El cambio pendiente ha expirado.", code: "CAMBIO_EXPIRADO" });
    }

    /* Avanzar a paso 2 */
    cambio.paso = 2;

    res.json({
      success: true,
      paso:    "requiere_verificacion",
      message: 'Confirme escribiendo exactamente: CONFIRMO',
      cambio_id,
      resumen: {
        obra_id:  cambio.obraId,
        anterior: cambio.anterior,
        nuevo:    cambio.nuevo,
        delta:    cambio.delta,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/obras/:id/confirmar/step2 ── */
function confirmarStep2(req, res, next) {
  try {
    const { cambio_id, codigo_verbal } = req.body;

    if (!cambio_id) {
      return res.status(400).json({ success: false, message: "cambio_id es requerido.", code: "MISSING_CAMBIO_ID" });
    }

    /* Validar código verbal */
    const codigoVal = validarCodigoVerbal(codigo_verbal);
    if (!codigoVal.valido) {
      return res.status(400).json({ success: false, message: codigoVal.mensaje, code: codigoVal.codigo });
    }

    const cambio = cambiosPendientes.get(cambio_id);
    if (!cambio) {
      return res.status(400).json({ success: false, message: "Cambio no encontrado o expirado.", code: "CAMBIO_EXPIRADO" });
    }

    if (cambio.paso !== 2) {
      return res.status(400).json({ success: false, message: "El paso 1 no fue completado.", code: "PASO_INCORRECTO" });
    }

    /* Verificar obra aún existe */
    const obra = db.findById("obras", cambio.obraId);
    if (!obra) {
      cambiosPendientes.delete(cambio_id);
      return res.status(404).json({ success: false, message: "Obra no encontrada." });
    }

    const ahora = new Date().toISOString();
    const nuevoEstado =
      cambio.nuevo === 100 ? "actualizada" :
      cambio.nuevo > 0     ? "en_progreso"  : "pendiente";

    /* Actualizar obra */
    const obraActualizada = db.updateById("obras", cambio.obraId, {
      porcentaje_avance:          cambio.nuevo,
      estado:                     nuevoEstado,
      fecha_actualizacion:        ahora,
      fecha_ultima_confirmacion:  ahora,
      confirmado_por:             cambio.usuario,
    });

    /* Registrar auditoría */
    const ipHeader = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    db.insert("auditoria", {
      timestamp:           ahora,
      usuario:             cambio.usuario,
      obra_id:             cambio.obraId,
      accion:              "actualizar",
      porcentaje_anterior: cambio.anterior,
      porcentaje_nuevo:    cambio.nuevo,
      delta:               cambio.delta,
      confirmado:          true,
      cambio_id:           cambio_id,
      motivo:              cambio.motivo,
      ip:                  Array.isArray(ipHeader) ? ipHeader[0] : ipHeader,
    });

    console.log("[ACTUALIZACION]", cambio.obraId, cambio.nuevo);

    /* Eliminar cambio pendiente */
    cambiosPendientes.delete(cambio_id);

    logger.info("obras", `Cambio confirmado: obra ${cambio.obraId} → ${cambio.nuevo}% | por: ${cambio.usuario}`);

    res.json({
      success: true,
      message: "Cambio guardado correctamente.",
      obra:    obraActualizada,
    });
  } catch (err) {
    next(err);
  }
}

async function actualizarAvance(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const avance = Number(req.body.avance);

    if (Number.isNaN(avance)) {
      return res.status(400).json({
        success: false,
        message: "El avance debe ser un número válido.",
        code: "INVALID_AVANCE",
      });
    }

    const control = db.read("control_sistema");
    const sistema = validarSistemaAbierto(control);
    if (!sistema.valido) {
      return res.status(403).json({
        success: false,
        message: sistema.mensaje,
        code: sistema.codigo || "SISTEMA_CERRADO",
      });
    }

    const obra = db.findById("obras", id);
    if (!obra) {
      return res.status(404).json({ success: false, message: "Obra no encontrada.", code: "NOT_FOUND" });
    }

    const rangoVal = validarRangoPorcentaje(avance);
    if (!rangoVal.valido) {
      return res.status(400).json({ success: false, message: rangoVal.mensaje, code: rangoVal.codigo });
    }

    const deltaInfo = evaluarDelta(obra.porcentaje_avance || 0, avance);
    if (!deltaInfo.valido) {
      return res.status(400).json({ success: false, message: deltaInfo.mensaje, code: deltaInfo.codigo });
    }

    const ahora = new Date().toISOString();
    const nuevoEstado =
      avance === 100 ? "actualizada" :
      avance > 0 ? "en_progreso" : "pendiente";

    const obraActualizada = db.updateById("obras", id, {
      porcentaje_avance:          avance,
      estado:                     nuevoEstado,
      fecha_actualizacion:        ahora,
      fecha_ultima_confirmacion:  ahora,
      confirmado_por:             req.user?.email || req.user?.username || "anon",
    });

    const ipHeader = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    db.insert("auditoria", {
      timestamp:           ahora,
      usuario:             req.user?.email || req.user?.username || "anon",
      obra_id:             id,
      accion:              "actualizar",
      porcentaje_anterior: obra.porcentaje_avance || 0,
      porcentaje_nuevo:    avance,
      delta:               deltaInfo.delta,
      confirmado:          true,
      cambio_id:           null,
      motivo:              req.body.motivo || null,
      ip:                  Array.isArray(ipHeader) ? ipHeader[0] : ipHeader,
    });

    console.log("[ACTUALIZACION]", id, avance);

    res.json({ success: true, obra: obraActualizada });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, historico, iniciarEdicion, confirmarStep1, confirmarStep2, actualizarAvance };
