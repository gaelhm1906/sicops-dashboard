import React, { useEffect, useState } from "react";

/**
 * Anillo de progreso para tarjetas hero guinda — al montar, dibuja el
 * trazo de 0 al valor real (Design System v2: "la información se está
 * calculando en vivo"). Es SVG puro (no conic-gradient) para poder animar
 * el trazo; `prefers-reduced-motion` ya se respeta de forma global en
 * globals.css, que fuerza duration ~0 en cualquier transición.
 */
export default function RingProgress({
  size = 76,
  strokeWidth = 6,
  pct = 0,
  trackColor = "rgba(255,255,255,0.28)",
  progressColor = "#fff",
  children,
}) {
  const [ready, setReady] = useState(false);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const offset = circumference * (1 - (ready ? clamped : 0) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms var(--ease-out)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
