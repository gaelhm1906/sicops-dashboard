import React, { useState } from "react";

/* Lista priorizada y cruzada — la pregunta "¿qué necesito ver hoy?"
   respondida en una sola pantalla, sin tener que elegir primero si se
   va a ver por Dirección General o por funcionario. Combina obras en
   avance crítico y obras con observaciones del Secretario sin atender,
   ordenadas por severidad. Cada fila ya trae la Dirección General y el
   responsable — el contexto que antes costaba tres pantallas armar. */
const LIMITE_COLAPSADO = 6;

const COLOR_SEVERIDAD = { rojo: "#DC2626", ambar: "#D97706" };

export default function PanelNecesitaAtencion({ items, onSeleccionar }) {
  const [expandido, setExpandido] = useState(false);
  const visibles = expandido ? items : items.slice(0, LIMITE_COLAPSADO);

  return (
    <div className="card px-5 py-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--rojo)"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16" r="1" fill="#fff" /></svg>
          Necesita su atención
        </h3>
        {items.length > LIMITE_COLAPSADO && (
          <button type="button" onClick={() => setExpandido((v) => !v)} className="text-[11px] font-bold" style={{ color: "var(--guinda)" }}>
            {expandido ? "Ver menos" : "Ver todo"}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: "var(--ink-faint)" }}>Nada urgente por ahora — toda la operación va al día.</p>
      ) : (
        <div className="space-y-1">
          {visibles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSeleccionar(item)}
              className="w-full flex items-start gap-2.5 px-2 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: COLOR_SEVERIDAD[item.severidad] }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{item.nombreObra}</p>
                <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{item.dg}{item.responsable ? ` · ${item.responsable}` : ""}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: COLOR_SEVERIDAD[item.severidad] }}>{item.etiqueta}</p>
              </div>
              <svg className="shrink-0 mt-1.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
