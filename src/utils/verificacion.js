/**
 * utils/verificacion.js
 * Ajuste de minuta (sesión de revisión #3/#4): un estatus adicional,
 * distinto de "Cumplido", que distingue quién ENTREGA de quién VALIDA.
 * La validación inicial recae en el Jefe de Unidad Departamental con
 * apoyo de los Residentes de Proyecto; en materia estructural participa
 * también el gabinete de Directores Responsables de Obra y
 * Corresponsables — ese gabinete aún no está modelado como roles de
 * sistema, así que por ahora la validación estructural queda cubierta
 * por el mismo JUD/Residente hasta que existan esas cuentas.
 * Una verificación por (obra, requerimiento). Persistencia MOCK en
 * localStorage, misma convención que el resto del seguimiento.
 */
const PREFIX = "verificacion::";

function clave(obraKey, reqId) {
  return `${PREFIX}${obraKey}::${reqId}`;
}

export function getVerificacion(obraKey, reqId) {
  try {
    const raw = localStorage.getItem(clave(obraKey, reqId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function marcarVerificado(obraKey, reqId, { verificadoPor, notas }) {
  const verificacion = {
    verificado: true,
    verificadoPor: verificadoPor || "sistema",
    fecha: new Date().toISOString(),
    notas: notas || "",
  };
  try {
    localStorage.setItem(clave(obraKey, reqId), JSON.stringify(verificacion));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return verificacion;
}

export function quitarVerificacion(obraKey, reqId) {
  try {
    localStorage.removeItem(clave(obraKey, reqId));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
}

/* Validador por defecto: JUD + Residente de Proyecto, y los roles
   ejecutivos que ya ven todo (ADMIN/SECRETARIO). Cada capturador puede
   pasar su propia lista cuando el validador es distinto (ver
   CapturaFuerzaTrabajo, ajuste #8: ahí valida Director General). */
export const ROLES_VALIDADOR_DEFAULT = ["JEFE_UNIDAD_OBRA", "RESIDENTE_OBRA", "ADMIN", "SECRETARIO"];

export function puedeVerificar(rol, rolesPermitidos = ROLES_VALIDADOR_DEFAULT) {
  return rolesPermitidos.includes(String(rol || "").toUpperCase());
}
