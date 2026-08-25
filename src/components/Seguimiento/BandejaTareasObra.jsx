import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getRequerimientosPorRol, getVisitaObligadaPorRol } from "../../data/seguimientoCatalogo";
import {
  getObraKey,
  getRegistrosObra,
  actualizarRegistro,
  getVisitasHoy,
  registrarVisita,
  hidratarCapturaDesdeServidor,
} from "../../utils/seguimiento";
import { hidratarCaratulaDesdeServidor } from "../../utils/caratulaContrato";
import { getEstadoObra } from "../../utils/obraEstado";
import VisitaCheckIn from "./VisitaCheckIn";
import RegistrarTareaWizardContenido from "./RegistrarTareaWizardContenido";
import MenuAcciones from "../Shared/MenuAcciones";
import ConfirmModal from "../ui/ConfirmModal";

/**
 * Modal de una sola acción — nunca un menú intermedio. `modoInicial`
 * decide de una vez si esto es un reporte de avance o un check-in de
 * visita; el botón que abre esta ventana ya tomó esa decisión.
 */
export default function BandejaTareasObra({ obra, modoInicial = "avance", onClose, rolOverride, sistemaCerrado, updateObraInline, onAbrirCaratula, onAbrirInforme }) {
  const { user } = useAuth();
  const obraKey = useMemo(() => getObraKey(obra), [obra]);
  const rol = rolOverride || user?.rol || "ACTUALIZACION";

  const [version, setVersion] = useState(0);

  /* REQ-15/REQ-16 (Informe del avance físico/financiero) traen tabla
     semanal + gráfica + varios formularios — el cajón angosto genérico
     (max-w-md) las deja amontonadas. Se ensancha solo para esas dos. */
  const [tareaActivaId, setTareaActivaId] = useState(null);
  const REQS_ANCHO_AMPLIO = ["REQ-15", "REQ-16"];
  const anchoAmplio = REQS_ANCHO_AMPLIO.includes(tareaActivaId);

  /* ── Ciclo de vida de la obra (inaugurar/cancelar/repetir corte) —
     independiente del indicador de seguimiento; requiere backend real ── */
  const [updatingObra, setUpdatingObra] = useState(false);
  const [modalInaugurar, setModalInaugurar] = useState(false);
  const [fechaInauguracion, setFechaInauguracion] = useState("");
  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  const requerimientosRol = useMemo(() => getRequerimientosPorRol(rol), [rol]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer localStorage tras cada guardado
  const registros = useMemo(() => getRegistrosObra(obraKey, rol), [obraKey, rol, version]);

  /* Sesión PS real (obra ya en ps_sicops_final, con `obra.id` numérico):
     al abrir el panel se trae el estado real de captura del servidor y se
     escribe como overrides locales, para no perder lo que otro dispositivo
     u otra sesión ya haya guardado — no hace nada para el resto de
     sesiones (ver esSesionReal() dentro de hidratarCapturaDesdeServidor). */
  useEffect(() => {
    let cancelado = false;
    Promise.all([
      hidratarCapturaDesdeServidor(obraKey, obra?.id),
      hidratarCaratulaDesdeServidor(obraKey, obra?.id),
    ]).then(() => {
      if (!cancelado) setVersion((v) => v + 1);
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir el panel para esta obra
  }, [obraKey, obra?.id]);

  const registrosPorId = useMemo(() => {
    const map = {};
    for (const r of registros) map[r.reqId] = r;
    return map;
  }, [registros]);

  const visitaObligada = useMemo(() => getVisitaObligadaPorRol(rol), [rol]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visitasHoy = useMemo(() => getVisitasHoy(obraKey, rol), [obraKey, rol, version]);

  const guardarRegistro = useCallback((reqId, cambios) => {
    actualizarRegistro(obraKey, reqId, { ...cambios, actualizadoPor: user?.email || "sistema" }, obra?.id);
    setVersion((v) => v + 1);
  }, [obraKey, user?.email, obra?.id]);

  const handleRegistrarVisita = useCallback((datos) => {
    registrarVisita(obraKey, rol, user?.email, datos);
    setVersion((v) => v + 1);
  }, [obraKey, rol, user?.email]);

  const avanceActual = obra?.avance_real ?? obra?.avance ?? obra?.porcentaje ?? 0;
  const estadoObra = obra ? getEstadoObra(obra) : "editable";
  const isInaugurada = estadoObra === "inaugurada";
  const isTerminada = estadoObra === "terminada";
  const yaCancelada = estadoObra === "cancelada";
  const bloqueado = sistemaCerrado || !!obra?.BLOQUEADO;

  const handleRepetir = useCallback(async () => {
    if (!updateObraInline) return;
    setUpdatingObra(true);
    await updateObraInline(obra, avanceActual, { permitirRepetido: true });
    setUpdatingObra(false);
  }, [updateObraInline, obra, avanceActual]);

  const abrirModalInaugurar = useCallback(() => {
    setFechaInauguracion("");
    setModalInaugurar(true);
  }, []);

  const confirmarInaugurada = useCallback(async () => {
    if (!fechaInauguracion || !updateObraInline) return;
    setUpdatingObra(true);
    await updateObraInline(obra, 100, { marcar_entregada: true, fecha_inauguracion: fechaInauguracion });
    setUpdatingObra(false);
    setModalInaugurar(false);
  }, [fechaInauguracion, updateObraInline, obra]);

  const abrirModalCancelar = useCallback(() => {
    setMotivoCancelacion("");
    setModalCancelar(true);
  }, []);

  const confirmarCancelada = useCallback(async () => {
    if (!motivoCancelacion.trim() || !updateObraInline) return;
    setUpdatingObra(true);
    await updateObraInline(obra, avanceActual, { marcar_cancelada: true, motivo_cancelacion: motivoCancelacion.trim() });
    setUpdatingObra(false);
    setModalCancelar(false);
  }, [motivoCancelacion, updateObraInline, obra, avanceActual]);

  const accionesMenu = [];
  if (onAbrirCaratula) {
    accionesMenu.push({ label: "📄 Carátula del contrato", onClick: () => onAbrirCaratula(obra) });
  }
  if (onAbrirInforme) {
    accionesMenu.push({ label: "📊 Informe de Supervisión Externa", onClick: () => onAbrirInforme(obra) });
  }
  if (updateObraInline && !yaCancelada && !bloqueado) {
    if (isTerminada) {
      accionesMenu.push({ label: "Marcar inaugurada", onClick: abrirModalInaugurar });
    } else if (!isInaugurada) {
      accionesMenu.push({ label: "Repetir porcentaje", onClick: handleRepetir });
      accionesMenu.push({ label: "Marcar inaugurada", onClick: abrirModalInaugurar });
      accionesMenu.push({ label: "Cancelar obra", onClick: abrirModalCancelar, danger: true });
    }
  }

  if (!obra) return null;

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${modoInicial === "visita" ? "Registrar visita" : "Reportar avance"} — ${obra.nombre_obra || obra.nombre}`}
      onClick={onClose}
    >
      <div
        className={`bg-white shadow-2xl w-full overflow-hidden flex flex-col animate-panel-in ${modoInicial === "visita" ? "max-w-2xl" : anchoAmplio ? "max-w-5xl" : "max-w-md"}`}
        style={{ height: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ backgroundColor: "#691C32" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full overflow-hidden shrink-0"
              style={{ border: "2px solid rgba(255,255,255,0.7)", backgroundColor: "#fff" }}
            >
              <img src="/web/assets/img/saludo.png" alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{obra.nombre_obra || obra.nombre}</p>
              <p className="text-white/70 text-xs mt-0.5">{modoInicial === "visita" ? "Registrar visita" : "Reportar avance"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <MenuAcciones items={accionesMenu} light />
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="px-6 py-5 overflow-y-auto">
          {modoInicial === "visita" ? (
            <VisitaCheckIn
              visitaObligada={visitaObligada}
              visitasHoy={visitasHoy}
              onRegistrar={handleRegistrarVisita}
              obraKey={obraKey}
              rol={rol}
              nombreFuncionario={user?.nombre || user?.email}
            />
          ) : (
            <RegistrarTareaWizardContenido
              obra={obra}
              obraKey={obraKey}
              requerimientosRol={requerimientosRol}
              registrosPorId={registrosPorId}
              tareaInicial={null}
              onGuardar={guardarRegistro}
              onSalir={onClose}
              rol={rol}
              onTareaActiva={setTareaActivaId}
              onAbrirCaratula={onAbrirCaratula}
            />
          )}
        </div>
      </div>
    </div>

    <ConfirmModal
      open={modalInaugurar}
      title="Marcar obra como inaugurada"
      subtitle={obra.nombre_obra || obra.nombre}
      onConfirm={confirmarInaugurada}
      onCancel={() => setModalInaugurar(false)}
      confirmText="Sí, marcar inaugurada"
      confirmDisabled={!fechaInauguracion}
      loading={updatingObra}
      variant="info"
    >
      <p className="text-sm mb-4" style={{ color: "#4b5563" }}>
        Selecciona la fecha real de inauguración. Esta acción es definitiva.
      </p>
      <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
        Fecha de inauguración
      </label>
      <input
        type="date"
        value={fechaInauguracion}
        max={new Date().toISOString().split("T")[0]}
        onChange={(e) => setFechaInauguracion(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2"
        style={{ border: "1px solid #d1d5db" }}
      />
    </ConfirmModal>

    <ConfirmModal
      open={modalCancelar}
      title="Cancelar obra"
      subtitle={obra.nombre_obra || obra.nombre}
      onConfirm={confirmarCancelada}
      onCancel={() => setModalCancelar(false)}
      confirmText="Sí, cancelar obra"
      confirmDisabled={!motivoCancelacion.trim()}
      loading={updatingObra}
      variant="danger"
    >
      <p className="text-sm mb-4" style={{ color: "#4b5563" }}>
        Esta acción marcará la obra como cancelada. El registro se conserva en base de datos.
      </p>
      <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
        Motivo de cancelación <span style={{ color: "#dc2626" }}>*</span>
      </label>
      <textarea
        value={motivoCancelacion}
        onChange={(e) => setMotivoCancelacion(e.target.value)}
        placeholder="Describe el motivo de cancelación..."
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2"
        style={{ border: "1px solid #d1d5db" }}
      />
    </ConfirmModal>
    </>
  );
}
