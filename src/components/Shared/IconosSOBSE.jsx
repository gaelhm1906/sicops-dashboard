import React from "react";

/**
 * Glifos propios de la identidad SOBSE — reservados para encabezados de
 * sección, estados vacíos y onboarding. La UI funcional (botones, acciones,
 * navegación) sigue usando la librería de trazo estándar; estos NO son
 * reemplazo de esa librería, son acentos de identidad.
 * Trazo: 1.75, sin relleno, esquinas redondeadas — ver Design System Fase 1.
 */
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconCasco({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 20V10l8-6 8 6v10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

export function IconPlano({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4" width="18" height="14" rx="1.5" />
      <path d="M3 9h18M8 4v5M16 4v5" />
    </svg>
  );
}

export function IconPuente({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M2 19h20M4 19V9l4-3 4 3v10M12 19V9l4-3 4 3v10" />
    </svg>
  );
}

export function IconNivel({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="10" width="18" height="4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M6 10v-2M18 10v-2" />
    </svg>
  );
}

export function IconBloque({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

/**
 * Glifos de NATURALEZA de actividad (Design System v2) — siempre en tono
 * neutro (heredan currentColor); el color de estado nunca vive aquí, vive
 * en el punto que se dibuja encima (ver Shared/NaturalezaGlyph.jsx).
 */
export function IconNaturalezaVisita({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}

export function IconNaturalezaReporte({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

export function IconNaturalezaEvidencia({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3" />
    </svg>
  );
}

export function IconNaturalezaVerificacion({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M9 9l1.6 1.6L14 7M9 15h6" />
    </svg>
  );
}

export function IconNaturalezaFinanciero({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.7 9.8c0-1-1-1.8-2.5-1.8s-2.5.7-2.5 1.7c0 2.6 5.2 1.2 5.2 3.8 0 1-1.1 1.8-2.6 1.8s-2.7-.8-2.7-1.8" />
    </svg>
  );
}
