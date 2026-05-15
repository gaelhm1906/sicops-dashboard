/**
 * config/features.js
 * Configuración estática de módulos del sistema SICOPS.
 *
 * SYSTEM_MODULES define el estado BASE de cada módulo:
 *   - enabled:         si está abierto para todos los usuarios autenticados
 *   - restrictedRoles: roles que pueden acceder INCLUSO cuando enabled=false
 *   - label, message:  textos para la pantalla de módulo restringido
 *
 * ModulesContext sobrescribe estos valores con el estado real de BD
 * cuando el backend está disponible. Si el backend falla, estos valores
 * funcionan como fallback seguro.
 *
 * Regla de acceso:
 *   canAccess = module.enabled  OR  restrictedRoles.includes(user.rol)
 */

export const SYSTEM_MODULES = {
  ALCANCES: {
    enabled:         false,
    restrictedRoles: ["ADMIN", "SECRETARIO"],
    label:           "Módulo de Alcances",
    route:           "/alcances",
    message:
      "La Administración SOBSE restringió temporalmente el acceso al módulo de Alcances mientras concluyen las validaciones operativas internas. El acceso será habilitado próximamente para todos los enlaces.",
  },
  UTOPIAS: {
    enabled:         true,
    restrictedRoles: ["ADMIN", "SECRETARIO", "UTOPIAS", "ENLACE_UTOPIAS"],
    label:           "Subsistema Utopías",
    route:           "/utopias",
    message:
      "El subsistema Utopías se encuentra en validación operativa. Contacte al administrador del sistema.",
  },
};

/* Retrocompatibilidad: ALCANCES_ENABLED sigue funcionando para código que ya lo importa */
export const ALCANCES_ENABLED = SYSTEM_MODULES.ALCANCES.enabled;
