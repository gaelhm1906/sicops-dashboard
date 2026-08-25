import React, { useState } from "react";
import BandejaTareasObra from "../components/Seguimiento/BandejaTareasObra";

/**
 * Preview aislado de SEGUIMIENTO_PS 2.0 — sin login, sin backend.
 * Temporal: solo para validar el diseño de la bandeja de tareas.
 * No forma parte del flujo real de la aplicación.
 */
const ROLES = [
  "SECRETARIO",
  "DIRECTOR_GENERAL",
  "DIRECTOR_OBRA",
  "JEFE_UNIDAD_OBRA",
  "SUPERVISION_EXTERNA",
  "ADMIN",
];

const OBRA_EJEMPLO = {
  nombre_obra: "Rehabilitación de la Unidad Deportiva Iztapalapa",
  nombre: "Rehabilitación de la Unidad Deportiva Iztapalapa",
  programa: "PARQUES ALEGRIA",
  clave_unica: "PREV-0001",
  tabla: "PARQUES ALEGRIA",
  id_obra: 1,
  id: 1,
};

export default function PreviewSeguimiento() {
  const [rol, setRol] = useState("ACTUALIZACION");
  const [abierta, setAbierta] = useState(true);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "linear-gradient(180deg, #F8F5F2 0%, #ECE9E2 100%)" }}
    >
      <div className="rounded-2xl px-6 py-4 max-w-md text-center" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
        <p className="text-sm font-semibold" style={{ color: "#92400e" }}>
          🔧 Vista de diseño — SEGUIMIENTO_PS 2.0
        </p>
        <p className="text-xs mt-1" style={{ color: "#78350f" }}>
          Sin login, sin backend. Los datos son de ejemplo y viven en localStorage.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRol(r)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            style={
              rol === r
                ? { backgroundColor: "#691C32", color: "#fff" }
                : { backgroundColor: "#fff", color: "#691C32", border: "1px solid rgba(105,28,50,0.3)" }
            }
          >
            {r}
          </button>
        ))}
      </div>

      {!abierta && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: "#7c2d12", color: "#fff" }}
        >
          📋 Abrir bandeja de seguimiento
        </button>
      )}

      {abierta && (
        <BandejaTareasObra
          obra={OBRA_EJEMPLO}
          rolOverride={rol}
          onClose={() => setAbierta(false)}
        />
      )}
    </div>
  );
}
