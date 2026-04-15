import React, { memo } from "react";

function CardResumen({
  titulo,
  valor,
  subtitulo,
  icono,
  colorClase = "text-[#691C32]",
  bgClase = "bg-[rgba(105,28,50,0.06)]",
  borderColor = "#D4C4B0",
  progressValue = 0,
  progressColor = "#691C32",
}) {
  return (
    <div
      className="bg-white rounded-3xl p-6 shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl animate-fade-in"
      style={{
        borderTop: `6px solid ${borderColor}`,
        background: "linear-gradient(180deg, #FFFFFF 0%, #F7F3EE 100%)",
        borderLeft: "1px solid rgba(201,166,107,0.14)",
        borderRight: "1px solid rgba(201,166,107,0.14)",
        borderBottom: "1px solid rgba(201,166,107,0.14)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] mb-3" style={{ color: "#8B6E5A" }}>
            {titulo}
          </p>
          <p className={`text-4xl lg:text-5xl font-bold leading-none ${colorClase}`}>
            {valor}
          </p>
          {subtitulo && (
            <p className="text-sm mt-3" style={{ color: "#666666" }}>
              {subtitulo}
            </p>
          )}
        </div>

        <div className={`w-14 h-14 rounded-2xl ${bgClase} flex items-center justify-center text-sm font-bold shrink-0`} style={{ color: borderColor }}>
          {icono}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-[0.16em]" style={{ color: "#8B6E5A" }}>Participación</span>
          <span className="text-sm font-semibold" style={{ color: "#2C2C2C" }}>{progressValue}%</span>
        </div>
        <div className="rounded-full h-3 overflow-hidden" style={{ backgroundColor: "#ECE8E1" }}>
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: `${progressValue}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(CardResumen);
