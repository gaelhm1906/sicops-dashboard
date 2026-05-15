/**
 * utils/permissions.js
 * Control de acceso a módulos del sistema SICOPS.
 *
 * Regla central: canAccessModule(moduleName, user, moduleStates)
 *   → true si el módulo está habilitado para todos  (enabled = true)
 *   → true si el usuario tiene rol en restrictedRoles (bypass de admin/secretario)
 *   → false en cualquier otro caso
 *
 * El parámetro moduleStates proviene de ModulesContext (estado BD en tiempo real).
 * Si no se pasa, se usan los valores estáticos de features.js como fallback.
 */

import { SYSTEM_MODULES, ALCANCES_ENABLED } from "../config/features";

export function normalizeRoleName(value) {
  return String(value || "").trim().toUpperCase();
}

/* ─── Función central ─── */

/**
 * Verifica si un usuario puede acceder a un módulo.
 * @param {string} moduleName - Clave del módulo: 'ALCANCES', 'UTOPIAS', etc.
 * @param {object} user       - Objeto usuario desde AuthContext
 * @param {object} moduleStates - Estado dinámico desde ModulesContext (opcional)
 */
export function canAccessModule(moduleName, user, moduleStates = null) {
  const key = String(moduleName).toUpperCase();
  const role = normalizeRoleName(user?.rol || user?.role);

  /* Obtener config: primero el estado dinámico (BD), luego el estático (features.js) */
  let enabled         = SYSTEM_MODULES[key]?.enabled         ?? true;
  let restrictedRoles = SYSTEM_MODULES[key]?.restrictedRoles ?? [];

  if (moduleStates && moduleStates[key]) {
    const dyn = moduleStates[key];
    /* El backend usa habilitado/rolesPermitidos; el config local usa enabled/restrictedRoles */
    if (typeof dyn.habilitado === "boolean")       enabled         = dyn.habilitado;
    else if (typeof dyn.enabled === "boolean")     enabled         = dyn.enabled;
    if (Array.isArray(dyn.rolesPermitidos))        restrictedRoles = dyn.rolesPermitidos;
    else if (Array.isArray(dyn.restrictedRoles))   restrictedRoles = dyn.restrictedRoles;
  }

  if (enabled) return true;
  return restrictedRoles.map(normalizeRoleName).includes(role);
}

/* ─── Helpers de retrocompatibilidad ─── */

/** Mantiene compatibilidad con código que ya importa canAccessAlcances */
export function canAccessAlcances(user, moduleStates = null) {
  return canAccessModule("ALCANCES", user, moduleStates);
}

/** Mantiene compatibilidad con código que ya importa isRoleAllowedForAlcances */
export function isRoleAllowedForAlcances(user) {
  const role = normalizeRoleName(user?.rol || user?.role);
  return (SYSTEM_MODULES.ALCANCES?.restrictedRoles ?? [])
    .map(normalizeRoleName)
    .includes(role);
}

/* ─── Utopías ─── */

export function canAccessUtopias(user, moduleStates = null) {
  return canAccessModule("UTOPIAS", user, moduleStates);
}

export function isRoleAllowedForUtopias(user) {
  const role = normalizeRoleName(user?.rol || user?.role);
  return (SYSTEM_MODULES.UTOPIAS?.restrictedRoles ?? [])
    .map(normalizeRoleName)
    .includes(role);
}

/* Rol exclusivo del subsistema Utopías (solo puede ver utopías) */
export function isEnlaceUtopias(user) {
  const role = normalizeRoleName(user?.rol || user?.role);
  return role === "UTOPIAS" || role === "ENLACE_UTOPIAS";
}

/* ─── Admin ─── */

export function isAdmin(user) {
  const role = normalizeRoleName(user?.rol || user?.role);
  return role === "ADMIN";
}

export function isAdminOrSecretario(user) {
  const role = normalizeRoleName(user?.rol || user?.role);
  return role === "ADMIN" || role === "SECRETARIO";
}

/* Re-exportar para que código existente que importa ALCANCES_ENABLED siga funcionando */
export { ALCANCES_ENABLED };
