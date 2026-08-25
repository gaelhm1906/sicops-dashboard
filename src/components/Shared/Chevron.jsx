import React from "react";

/**
 * Flecha que gira 180° al expandir — reemplaza los "+"/"−" instantáneos.
 * El giro es la señal de estado; nunca un cambio de glifo sin transición.
 */
export default function Chevron({ open, size = 14, color = "currentColor", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ease-[var(--ease-in-out)] ${className}`}
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
