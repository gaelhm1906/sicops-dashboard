import React, { useEffect, useMemo, useState } from "react";
import Button from "../Shared/Button";
import LineChartFinanciero from "./charts/LineChartFinanciero";
import ModalMotorFinanciero from "../Modal/ModalMotorFinanciero";
import { ESTATUS_REGISTRO } from "../../utils/seguimiento";
import { getCaratulaContrato, getCaratulaSupervisionDeObra } from "../../utils/caratulaContrato";
import {
  getAvanceFinanciero,
  construirSemanasFisico,
  calcularEstimacionesFinanciero,
  avanceFinancieroPorSemana,
  saldoPendientePorEstimar,
  agregarEstimacion,
  eliminarEstimacion,
  hidratarAvanceFinancieroDesdeServidor,
} from "../../utils/avanceFisicoFinanciero";

function formatoMoneda(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—";
}

/* Objetivos de % financiero ACUMULADO para el autollenado de ejemplo —
   `semana: null` significa "última semana del contrato" (cierra en
   100%, sea cual sea la duración real). Los montos se calculan al
   vuelo a partir del importe del contrato, así que sirve para
   cualquier obra/contrato, no solo el de la demo. */
const ESTIMACION_OBJETIVOS_EJEMPLO = [
  { semana: 4, pctAcumulado: 10 },
  { semana: 22, pctAcumulado: 35 },
  { semana: 35, pctAcumulado: 65 },
  { semana: null, pctAcumulado: 100 },
];

/* REQ-16 — Informe de avance físico-financiero (estimaciones). Ajuste de fondo (área
   técnica, 11 de agosto): igual que el avance físico, cada obra tiene
   DOS contratos con avance presupuestal propio — el de obra y el de
   supervisión externa, cada uno con sus propias estimaciones y su
   propio % ejercido — "ambos conviven en el mismo informe". Este
   wrapper resuelve las dos carátulas y deja elegir cuál se está
   capturando; `CuerpoAvanceFinanciero` es el cuerpo real, montado una
   vez por contrato (la `key` lo remonta limpio al cambiar de pestaña). */
export default function CapturaAvanceFinanciero({ obra, obraKey, registro, onGuardar, onCancelar }) {
  const caratula = useMemo(() => getCaratulaContrato(obraKey), [obraKey]);
  const caratulaSupervision = useMemo(() => getCaratulaSupervisionDeObra(obraKey), [obraKey]);
  const [modoContrato, setModoContrato] = useState("obra");

  const faltaCaratula = !caratula.fecha_inicio || !caratula.dias_naturales || !caratula.importe_total;
  if (faltaCaratula) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Falta completar la Carátula del contrato.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Importe total, fecha de inicio y días naturales se capturan ahí una sola vez — este módulo los usa para calcular el IVA y el % ejercido del contrato automáticamente.
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
  /* Misma regla que en avance físico: el contrato de obra usa la clave
     de la obra (como siempre), el de supervisión usa el ID del propio
     contrato — si una supervisión atiende varias obras, su avance
     presupuestal es un solo dato compartido, no una copia por obra. */
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
        <CuerpoAvanceFinanciero
          key={trackingKey}
          obraKey={trackingKey}
          caratula={contratoActivo}
          etiquetaContrato={modoContrato === "supervision" ? "Contrato de supervisión" : "Contrato de obra"}
          registro={registro}
          onGuardar={onGuardar}
          onCancelar={onCancelar}
          obraIdSync={modoContrato === "obra" ? obra?.id : null}
        />
      )}
    </div>
  );
}

function CuerpoAvanceFinanciero({ obraKey, caratula, etiquetaContrato, registro, onGuardar, onCancelar, obraIdSync }) {
  const [estado, setEstado] = useState(() => getAvanceFinanciero(obraKey));

  // Sesión PS real, capturando bajo "Contrato de obra" (ver nota en
  // CapturaAvanceFisico.jsx — "Contrato de supervisión" sigue local).
  useEffect(() => {
    if (!obraIdSync) return;
    let cancelado = false;
    hidratarAvanceFinancieroDesdeServidor(obraKey, obraIdSync).then(() => {
      if (!cancelado) setEstado(getAvanceFinanciero(obraKey));
    });
    return () => { cancelado = true; };
  }, [obraKey, obraIdSync]);
  const [nuevaFila, setNuevaFila] = useState({ identificador: "", periodoDel: "", periodoAl: "", fechaEntrega: "", montoSinIva: "", deduccionesTotales: "" });
  /* La tabla de estimaciones y la de avance financiero semanal (derivada,
     solo lectura) pueden crecer a decenas de filas en contratos largos —
     colapsadas por defecto para que lo primero que se vea sea el resumen
     + la curva + el formulario para agregar la siguiente estimación, que
     es la acción que de verdad se repite. */
  const [historialEstimacionesAbierto, setHistorialEstimacionesAbierto] = useState(false);
  const [semanalAbierto, setSemanalAbierto] = useState(false);
  const [motorAbierto, setMotorAbierto] = useState(false);

  const faltaCaratula = !caratula.fecha_inicio || !caratula.dias_naturales || !caratula.importe_total;

  const semanasFisico = useMemo(() => {
    if (faltaCaratula) return [];
    return construirSemanasFisico(obraKey, caratula);
  }, [faltaCaratula, caratula, obraKey]);

  const estimacionesCalculadas = useMemo(
    () => calcularEstimacionesFinanciero(estado.estimaciones, caratula, semanasFisico),
    [estado.estimaciones, caratula, semanasFisico]
  );

  const semanasFinanciero = useMemo(
    () => avanceFinancieroPorSemana(semanasFisico, estimacionesCalculadas),
    [semanasFisico, estimacionesCalculadas]
  );

  const ultima = estimacionesCalculadas[estimacionesCalculadas.length - 1];
  const porcentajeEjercido = ultima ? ultima.porcentajeAcumulado : 0;
  const saldo = useMemo(
    () => saldoPendientePorEstimar(estimacionesCalculadas, caratula),
    [estimacionesCalculadas, caratula]
  );

  const agregarFila = () => {
    if (!nuevaFila.periodoDel || !nuevaFila.periodoAl || !nuevaFila.fechaEntrega || !nuevaFila.montoSinIva) return;
    const next = agregarEstimacion(obraKey, nuevaFila);
    setEstado(next);
    setNuevaFila({ identificador: "", periodoDel: "", periodoAl: "", fechaEntrega: "", montoSinIva: "", deduccionesTotales: "" });
  };

  const quitarFila = (id) => setEstado(eliminarEstimacion(obraKey, id));

  /* Autollenado de ejemplo, un click a la vez (para ir explicando la
     curva conforme se arma, no de golpe): cada click agrega la
     SIGUIENTE estimación de la secuencia 10%/35%/65%/100% (semanas 4,
     22, 35 y la última), a partir de lo que ya esté acumulado. Con las
     4 ya agregadas, el siguiente click reinicia el ejemplo. */
  const siguienteEjemplo = ESTIMACION_OBJETIVOS_EJEMPLO[estado.estimaciones.length] || null;

  const agregarSiguienteEjemplo = () => {
    if (semanasFisico.length === 0) return;

    if (!siguienteEjemplo) {
      for (const e of estado.estimaciones) eliminarEstimacion(obraKey, e.id);
      setEstado(getAvanceFinanciero(obraKey));
      return;
    }

    const importeTotal = Number(caratula.importe_total) || 0;
    const ultimaSemana = semanasFisico[semanasFisico.length - 1].numero;
    const numeroSemana = siguienteEjemplo.semana ?? ultimaSemana;
    const semanaObj = semanasFisico.find((s) => s.numero === numeroSemana) || semanasFisico[semanasFisico.length - 1];

    const ultimaFila = estado.estimaciones[estado.estimaciones.length - 1];
    const acumuladoAnterior = estimacionesCalculadas.length > 0
      ? estimacionesCalculadas[estimacionesCalculadas.length - 1].acumuladoConIva
      : 0;
    let periodoDel = caratula.fecha_inicio;
    if (ultimaFila) {
      const d = new Date(`${ultimaFila.periodoAl}T00:00:00`);
      d.setDate(d.getDate() + 1);
      periodoDel = d.toISOString().slice(0, 10);
    }

    const montoConIvaAcumulado = Math.round(importeTotal * (siguienteEjemplo.pctAcumulado / 100) * 100) / 100;
    const montoConIvaFila = Math.round((montoConIvaAcumulado - acumuladoAnterior) * 100) / 100;
    const montoSinIva = Math.round((montoConIvaFila / 1.16) * 100) / 100;

    /* La última del objetivo (100% acumulado) es la de finiquito — se
       etiqueta con el sufijo "F" que usa la carátula oficial en papel
       (ej. "04F"), igual que se acordó para el identificador manual. */
    const numeroEstimacion = estado.estimaciones.length + 1;
    const esFiniquito = siguienteEjemplo.semana == null;
    const identificador = esFiniquito
      ? `${String(numeroEstimacion).padStart(2, "0")}F`
      : `EST ${String(numeroEstimacion).padStart(2, "0")}`;

    const next = agregarEstimacion(obraKey, {
      identificador,
      periodoDel,
      periodoAl: semanaObj.periodoAl,
      fechaEntrega: semanaObj.periodoAl,
      montoSinIva,
      deduccionesTotales: Math.round(montoConIvaFila * 0.02 * 100) / 100,
    });
    setEstado(next);
  };

  const guardar = () => {
    onGuardar({
      estatus: estado.estimaciones.length > 0 ? ESTATUS_REGISTRO.CUMPLIDO : ESTATUS_REGISTRO.PENDIENTE,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: estado.estimaciones.length > 0
        ? `${estado.estimaciones.length} estimación(es) (${etiquetaContrato}) · ${porcentajeEjercido.toFixed(1)}% ejercido`
        : registro.evidenciaNombre,
    });
  };

  if (faltaCaratula) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Falta completar la Carátula de este contrato.</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Importe total, fecha de inicio y días naturales se capturan ahí una sola vez — este módulo los usa para calcular el IVA y el % ejercido del contrato automáticamente.
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{etiquetaContrato}</p>

      {/* Fila superior: resumen (angosto) + curva (ancho) lado a lado —
          antes iban apilados, ahora aprovechan el cajón ensanchado. */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <div className="rounded-xl px-4 py-3 h-full" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--oro)" }}>% ejercido del contrato</span>
              <span className="text-sm font-bold" style={{ color: "var(--guinda)" }}>{porcentajeEjercido.toFixed(1)}%</span>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "var(--border-soft)" }}>
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, porcentajeEjercido)}%`, backgroundColor: "var(--guinda)" }} />
            </div>
            <div className="space-y-1 mt-2.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
              <div className="flex items-center justify-between"><span>Contrato</span><span>{formatoMoneda(saldo.importeTotal)}</span></div>
              <div className="flex items-center justify-between"><span>Estimado</span><span>{formatoMoneda(saldo.acumulado)}</span></div>
              <div className="flex items-center justify-between font-semibold" style={{ color: "var(--naranja)" }}><span>Pendiente</span><span>{formatoMoneda(saldo.pendiente)}</span></div>
            </div>
          </div>
        </div>

        <div className="md:col-span-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: "#374151" }}>Curva de avance financiero</p>
            <button
              type="button"
              onClick={() => setMotorAbierto(true)}
              className="text-[11px] font-bold flex items-center gap-1"
              style={{ color: "var(--guinda)" }}
            >
              ℹ️ ¿Cómo funciona?
            </button>
          </div>
          <LineChartFinanciero semanas={semanasFinanciero} />
        </div>
      </div>

      {estimacionesCalculadas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: "#374151" }}>
              {historialEstimacionesAbierto ? `Estimaciones capturadas (${estimacionesCalculadas.length})` : "Últimas estimaciones"}
            </p>
            {estimacionesCalculadas.length > 3 && (
              <button type="button" onClick={() => setHistorialEstimacionesAbierto((v) => !v)} className="text-[11px] font-bold" style={{ color: "var(--guinda)" }}>
                {historialEstimacionesAbierto ? "Ver menos" : `Ver todas (${estimacionesCalculadas.length})`}
              </button>
            )}
          </div>
          <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid #e5e7eb" }}>
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr style={{ backgroundColor: "#F8F5F2" }}>
                  <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>No.</th>
                  <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Identificador</th>
                  <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Periodo</th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Sin IVA</th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Con IVA</th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Deducciones</th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Líquido</th>
                  <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>% Acum.</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {(historialEstimacionesAbierto ? estimacionesCalculadas : estimacionesCalculadas.slice(-3)).map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td className="px-2 py-1.5">{e.noEstimacion}</td>
                    <td className="px-2 py-1.5 font-semibold" style={{ color: "var(--guinda)" }}>{e.identificador || "—"}</td>
                    <td className="px-2 py-1.5" style={{ color: "#6b7280" }}>{e.periodoDel} al {e.periodoAl}</td>
                    <td className="px-2 py-1.5 text-right">{formatoMoneda(e.montoSinIva)}</td>
                    <td className="px-2 py-1.5 text-right">{formatoMoneda(e.montoConIva)}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: e.deduccionesTotales > 0 ? "var(--naranja)" : undefined }}>{e.deduccionesTotales > 0 ? `-${formatoMoneda(e.deduccionesTotales)}` : "—"}</td>
                    <td className="px-2 py-1.5 text-right font-semibold" style={{ color: "#2563eb" }}>{formatoMoneda(e.liquido)}</td>
                    <td className="px-2 py-1.5 text-right">{e.porcentajeAcumulado.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" onClick={() => quitarFila(e.id)} style={{ color: "#b91c1c" }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl p-3" style={{ backgroundColor: "#FAF8F5", border: "1px solid #D4C4B0" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C6B41" }}>Agregar estimación</p>
          <button
            type="button"
            onClick={agregarSiguienteEjemplo}
            title={siguienteEjemplo
              ? `Agregar estimación de ejemplo ${estado.estimaciones.length + 1} de 4 (cierra en ${siguienteEjemplo.pctAcumulado}%)`
              : "Reiniciar ejemplo"}
            aria-label="Generar estimaciones de ejemplo, una por click"
            className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg shrink-0"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px dashed var(--guinda)" }}
          >
            ⚡ {siguienteEjemplo && <span className="text-[10px] font-bold">{estado.estimaciones.length + 1}/4</span>}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Identificador <span style={{ color: "var(--ink-faint)" }}>(opcional)</span></label>
            <input type="text" placeholder="EST 01, 04F..." value={nuevaFila.identificador} onChange={(e) => setNuevaFila((d) => ({ ...d, identificador: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Periodo del</label>
            <input type="date" value={nuevaFila.periodoDel} onChange={(e) => setNuevaFila((d) => ({ ...d, periodoDel: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Periodo al</label>
            <input type="date" value={nuevaFila.periodoAl} onChange={(e) => setNuevaFila((d) => ({ ...d, periodoAl: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Fecha de entrega</label>
            <input type="date" value={nuevaFila.fechaEntrega} onChange={(e) => setNuevaFila((d) => ({ ...d, fechaEntrega: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Monto sin IVA</label>
            <input type="number" step="0.01" placeholder="$ 0.00" value={nuevaFila.montoSinIva} onChange={(e) => setNuevaFila((d) => ({ ...d, montoSinIva: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#8C6B41" }}>Deducciones totales</label>
            <input type="number" step="0.01" placeholder="$ 0.00 (según carátula de la estimación)" value={nuevaFila.deduccionesTotales} onChange={(e) => setNuevaFila((d) => ({ ...d, deduccionesTotales: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs rounded-lg" style={{ border: "1px solid #D4C4B0" }} />
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <Button size="sm" variant="secondary" onClick={agregarFila}>+ Agregar estimación</Button>
        </div>
      </div>

      {semanasFinanciero.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setSemanalAbierto((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold mb-2"
            style={{ color: "#374151" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: semanalAbierto ? "rotate(90deg)" : "none", transition: "transform 150ms" }}><path d="M9 6l6 6-6 6" /></svg>
            Ver detalle semana a semana ({semanasFinanciero.length} semanas)
          </button>
          {semanalAbierto && (
            <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid #e5e7eb" }}>
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr style={{ backgroundColor: "#F8F5F2" }}>
                    <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Sem.</th>
                    <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Periodo</th>
                    <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>% financiero acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {semanasFinanciero.map((s) => (
                    <tr key={s.numero} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td className="px-2 py-1.5">{s.numero}</td>
                      <td className="px-2 py-1.5" style={{ color: "#6b7280" }}>{s.periodoDel} al {s.periodoAl}</td>
                      <td className="px-2 py-1.5 text-right">{s.porcentajeFinanciero !== null ? `${s.porcentajeFinanciero.toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cerrar</Button>
        <Button size="sm" onClick={guardar}>Guardar</Button>
      </div>

      <ModalMotorFinanciero open={motorAbierto} onClose={() => setMotorAbierto(false)} />
    </div>
  );
}
