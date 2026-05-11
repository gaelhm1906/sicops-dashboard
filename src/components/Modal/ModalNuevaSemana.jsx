import React, { memo, useCallback, useMemo, useState } from "react";
import { semanaAPI, invalidarCacheSemana } from "../../utils/api";
import { useObras } from "../../context/ObraContext";
import Button from "../Shared/Button";

function ModalNuevaSemana({ onClose }) {
  const { refreshObras } = useObras();
  const [confirmacion, setConfirmacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const confirmacionValida = useMemo(
    () => confirmacion.trim().toUpperCase() === "CONFIRMAR",
    [confirmacion]
  );

  const iniciarSemana = useCallback(async () => {
    if (!confirmacionValida || loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await semanaAPI.iniciar();
      invalidarCacheSemana();
      await refreshObras();
      setResultado(response?.data || null);
    } catch (err) {
      setError(err.message || "No se pudo iniciar la nueva semana.");
    } finally {
      setLoading(false);
    }
  }, [confirmacionValida, loading, refreshObras]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 1100 }}
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar nueva semana de actualizacion"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#E7DDCF" }}>
          <h3 className="font-semibold text-gray-800 text-base">Iniciar nueva semana de actualizacion</h3>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>
            Esta accion cerrara la semana actual y comenzara una nueva. Se generara un snapshot automatico.
          </p>
        </div>

        <div className="px-5 py-5">
          {resultado ? (
            <div className="animate-fade-in text-center py-2">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                <span className="text-3xl">✓</span>
              </div>
              <h4 className="text-xl font-bold text-green-700 mb-1">Nueva semana iniciada</h4>
              <p className="text-sm text-gray-600 mb-4">
                {resultado.periodo || "Se actualizo correctamente el periodo activo."}
              </p>
              <Button className="w-full" variant="success" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#FAFAF8", border: "1px solid #E7DDCF" }}>
                <p className="text-sm font-medium" style={{ color: "#691C32" }}>
                  Confirmacion requerida
                </p>
                <p className="text-xs mt-1" style={{ color: "#666666" }}>
                  Escribe exactamente <strong>CONFIRMAR</strong> para continuar.
                </p>
              </div>

              <label htmlFor="confirmar-semana" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmacion
              </label>
              <input
                id="confirmar-semana"
                type="text"
                value={confirmacion}
                onChange={(e) => {
                  setConfirmacion(e.target.value);
                  setError("");
                }}
                placeholder="Escribe CONFIRMAR"
                autoFocus
                className={`w-full px-4 py-3 rounded-lg border-2 font-mono text-center tracking-widest text-base transition-colors focus:outline-none focus:ring-2 ${
                  confirmacion && !confirmacionValida
                    ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-300"
                    : confirmacionValida
                    ? "border-[#006341] bg-[rgba(0,99,65,0.04)] text-[#006341] focus:ring-[#006341]/30"
                    : "border-[#D4C4B0] focus:border-[#691C32] focus:ring-[#691C32]/30"
                }`}
                onKeyDown={(e) => e.key === "Enter" && confirmacionValida && iniciarSemana()}
              />

              {confirmacion && !confirmacionValida && (
                <p className="text-xs text-red-600 mt-2">Debe escribir exactamente CONFIRMAR.</p>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
                  {error}
                </p>
              )}

              <div className="flex gap-2 justify-end mt-6">
                <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={iniciarSemana}
                  disabled={!confirmacionValida || loading}
                  loading={loading}
                >
                  Si, iniciar nueva semana
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ModalNuevaSemana);
