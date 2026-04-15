/* ── USUARIO O EMAIL ── */
export function validarEmail(email) {
  if (!email) return "El usuario o email es obligatorio.";
  if (email.includes('@')) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return "Ingrese un email válido.";
  } else {
    // Para usuario: permitir letras, números, guiones bajos y guiones
    const userRe = /^[a-zA-Z0-9_-]+$/;
    if (!userRe.test(email)) return "El usuario solo puede contener letras, números, guiones bajos y guiones.";
  }
  return null;
}

/* ── CONTRASEÑA ── */
export function validarPassword(password) {
  if (!password) return "La contraseña es obligatoria.";
  if (password.length < 6) return "La contraseña debe tener más de 6 caracteres.";
  return null;
}

/* ── PORCENTAJE DE AVANCE ── */
export function validarPorcentaje(valor) {
  const num = Number(valor);
  if (valor === "" || valor === null || valor === undefined) return "Ingrese un valor.";
  if (isNaN(num)) return "Debe ser un número.";
  if (num < 0 || num > 100) return "El rango válido es 0–100.";
  return null;
}

/* ── DELTA (cambio de porcentaje) ── */
export function evaluarDelta(anterior, nuevo) {
  const delta = nuevo - anterior;

  if (delta < 0) {
    return {
      tipo:     "error",
      mensaje:  "No puede disminuir el avance.",
      icono:    "🔴",
      color:    "text-red-600",
      bg:       "bg-red-50 border-red-300",
      valido:   false,
    };
  }
  if (delta === 0) {
    return {
      tipo:    "info",
      mensaje: "Sin cambios respecto al valor actual.",
      icono:   "ℹ️",
      color:   "text-gray-500",
      bg:      "bg-gray-50 border-gray-300",
      valido:  false,
    };
  }
  if (delta > 10) {
    return {
      tipo:    "advertencia",
      mensaje: `Cambio grande de +${delta}% — revisar con supervisor.`,
      icono:   "⚠️",
      color:   "text-yellow-700",
      bg:      "bg-yellow-50 border-yellow-300",
      valido:  true,
    };
  }
  return {
    tipo:    "ok",
    mensaje: `Cambio válido de +${delta}%.`,
    icono:   "✅",
    color:   "text-green-700",
    bg:      "bg-green-50 border-green-300",
    valido:  true,
  };
}

/* ── CONFIRMACIÓN DE TEXTO ── */
export function validarConfirmacion(texto) {
  return texto === "CONFIRMO";
}
