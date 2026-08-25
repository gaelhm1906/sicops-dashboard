import React from "react";

/* Mapa de calor Dirección General/Funcionario × Categoría — reemplaza
   la cuadrícula de tarjetas del Nivel 1 (había que abrir tarjeta por
   tarjeta para saber qué categoría fallaba en cada una). Con la matriz
   completa a la vista, el patrón "quién falla en qué" se lee de un
   vistazo; el clic en una celda entra directo al detalle de esa
   combinación — mismo destino que antes, solo que ahora también se
   puede llegar ahí sin pasar primero por la tarjeta. */
const SEMAFORO_CELDA = {
  verde: { bg: "rgba(0,99,65,0.10)", border: "rgba(0,99,65,0.22)", text: "#006341" },
  ambar: { bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.24)", text: "#b45309" },
  rojo: { bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.22)", text: "#b91c1c" },
};

function colorCelda(pct) {
  if (pct >= 80) return SEMAFORO_CELDA.verde;
  if (pct >= 50) return SEMAFORO_CELDA.ambar;
  return SEMAFORO_CELDA.rojo;
}

export default function TablaCalorCumplimiento({ titulo, toggle, columnas, filas, onCelda }) {
  return (
    <div className="card px-5 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>{titulo}</h3>
        {toggle}
      </div>

      {filas.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: "var(--ink-faint)" }}>Sin datos aplicables todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "8px" }}>
            <thead>
              <tr>
                <th className="text-left px-1 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                  {filas[0]?.tipoEtiqueta || "Fila"}
                </th>
                {columnas.map((c) => (
                  <th key={c} className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-center whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.clave}>
                  <td className="px-1 text-sm font-bold whitespace-nowrap" style={{ color: "var(--ink)" }}>{fila.nombre}</td>
                  {columnas.map((cat) => {
                    const celda = fila.categorias.find((c) => c.categoria === cat);
                    if (!celda || celda.aplicable === 0) {
                      /* Ajuste de minuta (área técnica, 11 de agosto): las
                         etapas que no le corresponden a este perfil deben
                         leerse como inhabilitadas/"no aplica", no como un
                         simple guion (que se confunde con "sin datos"). */
                      return (
                        <td key={cat} className="px-1">
                          <div
                            className="rounded-lg text-center py-2.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-faint)", border: "1px dashed var(--border)" }}
                          >
                            No aplica
                          </div>
                        </td>
                      );
                    }
                    const color = colorCelda(celda.pct);
                    return (
                      <td key={cat} className="px-1">
                        <button
                          type="button"
                          onClick={() => onCelda(fila.clave, cat)}
                          className="w-full rounded-lg text-center py-2.5 text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 active:scale-95"
                          style={{ backgroundColor: color.bg, border: `1px solid ${color.border}`, color: color.text }}
                        >
                          {celda.pct}%
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
