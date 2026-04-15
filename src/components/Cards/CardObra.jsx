import React, { useState, memo, useCallback } from "react";
import { colorBarra, estadoLabel, formatearFechaHora } from "../../utils/formatters";
import Button from "../Shared/Button";

function CardObra({ obra, onActualizar }) {
  const [abierta, setAbierta] = useState(false);
  const estado = estadoLabel(obra.estado);

  const toggle = useCallback(() => setAbierta((v) => !v), []);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-all duration-200"
      style={{ border: "1px solid #D4C4B0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Cabecera siempre visible */}
      <button
        onClick={toggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors"
        style={{ minHeight: "56px" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F5F3F0"; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
        aria-expanded={abierta}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: "#2C2C2C" }}>{obra.nombre}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "#666666" }}>{obra.programa}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${estado.clase} text-xs`}>
            {estado.label}
          </span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${abierta ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
            style={{ color: "#D4C4B0" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Detalles expandibles */}
      {abierta && (
        <div
          className="px-4 pb-4 animate-fade-in"
          style={{ borderTop: "1px solid rgba(212,196,176,0.5)" }}
        >
          {/* Barra de progreso */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: "#666666" }}>
              <span>Avance</span>
              <span className="font-semibold" style={{ color: "#691C32" }}>{obra.porcentaje}%</span>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "#F5F3F0" }}>
              <div
                className={`h-2 rounded-full transition-all duration-500 ${colorBarra(obra.porcentaje)}`}
                style={{ width: `${obra.porcentaje}%` }}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: "#666666" }}>
            <div>
              <span className="font-medium" style={{ color: "#2C2C2C" }}>Última actualización</span>
              <p>{formatearFechaHora(obra.ultimaActualizacion)}</p>
            </div>
            <div>
              <span className="font-medium" style={{ color: "#2C2C2C" }}>Usuario</span>
              <p className="truncate">{obra.usuario || "—"}</p>
            </div>
          </div>

          <div className="mt-3">
            <Button
              size="sm"
              onClick={() => onActualizar?.(obra)}
              className="w-full"
              aria-label={`Actualizar obra ${obra.nombre}`}
            >
              Actualizar avance
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(CardObra);
