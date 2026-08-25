import React from "react";
import { NATURALEZA } from "../../utils/naturaleza";
import {
  IconNaturalezaVisita,
  IconNaturalezaReporte,
  IconNaturalezaEvidencia,
  IconNaturalezaVerificacion,
  IconNaturalezaFinanciero,
} from "./IconosSOBSE";

const ICONOS = {
  [NATURALEZA.VISITA]: IconNaturalezaVisita,
  [NATURALEZA.REPORTE]: IconNaturalezaReporte,
  [NATURALEZA.EVIDENCIA]: IconNaturalezaEvidencia,
  [NATURALEZA.VERIFICACION]: IconNaturalezaVerificacion,
  [NATURALEZA.FINANCIERO]: IconNaturalezaFinanciero,
};

/**
 * Glifo de naturaleza + estado (Design System v2): la FORMA dice qué tipo
 * de trabajo es (siempre neutra); el PUNTO de la esquina dice en qué
 * estado está. Nunca se mezclan color y forma para lo mismo.
 */
export default function NaturalezaGlyph({ naturaleza, estatus, size = 26 }) {
  const Icon = ICONOS[naturaleza] || IconNaturalezaReporte;
  const completado = estatus === "cumplido";
  const dotColor = estatus === "atrasado" ? "var(--rojo)" : estatus === "por_vencer" ? "var(--naranja)" : null;

  return (
    <div
      className="shrink-0 rounded-lg flex items-center justify-center relative"
      style={{
        width: size,
        height: size,
        backgroundColor: completado ? "var(--verde)" : "var(--surface-2)",
        border: `1.5px solid ${completado ? "var(--verde)" : "var(--border)"}`,
        color: completado ? "#fff" : "var(--ink-soft)",
      }}
    >
      <Icon size={Math.round(size * 0.55)} />
      {dotColor && (
        <span
          className={`absolute rounded-full ${estatus === "atrasado" ? "animate-pulse-alert" : ""}`}
          style={{
            width: Math.max(7, Math.round(size * 0.3)),
            height: Math.max(7, Math.round(size * 0.3)),
            bottom: -2,
            right: -2,
            backgroundColor: dotColor,
            border: "1.5px solid var(--surface)",
          }}
        />
      )}
    </div>
  );
}
