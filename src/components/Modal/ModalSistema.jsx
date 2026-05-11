import React, { memo, useCallback, useMemo, useState } from "react";
import { sistemaAPI } from "../../utils/api";
import Button from "../Shared/Button";

function ModalSistema({ abierto, onClose, onChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const siguienteEstado = useMemo(() => !abierto, [abierto]);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError("");
    try {
      const response = await sistemaAPI.toggle(siguienteEstado);
      onChange?.(response);
      onClose?.();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado del sistema.");
    } finally {
      setLoading(false);
    }
  }, [loading, siguienteEstado, onChange, onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 1100 }}
      role="dialog"
      aria-modal="true"
      aria-label="Estado del sistema"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#E7DDCF" }}>
          <h3 className="font-semibold text-gray-800 text-base">Estado del sistema</h3>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>
            {abierto
              ? "El sistema esta actualmente ABIERTO. Los usuarios pueden actualizar informacion."
              : "El sistema esta actualmente CERRADO. Solo consulta disponible."}
          </p>
        </div>

        <div className="px-5 py-5">
          <div
            className="rounded-xl p-4 mb-4 border"
            style={{
              backgroundColor: abierto ? "rgba(0,99,65,0.05)" : "rgba(105,28,50,0.06)",
              borderColor: abierto ? "rgba(0,99,65,0.20)" : "rgba(105,28,50,0.18)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${abierto ? "animate-pulse" : ""}`}
                style={{ backgroundColor: abierto ? "#006341" : "#691C32" }}
              />
              <span className="text-sm font-semibold" style={{ color: abierto ? "#006341" : "#691C32" }}>
                {abierto ? "Sistema abierto" : "Sistema cerrado"}
              </span>
            </div>
            <p className="text-xs" style={{ color: "#666666" }}>
              {abierto
                ? "Si continuas, las actualizaciones quedaran bloqueadas hasta volver a abrir el sistema."
                : "Si continuas, los usuarios con permiso podran volver a capturar actualizaciones."}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant={abierto ? "danger" : "success"}
              onClick={handleToggle}
              loading={loading}
            >
              {abierto ? "Cerrar sistema" : "Abrir sistema"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ModalSistema);
