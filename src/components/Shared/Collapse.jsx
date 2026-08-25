import React from "react";

/**
 * Expandir/colapsar con transición real (grid-template-rows 0fr↔1fr),
 * interrumpible y sin medir alturas en JS. El contenido permanece montado:
 * solo se recorta. Ver skill emil-design-eng — "la manera de ver las tareas".
 */
export default function Collapse({ open, children, className = "" }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-[var(--ease-in-out)] ${className}`}
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}
