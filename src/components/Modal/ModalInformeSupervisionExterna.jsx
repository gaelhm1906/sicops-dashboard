import React, { useEffect, useMemo, useRef, useState } from "react";
import { getObraKey } from "../../utils/seguimiento";
import { getCaratulaContrato, getCaratulaSupervisionDeObra, hidratarCaratulaDesdeServidor } from "../../utils/caratulaContrato";
import {
  getAvanceFinanciero,
  construirSemanasFisico,
  calcularEstimacionesFinanciero,
  avanceFinancieroPorSemana,
  importeRealDeAvance,
  saldoPendientePorEstimar,
} from "../../utils/avanceFisicoFinanciero";
import LineChartAvance from "../Seguimiento/charts/LineChartAvance";
import Button from "../Shared/Button";
import { exportarInformeExcel } from "../../utils/exportarInformeExcel";
import { exportarInformePDF } from "../../utils/exportarInformePDF";

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + (Number(dias) - 1));
  return d.toISOString().slice(0, 10);
}

function formatoMoneda(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
}

function formatoPct(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function Bloque({ numero, titulo, children }) {
  return (
    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: "4px solid #691C32", boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>{numero}</span>
        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "#691C32" }}>{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{valor || "—"}</p>
    </div>
  );
}

/* Tabla de avance semanal — Programado / Real / Financiero. Ajuste de
   reunión (12 de agosto, A2): la columna de importe se confundía con
   el % financiero — el formato oficial trae las tres series juntas.
   Ajuste (misma reunión, con la captura del Excel original de la hoja
   "GRÁFICA"): esa hoja NO trae importe, solo Semana/Periodo/Programado/
   Real/Financiero — así que el importe se muestra solo en el "Informe
   general de avance" (2.1, vía `importeTotal`), no en la tabla al pie
   de cada gráfica (A3, se llama sin ese prop y se queda en 5
   columnas, igual que el Excel). */
function TablaAvanceFisico({ semanas, financiero, importeTotal }) {
  if (semanas.length === 0) {
    return <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin avance capturado todavía.</p>;
  }
  const financieroPorSemana = {};
  for (const f of financiero || []) financieroPorSemana[f.numero] = f.porcentajeFinanciero;
  const conImporte = importeTotal != null;

  return (
    <>
      {semanas.some((s) => s.extendida) && (
        <p className="text-xs mb-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(217,119,6,0.08)", color: "#92400e" }}>
          ⚠ No se llegó al 100% en el plazo contractual — se habilitaron semanas adicionales (resaltadas) para seguir registrando el avance real hasta llegar a 100%.
        </p>
      )}
      <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid #e5e7eb" }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr style={{ backgroundColor: "#F8F5F2" }}>
              <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Sem.</th>
              <th className="text-left px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Periodo</th>
              <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Programado</th>
              <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Real</th>
              <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Financiero</th>
              {conImporte && <th className="text-right px-2 py-1.5 font-semibold" style={{ color: "#8C6B41" }}>Importe real c/IVA</th>}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s.numero} style={{ borderTop: "1px solid #f3f4f6", backgroundColor: s.extendida ? "rgba(217,119,6,0.06)" : undefined }}>
                <td className="px-2 py-1.5">{s.numero}{s.extendida && <span className="ml-1 text-[9px] font-bold uppercase" style={{ color: "#d97706" }}>ampliada</span>}</td>
                <td className="px-2 py-1.5" style={{ color: "#6b7280" }}>{s.periodoDel} al {s.periodoAl}</td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#d97706" }}>{formatoPct(s.avanceProgramado)}</td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#16a34a" }}>{formatoPct(s.avanceReal)}</td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#2563eb" }}>{formatoPct(financieroPorSemana[s.numero] ?? 0)}</td>
                {conImporte && <td className="px-2 py-1.5 text-right">{formatoMoneda(importeRealDeAvance(s.avanceReal, importeTotal))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* Tabla de estimaciones + saldo pendiente — reutilizada para obra y
   supervisión. */
function TablaEstimaciones({ estimaciones, saldo }) {
  if (estimaciones.length === 0) {
    return <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin estimaciones capturadas.</p>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Dato label="Importe del contrato" valor={formatoMoneda(saldo.importeTotal)} />
        <Dato label="Estimado a la fecha" valor={formatoMoneda(saldo.acumulado)} />
        <Dato label="Pendiente por estimar" valor={formatoMoneda(saldo.pendiente)} />
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
            </tr>
          </thead>
          <tbody>
            {estimaciones.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td className="px-2 py-1.5">{e.noEstimacion}</td>
                <td className="px-2 py-1.5 font-semibold" style={{ color: "var(--guinda)" }}>{e.identificador || "—"}</td>
                <td className="px-2 py-1.5" style={{ color: "#6b7280" }}>{e.periodoDel} al {e.periodoAl}</td>
                <td className="px-2 py-1.5 text-right">{formatoMoneda(e.montoSinIva)}</td>
                <td className="px-2 py-1.5 text-right">{formatoMoneda(e.montoConIva)}</td>
                <td className="px-2 py-1.5 text-right">{e.deduccionesTotales > 0 ? `-${formatoMoneda(e.deduccionesTotales)}` : "—"}</td>
                <td className="px-2 py-1.5 text-right font-semibold" style={{ color: "#2563eb" }}>{formatoMoneda(e.liquido)}</td>
                <td className="px-2 py-1.5 text-right">{formatoPct(e.porcentajeAcumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* Encabezado por tabla (ajuste de fondo, área técnica 11 de agosto): una
   supervisión puede cubrir varias empresas con un mismo contrato — sin
   número de contrato/descripción/empresa/monto a la vista es imposible
   saber de qué empresa es cada tabla. */
function EncabezadoContrato({ tipo, caratula, vacio }) {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3"
      style={{ backgroundColor: vacio ? "var(--surface-2)" : "#F6EDEE", border: `1px solid ${vacio ? "var(--border)" : "#EBD9DC"}` }}
    >
      <div className="col-span-2 sm:col-span-4">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--guinda)" }}>{tipo}</span>
      </div>
      {vacio ? (
        <p className="col-span-2 sm:col-span-4 text-xs" style={{ color: "var(--ink-faint)" }}>Sin contrato de supervisión vinculado todavía.</p>
      ) : (
        <>
          <Dato label="No. de contrato" valor={caratula.numero_contrato} />
          <Dato label="Descripción" valor={caratula.objeto_contrato} />
          <Dato label="Empresa" valor={caratula.contratista} />
          <Dato label="Monto con IVA" valor={formatoMoneda(caratula.importe_total)} />
        </>
      )}
    </div>
  );
}

/**
 * Ajuste de minuta (definición técnica de Supervisión Externa, sección
 * 11): los formatos del informe de supervisión externa NO se llenan a
 * mano — se ensamblan aquí a partir de la Carátula (captura única) y de
 * lo ya capturado en avance físico/financiero. Es un informe de SOLO
 * LECTURA: para corregir algo se edita en su módulo de origen.
 *
 * Ajuste de fondo (área técnica, 11 de agosto): numeración del PDF a
 * 1 (Carátula) / 2.1 (Informe general de avance) / 2.2 (Informe
 * presupuestal). Cada obra tiene DOS contratos — el de obra y el de
 * supervisión externa (5-6% del monto) — que conviven en el mismo
 * informe, cada uno con su propio encabezado. La gráfica combina
 * programado + real + financiero en una sola curva y va DESPUÉS de las
 * estimaciones (el financiero solo existe una vez reportadas). Montos
 * y porcentajes a dos decimales.
 */
export default function ModalInformeSupervisionExterna({ obra, onClose }) {
  const [descargando, setDescargando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const graficaRef = useRef(null);
  const graficaSupervisionRef = useRef(null);
  const obraKey = useMemo(() => getObraKey(obra), [obra]);

  /* Sesión PS real con obra ya migrada: trae la carátula real del
     servidor antes de intentar leerla — sin esto, una obra con contrato
     ya vinculado en Contratos seguiría pidiendo captura manual aquí. */
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelado = false;
    hidratarCaratulaDesdeServidor(obraKey, obra?.id).then(() => {
      if (!cancelado) setVersion((v) => v + 1);
    });
    return () => { cancelado = true; };
  }, [obraKey, obra?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer localStorage tras hidratar
  const caratula = useMemo(() => getCaratulaContrato(obraKey), [obraKey, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const caratulaSupervision = useMemo(() => getCaratulaSupervisionDeObra(obraKey), [obraKey, version]);
  const haySupervision = !!caratulaSupervision.numero_contrato;

  const faltaCaratula = !caratula.fecha_inicio || !caratula.dias_naturales || !caratula.importe_total;
  const fechaTermino = faltaCaratula ? null : sumarDias(caratula.fecha_inicio, caratula.dias_naturales);

  /* La captura de la supervisión vive bajo su propio contrato (id de la
     supervisión, no obraKey) — misma convención que
     CapturaAvanceFisico/CapturaAvanceFinanciero, para que una
     supervisión que atiende varias obras tenga un solo avance
     compartido en vez de uno duplicado por obra. */
  const faltaCaratulaSupervision = haySupervision && (!caratulaSupervision.fecha_inicio || !caratulaSupervision.dias_naturales || !caratulaSupervision.importe_total);
  const fechaTerminoSupervision = faltaCaratulaSupervision || !haySupervision ? null : sumarDias(caratulaSupervision.fecha_inicio, caratulaSupervision.dias_naturales);

  const semanasFisico = useMemo(() => {
    if (faltaCaratula) return [];
    return construirSemanasFisico(obraKey, caratula);
  }, [faltaCaratula, obraKey, caratula]);

  const estimacionesCalculadas = useMemo(() => {
    if (faltaCaratula) return [];
    const { estimaciones } = getAvanceFinanciero(obraKey);
    return calcularEstimacionesFinanciero(estimaciones, caratula, semanasFisico);
  }, [faltaCaratula, obraKey, caratula, semanasFisico]);

  const semanasFinanciero = useMemo(
    () => avanceFinancieroPorSemana(semanasFisico, estimacionesCalculadas),
    [semanasFisico, estimacionesCalculadas]
  );

  const saldo = useMemo(
    () => saldoPendientePorEstimar(estimacionesCalculadas, caratula),
    [estimacionesCalculadas, caratula]
  );

  const semanasFisicoSupervision = useMemo(() => {
    if (!haySupervision || faltaCaratulaSupervision) return [];
    return construirSemanasFisico(caratulaSupervision.id, caratulaSupervision);
  }, [haySupervision, faltaCaratulaSupervision, caratulaSupervision]);

  const estimacionesCalculadasSupervision = useMemo(() => {
    if (!haySupervision || faltaCaratulaSupervision) return [];
    const { estimaciones } = getAvanceFinanciero(caratulaSupervision.id);
    return calcularEstimacionesFinanciero(estimaciones, caratulaSupervision, semanasFisicoSupervision);
  }, [haySupervision, faltaCaratulaSupervision, caratulaSupervision, semanasFisicoSupervision]);

  const semanasFinancieroSupervision = useMemo(
    () => avanceFinancieroPorSemana(semanasFisicoSupervision, estimacionesCalculadasSupervision),
    [semanasFisicoSupervision, estimacionesCalculadasSupervision]
  );

  const saldoSupervision = useMemo(
    () => saldoPendientePorEstimar(estimacionesCalculadasSupervision, caratulaSupervision),
    [estimacionesCalculadasSupervision, caratulaSupervision]
  );

  if (!obra) return null;

  const descargarExcel = async () => {
    setDescargando(true);
    try {
      await exportarInformeExcel({
        obra,
        caratula,
        caratulaSupervision,
        semanasFisico,
        semanasFinanciero,
        estimacionesCalculadas,
        faltaCaratulaSupervision,
        semanasFisicoSupervision,
        semanasFinancieroSupervision,
        estimacionesCalculadasSupervision,
      });
    } finally {
      setDescargando(false);
    }
  };

  const descargarPdf = async () => {
    setDescargandoPdf(true);
    try {
      await exportarInformePDF({
        obra,
        caratula,
        caratulaSupervision,
        semanasFisico,
        semanasFinanciero,
        estimacionesCalculadas,
        lineChartEl: graficaRef.current,
        faltaCaratulaSupervision,
        semanasFisicoSupervision,
        semanasFinancieroSupervision,
        estimacionesCalculadasSupervision,
        lineChartElSupervision: graficaSupervisionRef.current,
      });
    } finally {
      setDescargandoPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={`Informe de avance físico financiero — ${obra.nombre_obra || obra.nombre}`}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#691C32" }}>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">Informe de avance físico financiero</p>
            <p className="text-white/70 text-xs mt-0.5 truncate">{obra.nombre_obra || obra.nombre}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0" aria-label="Cerrar informe">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto" style={{ backgroundColor: "#F7F3EE" }}>
          {faltaCaratula ? (
            <div className="rounded-xl px-4 py-8 text-center bg-white" style={{ border: "1px dashed var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Aún no se puede generar el informe.</p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Falta completar la Carátula del contrato (fecha de inicio, días naturales e importe total).</p>
            </div>
          ) : (
            <>
              <Bloque numero="1 /" titulo="Carátula">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--guinda)" }}>Contrato de obra</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <Dato label="No. de contrato" valor={caratula.numero_contrato} />
                  <Dato label="Contratista" valor={caratula.contratista} />
                  <Dato label="Descripción" valor={caratula.objeto_contrato} />
                  <Dato label="Periodo" valor={`${caratula.fecha_inicio} al ${fechaTermino}`} />
                  <Dato label="Importe total con IVA" valor={formatoMoneda(caratula.importe_total)} />
                  <Dato label="Días naturales" valor={caratula.dias_naturales} />
                  <Dato label="Número de frentes" valor={caratula.numero_frentes} />
                </div>

                <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5 pt-3" style={{ color: "var(--guinda)", borderTop: "1px dashed var(--border)" }}>Contrato de supervisión externa</p>
                {haySupervision ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Dato label="No. de contrato" valor={caratulaSupervision.numero_contrato} />
                    <Dato label="Empresa" valor={caratulaSupervision.contratista} />
                    <Dato label="Descripción" valor={caratulaSupervision.objeto_contrato} />
                    <Dato label="Periodo" valor={fechaTerminoSupervision ? `${caratulaSupervision.fecha_inicio} al ${fechaTerminoSupervision}` : caratulaSupervision.fecha_inicio} />
                    <Dato label="Importe total con IVA" valor={formatoMoneda(caratulaSupervision.importe_total)} />
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin contrato de supervisión vinculado todavía — se vincula desde el Registro de Contratos.</p>
                )}
              </Bloque>

              <Bloque numero="2.1 /" titulo="Informe general de avance">
                <EncabezadoContrato tipo="Contrato de obra" caratula={caratula} vacio={false} />
                <TablaAvanceFisico semanas={semanasFisico} financiero={semanasFinanciero} importeTotal={caratula.importe_total} />

                <div className="mt-4 pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
                  <EncabezadoContrato tipo="Contrato de supervisión externa" caratula={caratulaSupervision} vacio={!haySupervision} />
                  {haySupervision && (
                    faltaCaratulaSupervision ? (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Falta completar la carátula de este contrato (fecha de inicio, días naturales e importe total) para calcular su avance.</p>
                    ) : (
                      <TablaAvanceFisico semanas={semanasFisicoSupervision} financiero={semanasFinancieroSupervision} importeTotal={caratulaSupervision.importe_total} />
                    )
                  )}
                </div>
              </Bloque>

              <Bloque numero="2.2 /" titulo="Informe presupuestal">
                <EncabezadoContrato tipo="Contrato de obra" caratula={caratula} vacio={false} />
                <TablaEstimaciones estimaciones={estimacionesCalculadas} saldo={saldo} />

                {/* La gráfica va DESPUÉS de las estimaciones — el financiero
                    solo existe una vez que se reportaron (ajuste de fondo).
                    Una sola curva: programado + real + financiero. La
                    banda de contratista arriba y la tabla semanal debajo
                    (A3) replican la hoja "GRÁFICA" del Excel original,
                    que el área usuaria compartió como referencia el 12 de
                    agosto — esa hoja no lleva importe, solo los tres
                    avances, así que la tabla de aquí se queda en 5
                    columnas (a diferencia de la de "Informe general de
                    avance", que sí lo lleva). */}
                <div className="mt-4" ref={graficaRef}>
                  <div className="rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: "var(--guinda)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Gráfica de avance — contrato de obra</p>
                    <p className="text-xs font-bold text-white">{caratula.contratista}</p>
                  </div>
                  <LineChartAvance semanas={semanasFisico} financiero={semanasFinanciero} />
                </div>
                <div className="mt-3">
                  <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--ink-faint)" }}>Detalle semanal de la gráfica</p>
                  <TablaAvanceFisico semanas={semanasFisico} financiero={semanasFinanciero} />
                </div>

                <div className="mt-4 pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
                  <EncabezadoContrato tipo="Contrato de supervisión externa" caratula={caratulaSupervision} vacio={!haySupervision} />
                  {haySupervision && (
                    faltaCaratulaSupervision ? (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Falta completar la carátula de este contrato (fecha de inicio, días naturales e importe total) para calcular sus estimaciones.</p>
                    ) : (
                      <>
                        <TablaEstimaciones estimaciones={estimacionesCalculadasSupervision} saldo={saldoSupervision} />
                        {estimacionesCalculadasSupervision.length > 0 && (
                          <>
                            <div className="mt-4" ref={graficaSupervisionRef}>
                              <div className="rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: "var(--oro)" }}>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Gráfica de avance — contrato de supervisión</p>
                                <p className="text-xs font-bold text-white">{caratulaSupervision.contratista}</p>
                              </div>
                              <LineChartAvance semanas={semanasFisicoSupervision} financiero={semanasFinancieroSupervision} />
                            </div>
                            <div className="mt-3">
                              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--ink-faint)" }}>Detalle semanal de la gráfica</p>
                              <TablaAvanceFisico semanas={semanasFisicoSupervision} financiero={semanasFinancieroSupervision} />
                            </div>
                          </>
                        )}
                      </>
                    )
                  )}
                </div>
              </Bloque>

              <Bloque numero="·" titulo="Observaciones de la Carátula">
                {caratula.observaciones.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin observaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {caratula.observaciones.map((o) => (
                      <div key={o.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                        <p className="text-sm" style={{ color: "var(--ink)" }}>{o.texto}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Bloque>
            </>
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid rgba(201,166,107,0.25)", backgroundColor: "#fff" }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cerrar</Button>
          <Button variant="secondary" size="md" onClick={descargarPdf} disabled={faltaCaratula || descargandoPdf}>
            {descargandoPdf ? "Generando…" : "📄 Descargar PDF"}
          </Button>
          <Button variant="primary" size="md" onClick={descargarExcel} disabled={faltaCaratula || descargando}>
            {descargando ? "Generando…" : "⬇️ Descargar Excel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
