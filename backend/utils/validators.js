/**
 * utils/validators.js
 * Funciones de validación de negocio reutilizables.
 */

/**
 * Valida que el porcentaje esté en rango 0-100.
 */
function validarRangoPorcentaje(valor) {
  const num = Number(valor);
  if (valor === undefined || valor === null || valor === "") {
    return { valido: false, mensaje: "El porcentaje es obligatorio." };
  }
  if (isNaN(num)) {
    return { valido: false, mensaje: "El porcentaje debe ser un número." };
  }
  if (num < 0 || num > 100) {
    return { valido: false, mensaje: "El porcentaje debe estar entre 0 y 100.", codigo: "RANGO_INVALIDO" };
  }
  return { valido: true };
}

/**
 * Evalúa el delta entre porcentaje anterior y nuevo.
 * Retorna { valido, alertas, tipo }
 */
function evaluarDelta(anterior, nuevo) {
  const delta  = nuevo - anterior;
  const alertas = [];

  if (delta < 0) {
    return {
      valido:   false,
      delta,
      tipo:     "error",
      mensaje:  "El porcentaje no puede disminuir.",
      codigo:   "DELTA_NEGATIVO",
      alertas:  ["El porcentaje no puede disminuir."],
    };
  }

  if (delta === 0) {
    return {
      valido:   false,
      delta,
      tipo:     "sin_cambio",
      mensaje:  "El nuevo valor es igual al actual.",
      codigo:   "SIN_CAMBIO",
      alertas:  ["El nuevo valor es igual al actual."],
    };
  }

  if (delta > 10) {
    alertas.push(`Cambio grande de +${delta}%. Revisar con supervisor.`);
  }

  return {
    valido:  true,
    delta,
    tipo:    delta > 10 ? "advertencia" : "ok",
    mensaje: delta > 10
      ? `Cambio de +${delta}% — requiere revisión.`
      : `Cambio válido de +${delta}%.`,
    codigo:  delta > 10 ? "DELTA_GRANDE" : "OK",
    alertas,
  };
}

/**
 * Valida el email con regex básico.
 */
function validarEmail(email) {
  if (!email) return { valido: false, mensaje: "Email requerido." };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return { valido: false, mensaje: "Email inválido." };
  return { valido: true };
}

/**
 * Valida que el código verbal sea exactamente "CONFIRMO".
 */
function validarCodigoVerbal(codigo) {
  if (codigo !== "CONFIRMO") {
    return { valido: false, mensaje: 'Debe escribir exactamente "CONFIRMO".', codigo: "CODIGO_INCORRECTO" };
  }
  return { valido: true };
}

/**
 * Verifica que el sistema esté abierto para edición.
 */
function validarSistemaAbierto(control) {
  if (!control || control.bloqueado_edicion || control.estado !== "abierto") {
    return {
      valido:   false,
      mensaje:  "El sistema está cerrado. No se permiten actualizaciones.",
      codigo:   "SISTEMA_CERRADO",
    };
  }
  return { valido: true };
}

module.exports = {
  validarRangoPorcentaje,
  evaluarDelta,
  validarEmail,
  validarCodigoVerbal,
  validarSistemaAbierto,
};
