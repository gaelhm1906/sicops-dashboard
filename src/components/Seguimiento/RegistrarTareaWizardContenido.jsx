import React, { useEffect, useMemo, useState } from "react";
import Stepper from "../Shared/Stepper";
import { getCapturaComponent } from "./capturaDispatch";
import PasoElegirTarea from "./wizard/PasoElegirTarea";
import PasoPrevisualizacion from "./wizard/PasoPrevisualizacion";
import PasoExito from "./wizard/PasoExito";

/**
 * El asistente en sí (stepper + pasos), sin el "chrome" de modal — para
 * poder incrustarlo dentro de una pantalla que ya es un modal (la Bandeja
 * de la obra) sin abrir una segunda ventana encima de la primera.
 * `RegistrarTareaWizard.jsx` envuelve esto en su propio modal cuando no
 * hay una pantalla anfitriona (p. ej. desde la vista previa del Home).
 */
export default function RegistrarTareaWizardContenido({ obra, obraKey, requerimientosRol, registrosPorId, tareaInicial, onGuardar, onSalir, onIrSiguiente, rol, onTareaActiva, onAbrirCaratula }) {
  const [tareaElegida, setTareaElegida] = useState(tareaInicial || null);
  const [borrador, setBorrador] = useState(null);
  const [semaforo, setSemaforo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [fase, setFase] = useState(tareaInicial ? "captura" : "elegir");

  /* Le avisa a quien nos contiene (BandejaTareasObra) qué tarea quedó
     activa, para que pueda ensanchar su propio contenedor cuando la
     tarea lo necesite (Informe del avance físico/financiero traen tabla
     + gráfica, no caben cómodas en el cajón angosto genérico). */
  useEffect(() => {
    onTareaActiva?.(tareaElegida?.id ?? null);
  }, [tareaElegida, onTareaActiva]);

  const CapturaComponent = tareaElegida ? getCapturaComponent(tareaElegida) : null;
  const registroActual = tareaElegida ? registrosPorId[tareaElegida.id] : null;

  const steps = tareaInicial
    ? ["Captura", "Revisión", "Confirmación"]
    : ["Elegir tarea", "Captura", "Revisión", "Confirmación"];
  const offset = tareaInicial ? 0 : 1;
  const stepIndex = { elegir: 0, captura: offset, revision: offset + 1, exito: offset + 2 }[fase];

  const hayMasTareas = useMemo(() => {
    if (onIrSiguiente) return true;
    if (tareaInicial) return false;
    return requerimientosRol.some((r) => {
      const reg = registrosPorId[r.id];
      return reg && reg.estatus !== "no_aplica" && reg.id !== tareaElegida?.id;
    });
  }, [onIrSiguiente, tareaInicial, requerimientosRol, registrosPorId, tareaElegida]);

  const elegirTarea = (req) => {
    setTareaElegida(req);
    setFase("captura");
  };

  const handleGuardarCaptura = (cambios) => {
    setBorrador(cambios);
    setSemaforo(null);
    setFase("revision");
  };

  const handleConfirmar = async () => {
    setGuardando(true);
    await onGuardar(tareaElegida.id, { ...borrador, semaforo });
    setGuardando(false);
    setFase("exito");
  };

  const handleRegistrarOtra = () => {
    if (onIrSiguiente) { onIrSiguiente(); return; }
    if (tareaInicial) { onSalir(); return; }
    setTareaElegida(null);
    setBorrador(null);
    setSemaforo(null);
    setFase("elegir");
  };

  return (
    <div>
      <div className="mb-4">
        <Stepper steps={steps} current={stepIndex} />
      </div>

      {fase === "elegir" && (
        <PasoElegirTarea
          requerimientos={requerimientosRol}
          registrosPorId={registrosPorId}
          onElegir={elegirTarea}
        />
      )}

      {fase === "captura" && CapturaComponent && (
        <CapturaComponent
          obra={obra}
          obraKey={obraKey}
          registro={registroActual}
          onGuardar={handleGuardarCaptura}
          onCancelar={tareaInicial ? onSalir : () => setFase("elegir")}
          rol={rol}
          onVerCaratula={onAbrirCaratula ? () => onAbrirCaratula(obra) : undefined}
        />
      )}

      {fase === "revision" && (
        <PasoPrevisualizacion
          obra={obra}
          requerimiento={tareaElegida}
          cambios={borrador}
          guardando={guardando}
          semaforo={semaforo}
          onCambiarSemaforo={setSemaforo}
          onCorregir={() => setFase("captura")}
          onConfirmar={handleConfirmar}
        />
      )}

      {fase === "exito" && (
        <PasoExito
          requerimiento={tareaElegida}
          onRegistrarOtra={handleRegistrarOtra}
          onCerrar={onSalir}
          hayMasTareas={hayMasTareas}
          labelRegistrarOtra={onIrSiguiente ? "Siguiente actividad →" : "Registrar otra tarea"}
        />
      )}
    </div>
  );
}
