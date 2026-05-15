/**
 * context/ModulesContext.jsx
 * Estado dinámico de módulos SICOPS — cargado desde /api/modulos/estado.
 *
 * Si el backend no está disponible, usa los valores estáticos de features.js
 * como fallback seguro sin romper el flujo del usuario.
 *
 * Uso:
 *   const { canAccess, moduleStates, refreshModules } = useModules();
 *   canAccess("ALCANCES", user)  → true/false
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { modulosAPI } from "../utils/api";
import { canAccessModule } from "../utils/permissions";
import { SYSTEM_MODULES } from "../config/features";

const ModulesContext = createContext(null);

/* Convierte la respuesta del backend al mismo shape que SYSTEM_MODULES */
function mergeModuleStates(staticModules, backendModulos) {
  const result = { ...staticModules };

  for (const [key, cfg] of Object.entries(backendModulos)) {
    result[key] = {
      ...(staticModules[key] || {}),
      enabled:         typeof cfg.habilitado === "boolean" ? cfg.habilitado : (staticModules[key]?.enabled ?? true),
      restrictedRoles: Array.isArray(cfg.rolesPermitidos)  ? cfg.rolesPermitidos : (staticModules[key]?.restrictedRoles ?? []),
      label:           cfg.etiqueta            || staticModules[key]?.label           || key,
      message:         cfg.mensajeBloqueo      || staticModules[key]?.message         || "",
      actualizadoPor:  cfg.actualizadoPor      || null,
      updatedAt:       cfg.updatedAt           || null,
      /* guardar también las claves del backend para canAccessModule */
      habilitado:      typeof cfg.habilitado === "boolean" ? cfg.habilitado : (staticModules[key]?.enabled ?? true),
      rolesPermitidos: Array.isArray(cfg.rolesPermitidos) ? cfg.rolesPermitidos : (staticModules[key]?.restrictedRoles ?? []),
    };
  }

  return result;
}

export function ModulesProvider({ children }) {
  const [moduleStates, setModuleStates] = useState(SYSTEM_MODULES);
  const [loading, setLoading]           = useState(true);
  const [loaded, setLoaded]             = useState(false);
  const fetchingRef                     = useRef(false);

  const fetchModules = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const res = await modulosAPI.getEstado();
      if (res?.success && res.modulos && Object.keys(res.modulos).length > 0) {
        setModuleStates(mergeModuleStates(SYSTEM_MODULES, res.modulos));
      }
    } catch {
      /* Si falla, SYSTEM_MODULES ya está como estado inicial — no hacer nada */
    } finally {
      setLoading(false);
      setLoaded(true);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const refreshModules = useCallback(async () => {
    setLoading(true);
    fetchingRef.current = false;
    await fetchModules();
  }, [fetchModules]);

  /* canAccess verifica acceso usando el estado dinámico */
  const canAccess = useCallback(
    (moduleName, user) => canAccessModule(moduleName, user, moduleStates),
    [moduleStates]
  );

  /* getModuleInfo retorna la config completa de un módulo */
  const getModuleInfo = useCallback(
    (moduleName) => moduleStates[String(moduleName).toUpperCase()] || null,
    [moduleStates]
  );

  const value = useMemo(
    () => ({ moduleStates, loading, loaded, canAccess, getModuleInfo, refreshModules }),
    [moduleStates, loading, loaded, canAccess, getModuleInfo, refreshModules]
  );

  return (
    <ModulesContext.Provider value={value}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModulesContext);
  if (!ctx) {
    /* Fuera del provider — devolver valores seguros para no crashear */
    return {
      moduleStates:   SYSTEM_MODULES,
      loading:        false,
      loaded:         true,
      canAccess:      (name, user) => canAccessModule(name, user, SYSTEM_MODULES),
      getModuleInfo:  (name)       => SYSTEM_MODULES[String(name).toUpperCase()] || null,
      refreshModules: () => Promise.resolve(),
    };
  }
  return ctx;
}
