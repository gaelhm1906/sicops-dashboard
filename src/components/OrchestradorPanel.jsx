import React, { useState, useRef, useCallback, memo } from "react";
import { procesarConsulta, EJEMPLOS_CONSULTA } from "../utils/orchestrator";
import { useObras } from "../context/ObraContext";

function OrchestradorPanel() {
  const { obras } = useObras();
  const [pregunta, setPregunta] = useState("");
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef(null);

  const handleConsultar = useCallback(() => {
    if (!pregunta.trim()) return;
    setLoading(true);

    setTimeout(() => {
      const resultado = procesarConsulta(pregunta.trim(), obras);
      setHistorial((prev) => [{ pregunta: pregunta.trim(), ...resultado }, ...prev].slice(0, 10));
      setPregunta("");
      setLoading(false);
    }, 200);
  }, [pregunta, obras]);

  const handleKeyDown = useCallback(
    (e) => { if (e.key === "Enter" && !e.shiftKey) handleConsultar(); },
    [handleConsultar]
  );

  const usarEjemplo = useCallback((ej) => {
    setAbierto(true);
    setPregunta(ej);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {abierto && (
        <div
          className="w-[calc(100vw-2rem)] sm:w-[430px] max-h-[78vh] rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 mb-4"
          style={{ background: "linear-gradient(180deg, #FFFDFC 0%, #F5F1EA 100%)", borderColor: "rgba(201,166,107,0.28)", boxShadow: "0 24px 60px rgba(38,26,17,0.26)" }}
        >
          <div
            className="px-6 py-5 flex items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, #691C32 0%, #7D2843 100%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/12 flex items-center justify-center text-white text-lg">
                IA
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Chat institucional</h3>
                <p className="text-xs text-white/70">Asistente ejecutivo para consulta de obras</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-10 h-10 rounded-2xl text-white/80 hover:text-white transition-all duration-300 hover:bg-white/10"
              aria-label="Cerrar asistente"
            >
              ×
            </button>
          </div>

          <div className="p-4 border-b" style={{ borderColor: "rgba(201,166,107,0.18)" }}>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej. ¿Qué obras tienen menor avance?"
                disabled={loading}
                className="flex-1 px-4 py-3 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-[#691C32] disabled:opacity-50"
                style={{ borderColor: "rgba(201,166,107,0.34)", backgroundColor: "#FFFFFF" }}
                aria-label="Campo para ingresar consulta"
              />
              <button
                type="button"
                onClick={handleConsultar}
                disabled={!pregunta.trim() || loading}
                className="px-5 py-3 text-white text-sm font-semibold rounded-2xl transition-all duration-300 disabled:opacity-40 hover:translate-y-[-2px] hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #691C32 0%, #550A1F 100%)", boxShadow: "0 10px 22px rgba(105,28,50,0.22)" }}
                aria-label="Realizar consulta"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  "Consultar"
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {EJEMPLOS_CONSULTA.slice(0, 4).map((ej) => (
                <button
                  key={ej}
                  type="button"
                  onClick={() => usarEjemplo(ej)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all duration-300 hover:translate-y-[-2px]"
                  style={{ borderColor: "rgba(201,166,107,0.34)", color: "#6B6762", backgroundColor: "#FFFFFF" }}
                >
                  {ej}
                </button>
              ))}
            </div>
          </div>

          {historial.length > 0 ? (
            <div className="max-h-[46vh] overflow-y-auto p-4 space-y-3">
              {historial.map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.18)", boxShadow: "0 8px 18px rgba(72,52,30,0.06)" }}
                >
                  <p className="text-xs mb-2" style={{ color: "#8B6E5A" }}>
                    <span className="font-semibold">Consulta:</span> {item.pregunta}
                  </p>
                  <p className="text-sm font-medium" style={{ color: item.confianza > 0 ? "#2C2C2C" : "#666666" }}>
                    {item.respuesta}
                  </p>

                  {item.sugerencias?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.sugerencias.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => usarEjemplo(s)}
                          className="text-xs px-2.5 py-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: "rgba(105,28,50,0.08)", color: "#691C32" }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {item.confianza > 0 && (
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          backgroundColor: item.confianza >= 0.9 ? "rgba(0,99,65,0.10)" : "rgba(201,166,107,0.16)",
                          color: item.confianza >= 0.9 ? "#006341" : "#8C6B41",
                        }}
                      >
                        {(item.confianza * 100).toFixed(0)}% confianza
                      </span>
                      {item.sql && (
                        <span className="text-xs font-mono truncate max-w-[220px]" style={{ color: "#9A938A" }} title={item.sql}>
                          {item.sql.slice(0, 52)}...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium" style={{ color: "#2C2C2C" }}>Consulta ejecutiva disponible</p>
              <p className="text-xs mt-2" style={{ color: "#666666" }}>
                Interroga el universo de obras en lenguaje natural para obtener respuestas rápidas dentro del panel.
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="w-16 h-16 rounded-full text-white font-semibold shadow-2xl transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_24px_45px_rgba(105,28,50,0.34)]"
        style={{ background: "linear-gradient(135deg, #691C32 0%, #7E2843 100%)" }}
        aria-label="Abrir asistente institucional"
      >
        IA
      </button>
    </div>
  );
}

export default memo(OrchestradorPanel);
