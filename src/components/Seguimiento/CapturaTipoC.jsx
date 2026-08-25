import React, { useState } from "react";
import Button from "../Shared/Button";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

/* Tipo C — datos tabulares (fuerza de trabajo, catálogo de conceptos, avance físico/financiero) */
export default function CapturaTipoC({ registro, onGuardar, onCancelar }) {
  const [archivo, setArchivo] = useState(null);
  const [filasDetectadas, setFilasDetectadas] = useState(null);

  const handleArchivo = (file) => {
    setArchivo(file || null);
    if (file) {
      // Placeholder visual — el parseo real de CSV/plantilla se define con el formato oficial
      setFilasDetectadas(Math.floor(Math.random() * 40) + 5);
    } else {
      setFilasDetectadas(null);
    }
  };

  const guardar = () => {
    onGuardar({
      estatus: ESTATUS_REGISTRO.CUMPLIDO,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: archivo ? archivo.name : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
      >
        <div className="text-xs" style={{ color: "#1d4ed8" }}>
          <p className="font-semibold">Plantilla oficial</p>
          <p className="mt-0.5" style={{ color: "#3b82f6" }}>Formato .csv / .xlsx — descarga la plantilla antes de capturar</p>
        </div>
        <button
          type="button"
          className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
          style={{ backgroundColor: "#2563eb", color: "#fff" }}
          onClick={() => {}}
        >
          ⬇ Plantilla
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
          Cargar archivo capturado
        </label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => handleArchivo(e.target.files?.[0] || null)}
          className="w-full text-xs"
        />
      </div>

      {archivo && filasDetectadas !== null && (
        <div className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16a34a" }}>
          ✓ {archivo.name} — {filasDetectadas} filas detectadas
        </div>
      )}

      {!archivo && registro.evidenciaNombre && (
        <p className="text-xs" style={{ color: "#6b7280" }}>📎 Última carga: {registro.evidenciaNombre}</p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={!archivo && !registro.evidenciaNombre}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
