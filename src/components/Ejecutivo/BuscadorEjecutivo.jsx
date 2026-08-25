import React, { useMemo, useState } from "react";

/* El tercer eje que faltaba: hoy se entraba por tarjeta de Dirección
   General o de Funcionario, pero no había forma de saltar directo a
   una obra por nombre desde este panel — había que salir al Directorio
   de Obras. Un buscador único cubre los tres ejes (obra, funcionario,
   Dirección General) desde el mismo lugar. */
function normalizar(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function BuscadorEjecutivo({ obras, direcciones, funcionarios, onObra, onDireccion, onFuncionario }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);

  const resultados = useMemo(() => {
    const q = normalizar(query);
    if (q.length < 2) return { obras: [], direcciones: [], funcionarios: [] };
    return {
      obras: obras.filter((o) => normalizar(o.nombre).includes(q) || normalizar(o.clave).includes(q)).slice(0, 5),
      direcciones: direcciones.filter((d) => normalizar(d.nombre).includes(q) || normalizar(d.clave).includes(q)).slice(0, 3),
      funcionarios: funcionarios.filter((f) => normalizar(f.nombre).includes(q)).slice(0, 4),
    };
  }, [query, obras, direcciones, funcionarios]);

  const hayResultados = resultados.obras.length + resultados.direcciones.length + resultados.funcionarios.length > 0;

  const elegir = (fn, valor) => {
    fn(valor);
    setQuery("");
    setAbierto(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          placeholder="Buscar obra, funcionario o dirección..."
          className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm"
          style={{ border: "1px solid var(--border)", backgroundColor: "#fff" }}
        />
      </div>

      {abierto && query.length >= 2 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl bg-white overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(76,57,35,0.14)" }}>
          {!hayResultados ? (
            <p className="px-4 py-3 text-xs" style={{ color: "var(--ink-faint)" }}>Sin resultados para "{query}".</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1.5">
              {resultados.direcciones.length > 0 && (
                <div className="px-2 mb-1">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Dirección General</p>
                  {resultados.direcciones.map((d) => (
                    <button key={d.clave} type="button" onMouseDown={() => elegir(onDireccion, d.clave)} className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--ink)" }}>
                      {d.nombre}
                    </button>
                  ))}
                </div>
              )}
              {resultados.funcionarios.length > 0 && (
                <div className="px-2 mb-1">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Funcionario</p>
                  {resultados.funcionarios.map((f) => (
                    <button key={f.clave} type="button" onMouseDown={() => elegir(onFuncionario, f.clave)} className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--ink)" }}>
                      {f.nombre}
                    </button>
                  ))}
                </div>
              )}
              {resultados.obras.length > 0 && (
                <div className="px-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Obra</p>
                  {resultados.obras.map((o) => (
                    <button key={o.key} type="button" onMouseDown={() => elegir(onObra, o.obra)} className="w-full text-left px-2 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)] truncate" style={{ color: "var(--ink)" }}>
                      {o.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
