import React, { useEffect, useState } from "react";
import { obtenerDatosFinancierosServidor, guardarDatosFinancierosServidor } from "../../api/psDatosFinancierosApi";

const inputEstilo = { border: "1px solid var(--border)" };

function idUnicoLocal() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* "Datos Contractuales Financieros" del contrato de supervisión — pedido
   real del área, 2026-08-21: existían en el modelo viejo (utils/contratos.js)
   pero nunca se migraron al backend real. Los captura/edita SOLO
   Supervisión Externa (candado real en el servidor, ver
   datosFinancierosController.js) sobre su propio contrato; cualquier otro
   rol que llegue a verlo (Concursos y Contratos) lo recibe en modo
   solo-lectura (`puedeEditar: false` que regresa el servidor).
   `onCompletado` se dispara la primera vez que se guarda con éxito — el
   llamador (CapturaAvanceFisico) lo usa para dejar de bloquear el paso al
   programa de obra. */
export default function DatosContractualesFinancieros({ contratoId, onCompletado }) {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [completo, setCompleto] = useState(false);

  const [retencionPorcentaje, setRetencionPorcentaje] = useState("");
  const [retencionAtrasoObraPorcentaje, setRetencionAtrasoObraPorcentaje] = useState("");
  const [deducciones, setDeducciones] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [deduccionNueva, setDeduccionNueva] = useState({ concepto: "", porcentaje: "" });
  const [sancionNueva, setSancionNueva] = useState({ concepto: "", porcentaje: "", diasPermitidos: "", periodosSancion: "" });

  useEffect(() => {
    if (!contratoId) { setCargando(false); return; }
    let cancelado = false;
    obtenerDatosFinancierosServidor(contratoId)
      .then((d) => {
        if (cancelado) return;
        setPuedeEditar(!!d.puedeEditar);
        setCompleto(!!d.completo);
        setRetencionPorcentaje(d.retencionPorcentaje ?? "");
        setRetencionAtrasoObraPorcentaje(d.retencionAtrasoObraPorcentaje ?? "");
        setDeducciones(d.deducciones || []);
        setSanciones(d.sanciones || []);
      })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [contratoId]);

  const agregarDeduccionNueva = () => {
    if (!deduccionNueva.concepto.trim()) return;
    setDeducciones((prev) => [...prev, { id: idUnicoLocal(), concepto: deduccionNueva.concepto.trim(), porcentaje: Number(deduccionNueva.porcentaje) || 0 }]);
    setDeduccionNueva({ concepto: "", porcentaje: "" });
  };
  const quitarDeduccion = (id) => setDeducciones((prev) => prev.filter((d) => d.id !== id));

  const agregarSancionNueva = () => {
    if (!sancionNueva.concepto.trim()) return;
    setSanciones((prev) => [...prev, {
      id: idUnicoLocal(), concepto: sancionNueva.concepto.trim(), porcentaje: Number(sancionNueva.porcentaje) || 0,
      diasPermitidos: sancionNueva.diasPermitidos === "" ? null : Number(sancionNueva.diasPermitidos),
      periodosSancion: sancionNueva.periodosSancion === "" ? null : Number(sancionNueva.periodosSancion),
    }]);
    setSancionNueva({ concepto: "", porcentaje: "", diasPermitidos: "", periodosSancion: "" });
  };
  const quitarSancion = (id) => setSanciones((prev) => prev.filter((s) => s.id !== id));

  const guardar = async () => {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await guardarDatosFinancierosServidor(contratoId, {
        retencionPorcentaje: retencionPorcentaje === "" ? null : Number(retencionPorcentaje),
        retencionAtrasoObraPorcentaje: retencionAtrasoObraPorcentaje === "" ? null : Number(retencionAtrasoObraPorcentaje),
        deducciones: deducciones.map((d) => ({ concepto: d.concepto, porcentaje: d.porcentaje })),
        sanciones: sanciones.map((s) => ({ concepto: s.concepto, porcentaje: s.porcentaje, diasPermitidos: s.diasPermitidos, periodosSancion: s.periodosSancion })),
      });
      setMensaje("✓ Guardado.");
      const yaEstabaCompleto = completo;
      setCompleto(true);
      if (!yaEstabaCompleto) onCompletado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Cargando datos contractuales financieros…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FBEAE8", color: "#B3261E" }}>⚠ {error}</p>}
      {mensaje && <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--verde-soft, #E3F1EC)", color: "var(--verde)" }}>{mensaje}</p>}
      {!puedeEditar && (
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Solo lectura — estos datos los captura Supervisión Externa.</p>
      )}

      {/* Deducciones específicas */}
      <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Deducciones específicas</p>
        <div className="space-y-1.5 mb-2">
          {deducciones.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin deducciones registradas (ej. supervisión 2%, operación 1.5%).</p>
          )}
          {deducciones.map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
              <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{d.concepto}</span>
              <span className="text-xs font-bold shrink-0" style={{ color: "var(--guinda)" }}>{d.porcentaje}%</span>
              {puedeEditar && (
                <button type="button" onClick={() => quitarDeduccion(d.id)} className="font-bold shrink-0" style={{ color: "var(--rojo, #B3261E)" }}>✕</button>
              )}
            </div>
          ))}
        </div>
        {puedeEditar && (
          <div className="flex items-end gap-2">
            <input placeholder="Concepto (ej. Supervisión)" value={deduccionNueva.concepto} onChange={(e) => setDeduccionNueva((d) => ({ ...d, concepto: e.target.value }))} className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <input type="number" step="0.01" placeholder="%" value={deduccionNueva.porcentaje} onChange={(e) => setDeduccionNueva((d) => ({ ...d, porcentaje: e.target.value }))} className="w-20 px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <button type="button" onClick={agregarDeduccionNueva} className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shrink-0" style={{ backgroundColor: "var(--guinda)" }}>+ Agregar</button>
          </div>
        )}
      </div>

      {/* Sanciones */}
      <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Sanciones</p>
        <div className="space-y-1.5 mb-2">
          {sanciones.length === 0 && (
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin sanciones registradas (ej. entrega extemporánea de estimación).</p>
          )}
          {sanciones.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-wrap" style={{ backgroundColor: "var(--surface-2)" }}>
              <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{s.concepto}</span>
              {s.diasPermitidos != null && <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{s.diasPermitidos} días permitidos</span>}
              {s.periodosSancion != null && <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{s.periodosSancion} periodo(s)</span>}
              <span className="text-xs font-bold shrink-0" style={{ color: "var(--guinda)" }}>{s.porcentaje}%</span>
              {puedeEditar && (
                <button type="button" onClick={() => quitarSancion(s.id)} className="font-bold shrink-0" style={{ color: "var(--rojo, #B3261E)" }}>✕</button>
              )}
            </div>
          ))}
        </div>
        {puedeEditar && (
          <div className="flex items-end gap-2 flex-wrap">
            <input placeholder="Concepto (ej. Entrega extemporánea)" value={sancionNueva.concepto} onChange={(e) => setSancionNueva((s) => ({ ...s, concepto: e.target.value }))} className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <input type="number" placeholder="Días permit." value={sancionNueva.diasPermitidos} onChange={(e) => setSancionNueva((s) => ({ ...s, diasPermitidos: e.target.value }))} className="w-24 px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <input type="number" placeholder="Periodos" value={sancionNueva.periodosSancion} onChange={(e) => setSancionNueva((s) => ({ ...s, periodosSancion: e.target.value }))} className="w-20 px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <input type="number" step="0.01" placeholder="%" value={sancionNueva.porcentaje} onChange={(e) => setSancionNueva((s) => ({ ...s, porcentaje: e.target.value }))} className="w-16 px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
            <button type="button" onClick={agregarSancionNueva} className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shrink-0" style={{ backgroundColor: "var(--guinda)" }}>+ Agregar</button>
          </div>
        )}
      </div>

      {/* Retenciones */}
      <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8C6B41" }}>Retenciones</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Porcentaje de retención</label>
            <input disabled={!puedeEditar} type="number" step="0.01" placeholder="Ej. 5" value={retencionPorcentaje} onChange={(e) => setRetencionPorcentaje(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Atraso de obra</label>
            <input disabled={!puedeEditar} type="number" step="0.01" placeholder="Ej. 2" value={retencionAtrasoObraPorcentaje} onChange={(e) => setRetencionAtrasoObraPorcentaje(e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded-lg" style={inputEstilo} />
          </div>
        </div>
      </div>

      {puedeEditar && (
        <div className="flex justify-end">
          <button type="button" onClick={guardar} disabled={guardando} className="text-xs font-bold px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "var(--guinda)", opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Guardando…" : "Guardar datos financieros"}
          </button>
        </div>
      )}
    </div>
  );
}
