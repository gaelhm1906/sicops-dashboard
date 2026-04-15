import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { useAuth }  from "../../context/AuthContext";
import { useObras } from "../../context/ObraContext";
import { obrasAPI, normalizeObra } from "../../utils/api";
import { validarPorcentaje, evaluarDelta, validarConfirmacion } from "../../utils/validations";
import { formatearHora } from "../../utils/formatters";
import Button from "../Shared/Button";

const PASOS = ["Edición", "Confirmación", "Verificación", "Éxito"];

function BarraProgreso({ valor, max = 100 }) {
  const pct   = Math.max(0, Math.min(100, (valor / max) * 100));
  const color =
    pct >= 80 ? "bg-[#006341]" :
    pct >= 50 ? "bg-[#F4B860]" : "bg-[#E8A8A8]";

  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "#F5F3F0" }}>
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ModalActualizacion({ obra, onClose }) {
  const { user }           = useAuth();
  const { updateObraLocal } = useObras();

  const [paso,        setPaso]      = useState(0);
  const [input,       setInput]     = useState(obra?.porcentaje ?? 0);
  const [motivo,      setMotivo]    = useState("");
  const [confirmText, setConfirm]   = useState("");
  const [deltaInfo,   setDeltaInfo] = useState(null);
  const [inputError,  setInputErr]  = useState("");
  const [guardadoEn,  setGuardado]  = useState(null);
  const [shake,       setShake]     = useState(false);

  // Estado del flujo backend
  const [cambioId,    setCambioId]  = useState(null);
  const [apiLoading,  setApiLoad]   = useState(false);
  const [apiError,    setApiError]  = useState("");

  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* Evaluar delta en tiempo real */
  useEffect(() => {
    if (obra) {
      const err = validarPorcentaje(input);
      setDeltaInfo(!err ? evaluarDelta(obra.porcentaje, Number(input)) : null);
      setInputErr(err || "");
    }
  }, [input, obra]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 350);
  }, []);

  /* ── PASO 0 → 1: llamar obrasAPI.editar ── */
  const irSiguiente = useCallback(async () => {
    const err = validarPorcentaje(input);
    if (err)               { triggerShake(); return; }
    if (!deltaInfo?.valido){ triggerShake(); return; }

    setApiLoad(true);
    setApiError("");
    try {
      const res = await obrasAPI.editar(obra.id, Number(input), motivo);
      setCambioId(res.cambio_id);
      setPaso(1);
    } catch (e) {
      setApiError(e.message || "Error al registrar el cambio");
      triggerShake();
    } finally {
      setApiLoad(false);
    }
  }, [input, deltaInfo, motivo, obra, triggerShake]);

  /* ── PASO 1 → 2: llamar obrasAPI.confirmarStep1 ── */
  const irConfirmar = useCallback(async () => {
    if (!cambioId) return;
    setApiLoad(true);
    setApiError("");
    try {
      await obrasAPI.confirmarStep1(obra.id, cambioId);
      setPaso(2);
    } catch (e) {
      setApiError(e.message || "Error en la confirmación");
    } finally {
      setApiLoad(false);
    }
  }, [obra, cambioId]);

  /* ── PASO 2 → 3: llamar obrasAPI.confirmarStep2 ── */
  const finalizar = useCallback(async () => {
    if (!validarConfirmacion(confirmText)) { triggerShake(); return; }
    if (!cambioId) return;

    setApiLoad(true);
    setApiError("");
    try {
      const res = await obrasAPI.confirmarStep2(obra.id, cambioId, confirmText);
      // Actualizar estado local con los datos devueltos por el backend
      updateObraLocal(normalizeObra(res.obra));
      setGuardado(new Date().toISOString());
      setPaso(3);
    } catch (e) {
      setApiError(e.message || "Error al finalizar el cambio");
      triggerShake();
    } finally {
      setApiLoad(false);
    }
  }, [confirmText, cambioId, obra, updateObraLocal, triggerShake]);

  const irVolver = useCallback((p) => {
    setApiError("");
    setPaso(p);
  }, []);

  if (!obra) return null;

  const nuevoValor = Number(input);

  /* ── PASO 0: EDICIÓN ── */
  const renderPaso0 = () => (
    <div key="p0" className={`animate-slide-in ${shake ? "animate-shake" : ""}`}>
      <h3 className="font-semibold text-gray-800 text-base mb-4">Actualizar obra</h3>

      <p className="text-sm text-gray-500 mb-1">Avance actual</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1"><BarraProgreso valor={obra.porcentaje} /></div>
        <span className="text-2xl font-bold w-14 text-right" style={{ color: "#691C32" }}>{obra.porcentaje}%</span>
      </div>

      <div className="mb-4">
        <label htmlFor="nuevo-avance" className="block text-sm font-medium text-gray-700 mb-1">
          Nuevo avance <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id="nuevo-avance"
            type="number"
            min="0"
            max="100"
            value={input}
            onChange={(e) => { setInput(e.target.value); setApiError(""); }}
            className={`w-24 text-center text-xl font-bold px-3 py-2 rounded-lg border-2 transition-colors
              focus:outline-none focus:ring-2
              ${inputError
                ? "border-red-400 bg-red-50 focus:ring-red-400"
                : "border-[#D4C4B0] focus:border-[#691C32] focus:ring-[#691C32]/30"}`}
            aria-invalid={!!inputError}
            aria-describedby="avance-feedback"
          />
          <span className="text-gray-500 font-medium">%</span>
        </div>
        {inputError && (
          <p id="avance-feedback" className="text-xs text-red-600 mt-1">🔴 {inputError}</p>
        )}
      </div>

      {/* Motivo (opcional) */}
      <div className="mb-4">
        <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 mb-1">
          Motivo <span className="text-gray-400 text-xs font-normal">(opcional)</span>
        </label>
        <input
          id="motivo"
          type="text"
          maxLength={120}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: avance físico semana 3"
          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[#691C32]/30 focus:border-[#691C32]"
          style={{ border: "1px solid #D4C4B0" }}
        />
      </div>

      {/* Feedback delta */}
      {!inputError && deltaInfo && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm mb-4 ${deltaInfo.bg}`}>
          <span>{deltaInfo.icono}</span>
          <span className={deltaInfo.color}>{deltaInfo.mensaje}</span>
        </div>
      )}

      {/* Vista previa barra nueva */}
      {!inputError && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Vista previa nuevo avance</p>
          <BarraProgreso valor={nuevoValor} />
        </div>
      )}

      {apiError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          ⚠️ {apiError}
        </p>
      )}

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={apiLoading}>Cancelar</Button>
        <Button
          size="sm"
          onClick={irSiguiente}
          disabled={!!inputError || !deltaInfo?.valido || apiLoading}
          loading={apiLoading}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );

  /* ── PASO 1: CONFIRMACIÓN ── */
  const renderPaso1 = () => (
    <div key="p1" className="animate-slide-in">
      <h3 className="font-semibold text-gray-800 text-base mb-4">Confirmar cambio</h3>

      <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
        <p className="font-medium text-gray-800 text-sm">{obra.nombre}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">De:</span>
          <span className="font-bold text-gray-700">{obra.porcentaje}%</span>
          <span className="text-gray-400">→</span>
          <span className="font-bold" style={{ color: "#691C32" }}>{nuevoValor}%</span>
        </div>
        {deltaInfo && (
          <div className={`flex items-center gap-2 text-sm ${deltaInfo.color}`}>
            <span>{deltaInfo.icono}</span>
            <span>{deltaInfo.mensaje}</span>
          </div>
        )}
        {motivo && (
          <p className="text-xs text-gray-500 italic">Motivo: {motivo}</p>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">¿Confirma esta actualización?</p>

      {apiError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          ⚠️ {apiError}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={() => irVolver(0)} disabled={apiLoading}>← Volver</Button>
        <Button size="sm" onClick={irConfirmar} loading={apiLoading} disabled={apiLoading}>Confirmar</Button>
      </div>
    </div>
  );

  /* ── PASO 2: VERIFICACIÓN ── */
  const renderPaso2 = () => (
    <div key="p2" className={`animate-slide-in ${shake ? "animate-shake" : ""}`}>
      <h3 className="font-semibold text-gray-800 text-base mb-2">Verificación final</h3>
      <p className="text-sm text-gray-500 mb-4">
        Por seguridad, escriba exactamente: <strong className="text-gray-800">CONFIRMO</strong>
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => { setConfirm(e.target.value); setApiError(""); }}
        placeholder="CONFIRMO"
        autoFocus
        className={`w-full px-4 py-3 rounded-lg border-2 font-mono text-center tracking-widest text-base
          transition-colors focus:outline-none focus:ring-2
          ${confirmText && !validarConfirmacion(confirmText)
            ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-300"
            : confirmText && validarConfirmacion(confirmText)
            ? "border-[#006341] bg-[rgba(0,99,65,0.04)] text-[#006341] focus:ring-[#006341]/30"
            : "border-[#D4C4B0] focus:border-[#691C32] focus:ring-[#691C32]/30"}`}
        aria-label="Campo de confirmación de seguridad"
        onKeyDown={(e) => e.key === "Enter" && validarConfirmacion(confirmText) && finalizar()}
      />

      {confirmText && !validarConfirmacion(confirmText) && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <span>🔴</span> Debe escribir exactamente CONFIRMO
        </p>
      )}

      {apiError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          ⚠️ {apiError}
        </p>
      )}

      <div className="flex gap-2 justify-end mt-6">
        <Button variant="secondary" size="sm" onClick={() => irVolver(1)} disabled={apiLoading}>← Volver</Button>
        <Button
          size="sm"
          disabled={!validarConfirmacion(confirmText) || apiLoading}
          loading={apiLoading}
          onClick={finalizar}
        >
          Finalizar
        </Button>
      </div>
    </div>
  );

  /* ── PASO 3: ÉXITO ── */
  const renderPaso3 = () => (
    <div key="p3" className="animate-fade-in text-center py-2">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
        <span className="text-3xl">✅</span>
      </div>
      <h3 className="text-xl font-bold text-green-700 mb-1">¡Cambio guardado!</h3>
      <p className="text-sm text-gray-600 font-medium mb-4">{obra.nombre}</p>

      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1 text-left">
        <div className="flex justify-between">
          <span>Actualizado al:</span>
          <span className="font-bold" style={{ color: "#691C32" }}>{nuevoValor}%</span>
        </div>
        <div className="flex justify-between">
          <span>Guardado a las:</span>
          <span className="font-mono">{guardadoEn ? formatearHora(guardadoEn) : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>Por:</span>
          <span className="truncate max-w-[150px]">{user?.email || "—"}</span>
        </div>
      </div>

      <Button className="mt-6 w-full" onClick={onClose} variant="success">
        Cerrar
      </Button>
    </div>
  );

  const renderPasoActual = () => {
    switch (paso) {
      case 0: return renderPaso0();
      case 1: return renderPaso1();
      case 2: return renderPaso2();
      case 3: return renderPaso3();
      default: return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Actualizar obra ${obra.nombre}`}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ backgroundColor: "#691C32" }}
        >
          <div>
            <p className="text-white font-semibold text-sm">{obra.nombre}</p>
            <p className="text-white/70 text-xs mt-0.5">{obra.programa}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Cerrar modal"
            disabled={apiLoading}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Indicador de pasos */}
        {paso < 3 && (
          <div className="flex items-center px-6 py-3 bg-gray-50 border-b border-gray-100">
            {PASOS.slice(0, 3).map((p, i) => (
              <React.Fragment key={p}>
                <div className={`flex items-center gap-1.5 text-xs font-medium
                  ${i === paso ? "text-[#691C32]" : i < paso ? "text-[#006341]" : "text-gray-300"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border
                    ${i === paso   ? "border-[#691C32] bg-[rgba(105,28,50,0.06)] text-[#691C32]"
                    : i < paso     ? "border-[#006341] bg-[rgba(0,99,65,0.06)]  text-[#006341]"
                                   : "border-gray-200  text-gray-300"}`}>
                    {i < paso ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:inline">{p}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px mx-2 ${i < paso ? "bg-[#006341]/30" : "bg-gray-200"}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Contenido del paso */}
        <div className="px-6 py-5">
          {renderPasoActual()}
        </div>
      </div>
    </div>
  );
}

export default memo(ModalActualizacion);
