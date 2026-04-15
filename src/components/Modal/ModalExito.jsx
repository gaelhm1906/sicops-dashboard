import React, { memo } from "react";
import Button from "../Shared/Button";
import { formatearHora } from "../../utils/formatters";

function ModalExito({ mensaje, detalle, timestamp, usuario, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label="Operación exitosa"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
          <span className="text-3xl">✅</span>
        </div>

        <h2 className="text-xl font-bold text-green-700 mb-2">
          {mensaje || "¡Operación exitosa!"}
        </h2>

        {detalle && (
          <p className="text-sm text-gray-500 mb-4">{detalle}</p>
        )}

        {(timestamp || usuario) && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 text-left space-y-1 mb-4">
            {timestamp && (
              <div className="flex justify-between">
                <span>Guardado a las:</span>
                <span className="font-mono font-medium">{formatearHora(timestamp)}</span>
              </div>
            )}
            {usuario && (
              <div className="flex justify-between">
                <span>Por:</span>
                <span className="truncate max-w-[150px]">{usuario}</span>
              </div>
            )}
          </div>
        )}

        <Button variant="success" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

export default memo(ModalExito);
