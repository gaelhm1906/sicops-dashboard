/**
 * Roles con vista ejecutiva (Revisión Integral de la Ejecución de Obra)
 * en lugar de la bandeja personal de tareas — ADMIN y SECRETARIO ven
 * todas las Direcciones Generales; DIRECTOR_GENERAL (y FUNCIONARIO_DG,
 * alias histórico que no se usa en usuarios.json pero se conserva por
 * compatibilidad) ve solo la suya, fijada por su campo `dg` de usuario.
 * "DIRECTOR_GENERAL" es el rol real que usan los usuarios de
 * backend/data/usuarios.json — sin esta entrada, ningún Director
 * General real podía llegar a Revisión Integral ni a la Galería.
 */
const ROLES_VISTA_EJECUTIVA = new Set(["ADMIN", "SECRETARIO", "FUNCIONARIO_DG", "DIRECTOR_GENERAL"]);

export function esVistaEjecutiva(rol) {
  return ROLES_VISTA_EJECUTIVA.has(String(rol || "").toUpperCase());
}

/** DG fija para la vista ejecutiva: null = ve todas (ADMIN/SECRETARIO) */
export function dgFijaPara(user) {
  const rol = String(user?.rol || "").toUpperCase();
  if (rol === "ADMIN" || rol === "SECRETARIO") return null;
  return user?.dg || null;
}
