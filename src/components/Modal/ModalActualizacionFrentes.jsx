import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useObras } from "../../context/ObraContext";
import { frentesAPI } from "../../utils/api";
import Button from "../Shared/Button";

const NOMBRE_FIELDS = ["empresa", "nombre_frente", "frente", "nombre", "descripcion", "concepto"];

function getNombreFrente(f) {
  for (const field of NOMBRE_FIELDS) {
    const v = f[field];
    if (v && String(v).trim()) return String(v).trim();
  }
  return `Frente #${f.id}`;
}

function parseNum(val) {
  const n = parseFloat(String(val ?? "").replace(/[%,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function calcPonderado(frentes, avances) {
  let sumPeso = 0;
  let sumPesoAvance = 0;
  const nums = [];

  for (const f of frentes) {
    const avance = parseNum(avances[f.id] ?? f.avance);
    if (avance === null) continue;
    nums.push(avance);
    const peso = parseNum(f.monto_contrato);
    if (peso !== null && peso > 0) {
      sumPeso += peso;
      sumPesoAvance += peso * avance;
    }
  }

  if (sumPeso > 0) return Math.round((sumPesoAvance / sumPeso) * 100) / 100;
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function BarraPct({ valor }) {
  const pct = Math.max(0, Math.min(100, valor ?? 0));
  const color = pct >= 80 ? "bg-[#006341]" : pct >= 50 ? "bg-[#F4B860]" : "bg-[#E8A8A8]";
  return (
    <div className="w-full rounded-full h-1.5 overflow-hidden bg-gray-100">
      <div className={`h-1.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ModalActualizacionFrentes({ obra, onClose }) {
  const { updateObraLocal } = useObras();

  const [frentes,        setFrentes]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [guardando,      setGuardando]      = useState(false);
  const [error,          setError]          = useState("");
  const [avances,        setAvances]        = useState({});
  const [saved,          setSaved]          = useState(false);
  const [avanceResultado, setAvanceResultado] = useState(null);

  useEffect(() => {
    if (!obra?.clave_unica) return;
    setLoading(true);
    setError("");
    frentesAPI.obtener(obra.clave_unica)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setFrentes(arr);
        const init = {};
        for (const f of arr) {
          const n = parseNum(f.avance);
          init[f.id] = n !== null ? String(n) : "";
        }
        setAvances(init);
      })
      .catch((e) => setError(e.message || "Error al cargar frentes"))
      .finally(() => setLoading(false));
  }, [obra?.clave_unica]);

  const avancePonderado = useMemo(
    () => (frentes.length > 0 ? calcPonderado(frentes, avances) : null),
    [frentes, avances]
  );

  const handleChange = useCallback((id, val) => {
    setAvances((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleGuardar = useCallback(async () => {
    setGuardando(true);
    setError("");
    try {
      const updates = frentes.map((f) => ({
        id: f.id,
        avance: parseNum(avances[f.id] ?? f.avance) ?? 0,
      }));
      const res = await frentesAPI.batchAvance(obra.clave_unica, updates);
      const nuevoAvance = res.avance_calculado;
      setAvanceResultado(nuevoAvance);
      setSaved(true);
      if (nuevoAvance !== null && nuevoAvance !== undefined) {
        updateObraLocal({
          ...obra,
          avance_real:      nuevoAvance,
          avance:           nuevoAvance,
          porcentaje:       nuevoAvance,
          porcentaje_avance: nuevoAvance,
        });
      }
    } catch (e) {
      setError(e.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }, [frentes, avances, obra, updateObraLocal]);

  if (!obra) return null;

  const renderContenido = () => {
    if (saved) {
      return (
        <div className="text-center py-2 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <h3 className="text-lg font-bold text-green-700 mb-1">Frentes actualizados</h3>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-3 mb-4">
            <p className="text-xs text-green-600 font-medium mb-1">Nuevo avance calculado</p>
            <p className="text-3xl font-bold" style={{ color: "#006341" }}>
              {avanceResultado !== null ? `${avanceResultado}%` : "—"}
            </p>
            <p className="text-xs text-green-500 mt-1">Promedio ponderado por monto contrato</p>
          </div>
          <Button className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      );
    }

    if (loading) {
      return <div className="py-10 text-center text-sm text-gray-400">Cargando frentes...</div>;
    }

    if (frentes.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">Esta obra no tiene frentes registrados en frentes_obra.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>Cerrar</Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {frentes.map((f) => {
          const nombre  = getNombreFrente(f);
          const actual  = avances[f.id] ?? "";
          const actualN = parseNum(actual);
          const peso    = parseNum(f.monto_contrato);

          return (
            <div
              key={f.id}
              className="rounded-xl border p-3"
              style={{ borderColor: "#E5E7EB", backgroundColor: "#FAFAFA" }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{nombre}</p>
                  {(f.id_frente || f.contrato) && (
                    <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">
                      {f.id_frente || f.contrato}
                    </p>
                  )}
                  {peso !== null && peso > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Ponderación: ${peso.toLocaleString("es-MX")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={actual}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    className="w-20 text-center text-sm font-bold px-2 py-1.5 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-[#691C32]/30 focus:border-[#691C32]"
                    style={{ borderColor: "#D4C4B0" }}
                    placeholder="0"
                  />
                  <span className="text-gray-400 text-sm font-medium">%</span>
                </div>
              </div>
              {actualN !== null && <BarraPct valor={actualN} />}
            </div>
          );
        })}

        {/* Vista previa del promedio */}
        <div
          className="rounded-xl p-3 mt-1"
          style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: "#1D4ED8" }}>
                Avance calculado (ponderado)
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Se actualizará en la obra y en el Centro de Mando
              </p>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#1D4ED8" }}>
              {avancePonderado !== null ? `${avancePonderado}%` : "—"}
            </span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠️ {error}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleGuardar} loading={guardando} disabled={guardando}>
            Guardar frentes
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0"
          style={{ backgroundColor: "#1D4ED8" }}
        >
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {obra.nombre_obra || obra.nombre}
            </p>
            <p className="text-white/70 text-xs mt-0.5">{obra.programa} · Actualizar frentes</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
            disabled={guardando}
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {renderContenido()}
        </div>
      </div>
    </div>
  );
}

export default memo(ModalActualizacionFrentes);
