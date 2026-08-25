import React, { useState } from "react";
import Button from "../Shared/Button";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";

const OPCIONES = [
  { value: ESTATUS_REGISTRO.CUMPLIDO,  label: "Cumplido" },
  { value: ESTATUS_REGISTRO.PENDIENTE, label: "Pendiente" },
  { value: ESTATUS_REGISTRO.ATRASADO,  label: "Atrasado" },
  { value: ESTATUS_REGISTRO.NO_APLICA, label: "No aplica" },
];

/* Tipo A — estatus corto + evidencia (autorizaciones, entregas, cambios de proyecto) */
export default function CapturaTipoA({ registro, onGuardar, onCancelar }) {
  const [estatus, setEstatus] = useState(registro.estatus);
  const [motivo, setMotivo] = useState(registro.motivo || "");
  const [archivo, setArchivo] = useState(null);

  const guardar = () => {
    onGuardar({
      estatus,
      motivo,
      fechaReal: estatus === ESTATUS_REGISTRO.CUMPLIDO ? new Date().toISOString().slice(0, 10) : registro.fechaReal,
      evidenciaNombre: archivo ? archivo.name : registro.evidenciaNombre,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Estatus</label>
        <div className="flex flex-wrap gap-2">
          {OPCIONES.map((op) => (
            <button
              key={op.value}
              type="button"
              onClick={() => setEstatus(op.value)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={
                estatus === op.value
                  ? { backgroundColor: "#691C32", color: "#fff", borderColor: "#691C32" }
                  : { backgroundColor: "#fff", color: "#4b5563", borderColor: "#d1d5db" }
              }
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
          Comentario <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Detalle breve del estatus reportado..."
          className="w-full px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-[#691C32]/30"
          style={{ border: "1px solid #d1d5db" }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
          Evidencia <span className="text-gray-400 font-normal">(documento, oficio, foto)</span>
        </label>
        <input
          type="file"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="w-full text-xs"
        />
        {(archivo || registro.evidenciaNombre) && (
          <p className="mt-1 text-xs" style={{ color: "#6b7280" }}>
            📎 {archivo ? archivo.name : registro.evidenciaNombre}
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>
    </div>
  );
}
