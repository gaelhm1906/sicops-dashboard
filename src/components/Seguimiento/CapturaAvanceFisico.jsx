import React, { useEffect, useMemo, useState } from "react";
import Button from "../Shared/Button";
import LineChartAvance from "./charts/LineChartAvance";
import ModalMotorFisico from "../Modal/ModalMotorFisico";
import DatosContractualesFinancieros from "./DatosContractualesFinancieros";
import { ESTATUS_REGISTRO, esSesionReal } from "../../utils/seguimiento";
import { generarSemanasAutomaticas } from "../../utils/calculoSemanas";
import { getCaratulaContrato, getCaratulaSupervisionDeObra, contratoIdRealDesdeLocal } from "../../utils/caratulaContrato";
import { getQuincenas, agregarQuincena, eliminarQuincena, actualizarQuincena, generarQuincenasAutomaticas, calcularProgramadoPorSemana, hidratarQuincenasDesdeServidor } from "../../utils/programaObra";
import {
  getAvanceFisico,
  guardarAvanceRealSemana,
  semanasConAvanceReal,
  hidratarAvanceFisicoDesdeServidor,
} from "../../utils/avanceFisicoFinanciero";
import { obtenerDatosFinancierosServidor } from "../../api/psDatosFinancierosApi";

const HOY = new Date().toISOString().slice(0, 10);

function formatoMoneda(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—";
}

/* Temporal para la presentación: deja capturar cualquier semana del
   contrato aunque su fecha todavía no llegue, para poder mostrar el
   flujo completo sin esperar al calendario real. En producción vuelve
   a bloquear las semanas futuras — cambiar a `true`. */
const BLOQUEAR_SEMANAS_FUTURAS = false;

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + (Number(dias) - 1));
  return d.toISOString().slice(0, 10);
}

/* Ajuste solicitado (revisión previa a demo): las fechas de la quincena
   ya las da el contrato — no tiene sentido pedirle al usuario que
   además adivine un % acumulado por tramo cuando los inputs de fecha
   nativos ya se ven distinto según el formulario/navegador. Se arma el
   esqueleto completo con un solo llamado y una rampa lineal que cierra
   en 100% en la última quincena (editable después si se tiene el dato
   real de la empresa). */
function generarQuincenasConRampa(trackingKey, caratula) {
  const tramos = generarQuincenasAutomaticas(caratula.fecha_inicio, caratula.dias_naturales);
  let actuales = getQuincenas(trackingKey);
  tramos.forEach((t, i) => {
    const pctAcumulado = Math.round((100 * (i + 1)) / tramos.length);
    actuales = agregarQuincena(trackingKey, { ...t, pctAcumulado });
  });
  return actuales;
}

/* REQ-15 — Informe de avance físico-financiero (avance real). Ajuste de fondo (área técnica,
   11 de agosto): cada obra tiene DOS contratos que dan seguimiento por
   separado — el de obra y el de supervisión externa (5-6% del monto),
   cada uno con su propio programa/curva/calendario — "ambos conviven
   en el mismo informe". Este wrapper resuelve las dos carátulas y deja
   elegir cuál se está capturando; `CuerpoAvanceFisico` (abajo) es el
   cuerpo real de captura, montado una vez por contrato — cambiar de
   pestaña remonta con `key`, así cada contrato arranca de sus propios
   datos guardados en vez de arrastrar los del otro. */
export default function CapturaAvanceFisico({ obra, obraKey, registro, onGuardar, onCancelar, onVerCaratula }) {
  const caratula = useMemo(() => getCaratulaContrato(obraKey), [obraKey]);
  const caratulaSupervision = useMemo(() => getCaratulaSupervisionDeObra(obraKey), [obraKey]);
  const [modoContrato, setModoContrato] = useState("obra");

  const faltaCaratula = !caratula.fecha_inicio || !caratula.dias_naturales;
  if (faltaCaratula) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Falta completar la Carátula del contrato.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            La fecha de inicio y los días naturales se capturan una sola vez ahí — el calendario de cortes y el programa de obra se generan a partir de esos datos.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
        </div>
      </div>
    );
  }

  const haySupervision = !!caratulaSupervision.numero_contrato;
  const contratoActivo = modoContrato === "supervision" ? caratulaSupervision : caratula;
  /* La clave de almacenamiento del contrato de obra sigue siendo la obra
     (como siempre ha sido — cero migración). La del contrato de
     supervisión es el ID del CONTRATO, no de la obra: así, si esa misma
     supervisión atiende varias obras, su avance es un solo dato
     compartido en vez de una copia distinta por cada obra. */
  const trackingKey = modoContrato === "supervision" ? caratulaSupervision.id : obraKey;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 rounded-full w-fit" style={{ backgroundColor: "var(--surface-2)" }}>
        <button
          type="button"
          onClick={() => setModoContrato("obra")}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
          style={modoContrato === "obra" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
        >
          Contrato de obra
        </button>
        <button
          type="button"
          onClick={() => setModoContrato("supervision")}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
          style={modoContrato === "supervision" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
        >
          Contrato de supervisión
        </button>
      </div>

      {modoContrato === "supervision" && !haySupervision ? (
        <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Sin contrato de supervisión vinculado.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Este contrato de obra todavía no tiene un contrato de supervisión externa vinculado — se vincula desde el Registro de Contratos.
          </p>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <CuerpoAvanceFisico
          key={trackingKey}
          obraKey={trackingKey}
          caratula={contratoActivo}
          etiquetaContrato={modoContrato === "supervision" ? "Contrato de supervisión" : "Contrato de obra"}
          registro={registro}
          onGuardar={onGuardar}
          onCancelar={onCancelar}
          onVerCaratula={onVerCaratula}
          obraIdSync={modoContrato === "obra" ? obra?.id : null}
        />
      )}
    </div>
  );
}

/* Cuerpo real de captura — idéntico en forma sea cual sea el contrato,
   solo cambia qué carátula/clave de almacenamiento recibe. El avance
   real es una sola serie (reportada por Supervisión Externa, que
   concilia con la contratista antes de reportar) — ya no hay
   comparación "interna vs. externa", esa era la lógica equivocada que
   se corrigió (ajuste de fondo, área técnica 11 de agosto). */
function CuerpoAvanceFisico({ obraKey, caratula, etiquetaContrato, registro, onGuardar, onCancelar, onVerCaratula, obraIdSync }) {
  /* Datos Contractuales Financieros (deducciones/sanciones/retenciones):
     pedido real del área, 2026-08-21 — que el sistema se los pida a
     Supervisión Externa antes de capturar su programa de obra, no solo
     como parte de la carátula. Solo aplica en modo "Contrato de
     supervisión" — `obraKey` aquí ES el trackingKey (el id local del
     contrato, `srv-<id>` si vino de una hidratación real; ver
     utils/caratulaContrato.js). `datosFinCompleto === null` mientras se
     desconoce (cargando, o no aplica) — se trata como "no bloquea" hasta
     saber lo contrario, nunca bloquea por error/sin conexión. */
  const esModoSupervision = etiquetaContrato === "Contrato de supervisión";
  const contratoIdReal = esModoSupervision ? contratoIdRealDesdeLocal(obraKey) : null;
  const [datosFinCompleto, setDatosFinCompleto] = useState(null);
  const [mostrarDatosFinancieros, setMostrarDatosFinancieros] = useState(false);

  useEffect(() => {
    if (!esSesionReal() || !contratoIdReal) { setDatosFinCompleto(null); return; }
    let cancelado = false;
    obtenerDatosFinancierosServidor(contratoIdReal)
      .then((d) => { if (!cancelado) { setDatosFinCompleto(!!d.completo); setMostrarDatosFinancieros(!d.completo); } })
      .catch(() => { if (!cancelado) setDatosFinCompleto(null); });
    return () => { cancelado = true; };
  }, [contratoIdReal]);

  const bloqueadoPorDatosFinancieros = esModoSupervision && contratoIdReal && datosFinCompleto === false;

  const [estado, setEstado] = useState(() => getAvanceFisico(obraKey));
  /* Se auto-arma al montar (una sola vez): si el contrato ya tiene fecha
     de inicio y días naturales y aún no hay quincenas capturadas, arma
     el esqueleto completo con rampa a 100% de una vez — ver
     generarQuincenasConRampa arriba. */
  const [quincenas, setQuincenas] = useState(() => {
    const existentes = getQuincenas(obraKey);
    if (existentes.length > 0 || !caratula.fecha_inicio || !caratula.dias_naturales) return existentes;
    return generarQuincenasConRampa(obraKey, caratula);
  });

  /* Sesión PS real, capturando bajo "Contrato de obra" (obraIdSync solo
     viene con dato en ese modo — ver arriba): trae ejecución/avance real/
     quincenas ya registrados en el servidor. El modo "Contrato de
     supervisión" sigue siendo solo local por ahora — su clave de
     seguimiento es el id del contrato, no una obra de ps_sicops_final,
     necesita su propio backend keyed por contrato (pendiente, ver
     DISENO_BD_PS_SICOPS_FINAL.md). */
  useEffect(() => {
    if (!obraIdSync) return;
    let cancelado = false;
    Promise.all([
      hidratarAvanceFisicoDesdeServidor(obraKey, obraIdSync),
      hidratarQuincenasDesdeServidor(obraKey, obraIdSync),
    ]).then(() => {
      if (!cancelado) {
        setEstado(getAvanceFisico(obraKey));
        setQuincenas(getQuincenas(obraKey));
      }
    });
    return () => { cancelado = true; };
  }, [obraKey, obraIdSync]);
  const [quincenaNueva, setQuincenaNueva] = useState({ del: "", al: "", pctAcumulado: "" });

  /* Modo pantalla: "captura" es lo que se usa CADA SEMANA (curva + la
     semana en turno + historial reciente) — "config" es lo que se toca
     UNA SOLA VEZ al arrancar el seguimiento (fechas, ejecución real,
     programa quincenal). Si ya hay programa armado se abre directo en
     captura; si aún no hay nada, se abre en config para armarlo. Evita
     que cada visita semanal tenga que volver a ver todo el setup. */
  const [modoPantalla, setModoPantalla] = useState(() => (quincenas.length > 0 ? "captura" : "config"));
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [motorAbierto, setMotorAbierto] = useState(false);

  const faltaCaratula = !caratula.fecha_inicio || !caratula.dias_naturales;
  const fechaTermino = faltaCaratula ? null : sumarDias(caratula.fecha_inicio, caratula.dias_naturales);

  const semanasBase = useMemo(() => {
    if (faltaCaratula) return [];
    return generarSemanasAutomaticas(caratula.fecha_inicio, fechaTermino);
  }, [faltaCaratula, caratula.fecha_inicio, fechaTermino]);

  const semanasConProgramado = useMemo(
    () => calcularProgramadoPorSemana(semanasBase, quincenas),
    [semanasBase, quincenas]
  );

  /* Extensión automática por desfase (minuta 3ª reunión, "Presentación
     de avances", punto 3): si al término del plazo contractual el
     avance real todavía no llega a 100%, se habilita la semana
     siguiente (programado fijo en 100%) para seguir capturando ahí. */
  const semanasExtendidas = useMemo(
    () => semanasConAvanceReal(semanasConProgramado, estado.avanceRealPorSemana),
    [semanasConProgramado, estado.avanceRealPorSemana]
  );

  const semanas = useMemo(() => semanasExtendidas.map((s) => {
    const real = estado.avanceRealPorSemana[s.numero] || {};
    return {
      ...s,
      avanceRealSupervision: real.supervision ?? null,
      iniciada: BLOQUEAR_SEMANAS_FUTURAS ? s.periodoDel <= HOY : true,
    };
  }), [semanasExtendidas, estado.avanceRealPorSemana]);

  const semanasParaGrafica = useMemo(
    () => semanas.map((s) => ({ ...s, avanceReal: s.avanceRealSupervision ?? 0 })),
    [semanas]
  );

  /* La semana que le toca capturar "ahora" — la que contiene HOY. Si por
     algún motivo ninguna coincide (p. ej. hoy cae después del cierre
     contractual y no hubo extensión aún), cae a la última ya iniciada. */
  const semanaActual = useMemo(() => {
    if (semanas.length === 0) return null;
    const enCurso = semanas.find((s) => s.periodoDel <= HOY && HOY <= s.periodoAl);
    if (enCurso) return enCurso;
    const iniciadas = semanas.filter((s) => s.iniciada);
    return iniciadas[iniciadas.length - 1] || semanas[0];
  }, [semanas]);

  /* Historial colapsado por defecto: solo las últimas semanas ya
     iniciadas, para no forzar el scroll por 40+ filas la mayoría de las
     veces que se abre esta pantalla. "Ver historial completo" muestra
     `semanas` completo (incluye futuras, deshabilitadas). */
  const semanasHistorialReciente = useMemo(() => semanas.filter((s) => s.iniciada).slice(-4), [semanas]);

  const agregarQuincenaNueva = () => {
    if (!quincenaNueva.del || !quincenaNueva.al || quincenaNueva.pctAcumulado === "") return;
    setQuincenas(agregarQuincena(obraKey, quincenaNueva));
    setQuincenaNueva({ del: "", al: "", pctAcumulado: "" });
  };

  const quitarQuincena = (id) => setQuincenas(eliminarQuincena(obraKey, id));

  const editarPctQuincena = (id, valor) => setQuincenas(actualizarQuincena(obraKey, id, { pctAcumulado: valor === "" ? "" : Number(valor) }));

  /* Red de seguridad si el usuario borró todas las quincenas — vuelve a
     armar el esqueleto completo (fechas + rampa a 100%) de un click. */
  const generarAutomatico = () => setQuincenas(generarQuincenasConRampa(obraKey, caratula));

  const actualizarAvanceReal = (numero, valor) => {
    setEstado((prev) => ({
      ...prev,
      avanceRealPorSemana: {
        ...prev.avanceRealPorSemana,
        [numero]: { ...prev.avanceRealPorSemana[numero], supervision: valor === "" ? null : Number(valor) },
      },
    }));
  };

  const guardarSemana = (numero) => {
    const valor = semanas.find((s) => s.numero === numero)?.avanceRealSupervision;
    guardarAvanceRealSemana(obraKey, numero, valor ?? 0, "supervision");
  };

  const guardar = () => {
    const semanasConReal = semanas.filter((s) => s.avanceRealSupervision !== null);
    onGuardar({
      estatus: semanasConReal.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: semanasConReal.length > 0
        ? `Curva de avance (${etiquetaContrato}) · ${semanasConReal.length} de ${semanas.length} semana(s) capturadas`
        : registro.evidenciaNombre,
    });
  };

  if (faltaCaratula) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Falta completar la Carátula de este contrato.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            La fecha de inicio y los días naturales se capturan una sola vez ahí — el calendario de cortes y el programa de obra se generan a partir de esos datos.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
        </div>
      </div>
    );
  }

  const semanasTabla = historialAbierto ? semanas : semanasHistorialReciente;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-full w-fit" style={{ backgroundColor: "var(--surface-2)" }}>
          <button
            type="button"
            onClick={() => setModoPantalla("captura")}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
            style={modoPantalla === "captura" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
          >
            📈 Captura semanal
          </button>
          <button
            type="button"
            onClick={() => setModoPantalla("config")}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-150"
            style={modoPantalla === "config" ? { backgroundColor: "var(--guinda)", color: "#fff" } : { color: "var(--ink-faint)" }}
          >
            ℹ️ Información
          </button>
        </div>
      </div>
      <p className="text-[11px] -mt-3" style={{ color: "var(--ink-faint)" }}>
        {etiquetaContrato} · {caratula.fecha_inicio} al {fechaTermino} · {caratula.dias_naturales} días naturales
      </p>

      {modoPantalla === "captura" ? (
        quincenas.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Aún no hay programa de obra configurado.</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              Ve a "Información" para generar el programa quincenal desde el contrato — después podrás capturar el avance de cada semana aquí.
            </p>
            <button
              type="button"
              onClick={() => setModoPantalla("config")}
              className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "var(--guinda)", color: "#fff" }}
            >
              Ir a Información
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: "#374151" }}>Curva de avance semanal</p>
                <button
                  type="button"
                  onClick={() => setMotorAbierto(true)}
                  className="text-[11px] font-bold flex items-center gap-1"
                  style={{ color: "var(--guinda)" }}
                >
                  ℹ️ ¿Cómo funciona?
                </button>
              </div>
              <LineChartAvance semanas={semanasParaGrafica} />
            </div>

            {/* Lo único que hace falta tocar la mayoría de las veces que se
                abre esta pantalla: la semana en turno, grande y sola —
                antes había que encontrarla entre 40+ filas de tabla. */}
            {semanaActual && (
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FAF8F5", border: "2px solid var(--guinda)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--guinda)" }}>Semana en turno</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: "var(--ink)" }}>
                      Semana {semanaActual.numero} · {semanaActual.periodoDel} al {semanaActual.periodoAl}
                      {semanaActual.extendida && <span className="ml-1.5 text-[9px] font-bold uppercase align-middle" style={{ color: "#d97706" }}>ampliada</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Programado</p>
                    <p className="text-lg font-bold" style={{ color: "#d97706" }}>{semanaActual.avanceProgramado}%</p>
                  </div>
                </div>
                <div className="sm:max-w-[220px]">
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "#16a34a" }}>% real</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!semanaActual.iniciada}
                    value={semanaActual.avanceRealSupervision ?? ""}
                    onChange={(e) => actualizarAvanceReal(semanaActual.numero, e.target.value)}
                    onBlur={() => guardarSemana(semanaActual.numero)}
                    placeholder={semanaActual.iniciada ? "Ej. 45" : "aún no inicia"}
                    className="w-full px-3 py-2 text-sm text-right font-bold rounded-lg"
                    style={{ border: "1px solid #D4C4B0", color: "#16a34a" }}
                  />
                </div>
                {!semanaActual.iniciada && (
                  <p className="text-[11px] mt-2" style={{ color: "var(--ink-faint)" }}>Esta semana aún no inicia — se habilita el {semanaActual.periodoDel}.</p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                  {historialAbierto ? `Historial completo (${semanas.length} semanas)` : "Semanas recientes"}
                </p>
                <button type="button" onClick={() => setHistorialAbierto((v) => !v)} className="text-[11px] font-bold" style={{ color: "var(--guinda)" }}>
                  {historialAbierto ? "Ver menos" : `Ver historial completo (${semanas.length})`}
                </button>
              </div>

              {semanas.some((s) => s.extendida) && (
                <p className="text-xs px-3 py-1.5 rounded-lg mb-2" style={{ backgroundColor: "rgba(217,119,6,0.08)", color: "#92400e" }}>
                  ⚠ No se llegó al 100% en el plazo contractual — se habilitaron semanas adicionales (resaltadas) para seguir capturando hasta cerrar en 100%.
                </p>
              )}

              {/* La razón de "aún no inicia" se explica una sola vez aquí
                  arriba de la tabla — no en cada fila deshabilitada, que es
                  donde se presta a confusión. Solo aplica cuando se ve el
                  historial completo (con semanas futuras incluidas). */}
              {historialAbierto && semanas.some((s) => !s.iniciada) && (
                <p className="text-[11px] mb-2" style={{ color: "var(--ink-faint)" }}>
                  Las semanas en gris con "aún no inicia" son futuras — se habilitan solas en cuanto llega su fecha de inicio. No se puede adelantar captura.
                </p>
              )}

              {!historialAbierto && semanasTabla.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: "var(--ink-faint)" }}>Todavía no arranca ninguna semana del contrato.</p>
              )}

              {(historialAbierto || semanasTabla.length > 0) && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "#F8F5F2" }}>
                        <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Sem.</th>
                        <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Periodo</th>
                        <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Prog. (auto)</th>
                        <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanasTabla.map((s) => (
                        <tr key={s.numero} style={{ borderTop: "1px solid #f3f4f6", opacity: s.iniciada ? 1 : 0.5, backgroundColor: s.numero === semanaActual?.numero ? "rgba(105,28,50,0.05)" : s.extendida ? "rgba(217,119,6,0.06)" : undefined }}>
                          <td className="px-2 py-1.5">{s.numero}{s.extendida && <span className="ml-1 text-[9px] font-bold uppercase" style={{ color: "#d97706" }}>ampliada</span>}</td>
                          <td className="px-2 py-1.5" style={{ color: "#6b7280" }}>{s.periodoDel} al {s.periodoAl}</td>
                          <td className="px-2 py-1.5 text-right" style={{ color: "#d97706" }}>{s.avanceProgramado}%</td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              disabled={!s.iniciada}
                              value={s.avanceRealSupervision ?? ""}
                              onChange={(e) => actualizarAvanceReal(s.numero, e.target.value)}
                              onBlur={() => guardarSemana(s.numero)}
                              placeholder={s.iniciada ? "—" : "aún no inicia"}
                              className="w-20 px-1.5 py-1 text-xs text-right rounded"
                              style={{ border: "1px solid #D4C4B0", color: "#16a34a" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      ) : (
        <>
          {/* Modo Información — datos del contrato y el programa quincenal.
              Se toca una sola vez al arrancar el seguimiento, o para
              ajustes puntuales (cambio de quincenas). No es lo que se
              revisa cada semana. */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              {/* La fecha de inicio/término real y el diferimiento ya no se
                  capturan aquí — esos datos viven en la carátula del
                  contrato, que ahora se abre completa con un click desde
                  esta misma tarjeta en vez de duplicar campos. */}
              {onVerCaratula ? (
                <button
                  type="button"
                  onClick={onVerCaratula}
                  className="w-full text-left rounded-xl px-4 py-4 transition-colors duration-150 hover:brightness-95"
                  style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Ejecución (de la Carátula)</p>
                  <p className="text-base font-bold mt-1" style={{ color: "var(--ink)" }}>{caratula.fecha_inicio} al {fechaTermino}</p>
                  <p className="text-xs font-bold mt-1" style={{ color: "var(--guinda)" }}>{caratula.dias_naturales} días naturales</p>
                  <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
                    {caratula.numero_contrato && (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Contrato: <span style={{ color: "var(--ink)" }}>{caratula.numero_contrato}</span></p>
                    )}
                    {caratula.contratista && (
                      <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>Contratista: <span style={{ color: "var(--ink)" }}>{caratula.contratista}</span></p>
                    )}
                    {caratula.importe_total && (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Importe: <span style={{ color: "var(--ink)" }}>{formatoMoneda(caratula.importe_total)}</span></p>
                    )}
                  </div>
                  <p className="text-[11px] font-bold mt-3" style={{ color: "var(--guinda)" }}>Ver contrato completo →</p>
                </button>
              ) : (
                <div className="rounded-xl px-4 py-4" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--oro)" }}>Ejecución (de la Carátula)</p>
                  <p className="text-base font-bold mt-1" style={{ color: "var(--ink)" }}>{caratula.fecha_inicio} al {fechaTermino}</p>
                  <p className="text-xs font-bold mt-1" style={{ color: "var(--guinda)" }}>{caratula.dias_naturales} días naturales</p>
                  <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
                    {caratula.numero_contrato && (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Contrato: <span style={{ color: "var(--ink)" }}>{caratula.numero_contrato}</span></p>
                    )}
                    {caratula.contratista && (
                      <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>Contratista: <span style={{ color: "var(--ink)" }}>{caratula.contratista}</span></p>
                    )}
                    {caratula.importe_total && (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Importe: <span style={{ color: "var(--ink)" }}>{formatoMoneda(caratula.importe_total)}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-8">
              {esModoSupervision && contratoIdReal && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>
                      Datos Contractuales Financieros {datosFinCompleto ? "✓" : ""}
                    </p>
                    {datosFinCompleto && (
                      <button
                        type="button"
                        onClick={() => setMostrarDatosFinancieros((v) => !v)}
                        className="text-[11px] font-bold shrink-0"
                        style={{ color: "var(--guinda)" }}
                      >
                        {mostrarDatosFinancieros ? "Ocultar" : "Editar"}
                      </button>
                    )}
                  </div>
                  {bloqueadoPorDatosFinancieros && (
                    <p className="text-xs mb-2" style={{ color: "var(--naranja, #B5680A)" }}>
                      Antes de armar tu programa de obra, completa las deducciones, sanciones y retenciones de tu contrato.
                    </p>
                  )}
                  {mostrarDatosFinancieros && (
                    <DatosContractualesFinancieros
                      contratoId={contratoIdReal}
                      onCompletado={() => { setDatosFinCompleto(true); setMostrarDatosFinancieros(false); }}
                    />
                  )}
                </div>
              )}

              {!bloqueadoPorDatosFinancieros && (
              <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Programa de obra (quincenal)</p>
                {quincenas.length === 0 && (
                  <button
                    type="button"
                    onClick={generarAutomatico}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px dashed var(--guinda)" }}
                  >
                    ⚡ Generar automático (rampa a 100%)
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {quincenas.length === 0 && (
                  <p className="text-xs text-center py-3 col-span-full" style={{ color: "var(--ink-faint)" }}>
                    Aún no hay quincenas — usa "Generar automático" para armar los tramos desde el contrato, o agrégalas manualmente abajo.
                  </p>
                )}
                {quincenas.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
                    <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{q.del} al {q.al}</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="% acum."
                      value={q.pctAcumulado}
                      onChange={(e) => editarPctQuincena(q.id, e.target.value)}
                      className="w-20 px-2 py-1 text-sm text-right font-bold rounded-lg shrink-0"
                      style={{ border: "1px solid var(--border)", color: "var(--guinda)" }}
                    />
                    <button type="button" onClick={() => quitarQuincena(q.id)} className="p-1 shrink-0" style={{ color: "var(--rojo)" }} aria-label="Quitar quincena">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="w-32">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Del</label>
                  <input type="date" value={quincenaNueva.del} onChange={(e) => setQuincenaNueva((q) => ({ ...q, del: e.target.value }))} className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                </div>
                <div className="w-32">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>Al</label>
                  <input type="date" value={quincenaNueva.al} onChange={(e) => setQuincenaNueva((q) => ({ ...q, al: e.target.value }))} className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8C6B41" }}>% acum.</label>
                  <input type="number" step="0.01" placeholder="Ej. 30" value={quincenaNueva.pctAcumulado} onChange={(e) => setQuincenaNueva((q) => ({ ...q, pctAcumulado: e.target.value }))} className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                </div>
                <button type="button" onClick={agregarQuincenaNueva} className="px-3 py-2 rounded-lg text-xs font-bold text-white shrink-0" style={{ backgroundColor: "var(--guinda)" }}>+ Agregar</button>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-faint)" }}>
                Las fechas se arman solas desde el contrato con un % programado en rampa hasta 100% — edita el "% acum." de cada quincena si ya tienes el dato real de la empresa.
              </p>
              </>
              )}
            </div>
          </div>

          {quincenas.length > 0 && !bloqueadoPorDatosFinancieros && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModoPantalla("captura")}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "var(--guinda)", color: "#fff" }}
              >
                ✓ Listo — ir a Captura semanal
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>

      <ModalMotorFisico open={motorAbierto} onClose={() => setMotorAbierto(false)} />
    </div>
  );
}
