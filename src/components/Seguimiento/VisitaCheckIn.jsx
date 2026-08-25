import React, { useState, useRef, useEffect } from "react";
import Button from "../Shared/Button";
import { formatearHora, formatearFechaPura } from "../../utils/formatters";
import { getBorradorVisita, guardarBorradorVisita, limpiarBorradorVisita } from "../../utils/seguimiento";

const MIN_FOTOS = 3;

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Check-in de visita obligada — genera bitácora automática por obra.
   Cada visita captura observación + avance visual + evidencia fotográfica,
   con metadatos (fecha, hora, funcionario) visibles y auto-capturados —
   Design System v2: nunca pedirle al usuario un dato que el sistema ya
   conoce. Permite guardar borrador para retomar más tarde. */
export default function VisitaCheckIn({ visitaObligada, visitasHoy, onRegistrar, obraKey, rol, nombreFuncionario }) {
  const [capturando, setCapturando] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [avanceObservado, setAvanceObservado] = useState(50);
  const [fotos, setFotos] = useState([]);
  const [horaEntrada, setHoraEntrada] = useState(null);
  const [vieneDeBorrador, setVieneDeBorrador] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [toast, setToast] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(false), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!visitaObligada || visitaObligada.visitasPorDia <= 0) return null;

  const completadas = visitasHoy.length;
  const meta = visitaObligada.visitasPorDia;
  const cumplida = completadas >= meta;

  const iniciarCaptura = () => {
    const borrador = getBorradorVisita(obraKey, rol);
    if (borrador) {
      setObservaciones(borrador.observaciones || "");
      setAvanceObservado(typeof borrador.avanceObservado === "number" ? borrador.avanceObservado : 50);
      setFotos(borrador.fotos || []);
      setHoraEntrada(borrador.horaEntrada || new Date().toISOString());
      setVieneDeBorrador(true);
    } else {
      setObservaciones("");
      setAvanceObservado(50);
      setFotos([]);
      setHoraEntrada(new Date().toISOString());
      setVieneDeBorrador(false);
    }
    setCapturando(true);
  };

  const datosActuales = () => ({ observaciones: observaciones.trim(), avanceObservado, fotos, horaEntrada });

  const handleSeleccionFotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevas = await Promise.all(
      files.map(async (file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUri: await fileToDataUri(file) }))
    );
    setFotos((prev) => [...prev, ...nuevas]);
    e.target.value = "";
  };

  const quitarFoto = (id) => setFotos((prev) => prev.filter((f) => f.id !== id));

  const guardarBorrador = () => {
    guardarBorradorVisita(obraKey, rol, datosActuales());
    setCapturando(false);
  };

  const cancelar = () => setCapturando(false);

  const puedeFinalizar = observaciones.trim().length > 0 && fotos.length >= MIN_FOTOS;

  const confirmar = async () => {
    if (!puedeFinalizar) return;
    setGuardando(true);
    await onRegistrar(datosActuales());
    limpiarBorradorVisita(obraKey, rol);
    setGuardando(false);
    setCapturando(false);
    setToast(true);
  };

  return (
    <div className="mb-4">
      {/* ── Resumen / disparador ── */}
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--crema)", border: "1px solid var(--oro)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--guinda)" }}>
              Visita obligada · {visitaObligada.label}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
              {completadas} de {meta} visita{meta !== 1 ? "s" : ""} registrada{completadas !== 1 ? "s" : ""} hoy
            </p>
            {visitaObligada.observaciones && (
              <p className="text-xs mt-0.5 italic" style={{ color: "var(--ink-faint)" }}>{visitaObligada.observaciones}</p>
            )}
          </div>
          {!capturando && (
            <button
              type="button"
              onClick={iniciarCaptura}
              disabled={cumplida}
              className="px-4 py-2 rounded-xl text-sm font-bold shrink-0 transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
              style={
                cumplida
                  ? { backgroundColor: "rgba(0,99,65,0.10)", color: "var(--verde)", cursor: "default" }
                  : { backgroundColor: "var(--guinda)", color: "#fff", cursor: "pointer" }
              }
            >
              {cumplida ? "✓ Completada" : "📍 Registrar visita"}
            </button>
          )}
        </div>
      </div>

      {/* ── Formulario de captura ── */}
      {capturando && (
        <div className="mt-4 space-y-4">
          {vieneDeBorrador && (
            <div className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: "rgba(188,149,92,0.12)", color: "#8C6B41" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9M3 12l3-3M3 12l3 3" /></svg>
              Continuando un borrador guardado
            </div>
          )}

          {/* Metadatos auto-capturados */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Fecha</p>
              <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: "var(--ink)" }}>{formatearFechaPura(horaEntrada)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Hora de entrada</p>
              <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: "var(--ink)" }}>{formatearHora(horaEntrada)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Funcionario</p>
              <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: "var(--ink)" }}>{nombreFuncionario || "—"}</p>
            </div>
          </div>
          <p className="text-[11px] font-semibold -mt-2.5" style={{ color: "var(--ink-faint)" }}>
            Visita {completadas + 1} de {meta} programada{meta !== 1 ? "s" : ""} hoy
          </p>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8C6B41" }}>
              Observaciones técnicas <span style={{ color: "var(--rojo)" }}>*</span>
            </label>
            <textarea
              autoFocus
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              placeholder="Describe detalladamente el estado general observado durante esta visita, mencionando avances, retrasos o contingencias..."
              className="w-full px-3.5 py-3 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
            />
          </div>

          {/* Avance físico observado */}
          <div className="rounded-xl px-4 py-3.5" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Avance físico observado</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>Ajusta según lo observado en sitio</p>
              </div>
              <span className="text-xl font-black shrink-0" style={{ color: "var(--guinda)" }}>{avanceObservado}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={avanceObservado}
              onChange={(e) => setAvanceObservado(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--guinda)" }}
            />
            <div className="flex justify-between text-[10px] font-bold mt-1" style={{ color: "var(--ink-faint)" }}>
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>

          {/* Evidencia fotográfica */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>
                Evidencia fotográfica <span style={{ color: "var(--rojo)" }}>*</span>
              </label>
              <span className="text-[11px] font-semibold" style={{ color: fotos.length >= MIN_FOTOS ? "var(--verde)" : "var(--ink-faint)" }}>
                {fotos.length} / {MIN_FOTOS} mínimo
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                style={{ border: "2px dashed var(--border)", backgroundColor: "var(--surface-2)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[9px] font-bold uppercase" style={{ color: "var(--ink-faint)" }}>Subir foto</span>
              </button>
              {fotos.map((foto) => (
                <div key={foto.id} className="aspect-square rounded-xl overflow-hidden relative group">
                  <img src={foto.dataUri} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => quitarFoto(foto.id)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: "rgba(105,28,50,0.55)" }}
                    aria-label="Quitar foto"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleSeleccionFotos} />
            <p className="text-[11px] italic text-center mt-2" style={{ color: "var(--ink-faint)" }}>Mínimo {MIN_FOTOS} fotografías requeridas para validación técnica.</p>
          </div>

          {/* Consejo del Axolote */}
          <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: "var(--crema)", border: "1px solid var(--oro)" }}>
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#fff", border: "1.5px solid var(--border)" }}>
              <img src="/web/assets/img/saludo.png" alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Consejo</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Asegúrate de que las fotos muestren claramente los detalles de los acabados — tu precisión garantiza la calidad de la obra.
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={confirmar}
              disabled={!puedeFinalizar || guardando}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: "var(--guinda)" }}
            >
              {guardando ? "Guardando..." : "Finalizar y guardar visita"}
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={guardarBorrador} className="flex-1">Guardar borrador</Button>
              <Button variant="ghost" size="sm" onClick={cancelar} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bitácora de hoy ── */}
      {completadas > 0 && !capturando && (
        <div className="mt-2 space-y-1.5">
          {visitasHoy.map((v, i) => (
            <div key={i} className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setExpandedIdx((prev) => (prev === i ? null : i))}
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--ink-soft)" }}>{formatearHora(v.hora)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {typeof v.avanceObservado === "number" && (
                    <span className="text-[10px] font-bold" style={{ color: "var(--guinda)" }}>{v.avanceObservado}%</span>
                  )}
                  {v.fotos?.length > 0 && (
                    <span className="text-[10px] font-semibold" style={{ color: "var(--ink-faint)" }}>📷 {v.fotos.length}</span>
                  )}
                  {v.observaciones && (
                    <span className="text-xs" style={{ color: "var(--oro)" }}>{expandedIdx === i ? "ocultar reporte −" : "ver reporte +"}</span>
                  )}
                </div>
              </button>
              {expandedIdx === i && (
                <div className="mt-1.5 space-y-2">
                  {v.observaciones && <p className="text-xs leading-5" style={{ color: "var(--ink-soft)" }}>{v.observaciones}</p>}
                  {v.fotos?.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {v.fotos.map((foto) => (
                        <img key={foto.id} src={foto.dataUri} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Toast de confirmación ── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-fade-in"
          style={{ backgroundColor: "#fff", border: "1px solid var(--border)", borderLeft: "4px solid var(--verde)" }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,99,65,0.10)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--verde)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Visita guardada correctamente</p>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Quedó registrada en la bitácora de la obra.</p>
          </div>
          <button onClick={() => setToast(false)} className="shrink-0 p-1" aria-label="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
