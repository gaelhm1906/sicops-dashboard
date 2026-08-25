import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../Shared/Button";
import { getObraKey } from "../../utils/seguimiento";
import { getCaratulaContrato, getCaratulaSupervisionDeObra, agregarObservacionCaratula, getContratoIdDeObra } from "../../utils/caratulaContrato";
import { puedeEditarContrato } from "../../utils/contratos";
import { formatearFechaHora } from "../../utils/formatters";

function Dato({ label, valor }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8C6B41" }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{valor || "—"}</p>
    </div>
  );
}

function Seccion({ numero, titulo, children }) {
  return (
    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: "4px solid #691C32", boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>{numero} /</span>
        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "#691C32" }}>{titulo}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

/**
 * Ajuste de flujo: la carátula ya no se edita desde la obra — se captura
 * y se vincula desde la página de Contratos (Director de Concursos y
 * Contratos, "paso 1" y "paso 2"). Aquí, dentro de la obra, es de SOLO
 * LECTURA para todos: sirve para que Supervisión Externa y los demás
 * roles vean el contrato ya precargado y dejen observaciones si algo
 * está mal, sin poder tocar los datos directamente.
 */
export default function ModalCaratulaContrato({ obra, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const obraKey = useMemo(() => getObraKey(obra), [obra]);
  const [datos, setDatos] = useState(() => getCaratulaContrato(obraKey));
  const datosSupervision = useMemo(() => getCaratulaSupervisionDeObra(obraKey), [obraKey]);
  const [observacionNueva, setObservacionNueva] = useState("");
  const vinculado = !!getContratoIdDeObra(obraKey);
  const vinculadaSupervision = !!datosSupervision.numero_contrato;
  const puedeIrAContratos = puedeEditarContrato(user?.rol);

  const enviarObservacion = () => {
    if (!observacionNueva.trim()) return;
    setDatos(agregarObservacionCaratula(obraKey, observacionNueva, user?.nombre || user?.email));
    setObservacionNueva("");
  };

  const irAContratos = () => {
    onClose();
    navigate("/contratos");
  };

  if (!obra) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Carátula del contrato — ${obra.nombre_obra || obra.nombre}`}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#691C32" }}>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">Carátula del Contrato</p>
            <p className="text-white/70 text-xs mt-0.5 truncate">{obra.nombre_obra || obra.nombre}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0" aria-label="Cerrar carátula del contrato">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto" style={{ backgroundColor: "#F7F3EE" }}>
          {!vinculado ? (
            <div className="rounded-xl px-4 py-8 text-center bg-white" style={{ border: "1px dashed var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Esta obra no tiene ningún contrato vinculado todavía.</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--ink-faint)" }}>
                El Director de Concursos y Contratos captura el contrato en el Registro de Contratos y ahí mismo lo vincula a la obra.
              </p>
              {puedeIrAContratos && (
                <Button size="sm" onClick={irAContratos}>Ir al Registro de Contratos</Button>
              )}
            </div>
          ) : (
            <>
              <Seccion numero="01" titulo="Identificación y financieros">
                <Dato label="Número de contrato" valor={datos.numero_contrato} />
                <Dato label="Procedimiento" valor={datos.procedimiento} />
                <Dato label="Fecha de contrato" valor={datos.fecha_contrato} />
                <Dato label="Importe sin IVA" valor={datos.importe_sin_iva} />
                <Dato label="IVA" valor={datos.iva} />
                <Dato label="Importe total" valor={datos.importe_total} />
                <Dato label="Anticipo" valor={datos.anticipo} />
                <Dato label="Tipo de ejercicio" valor={datos.tipo_ejercicio} />
              </Seccion>

              <Seccion numero="02" titulo="Dependencia y ejecución">
                <Dato label="Dirección general" valor={datos.direccion_general} />
                <Dato label="Programa" valor={datos.programa} />
                <Dato label="Área responsable" valor={datos.area_responsable} />
                <Dato label="Fecha de inicio" valor={datos.fecha_inicio} />
                <Dato label="Fecha de término" valor={datos.fecha_termino} />
                <Dato label="Días naturales" valor={datos.dias_naturales} />
                <Dato label="Número de frentes" valor={datos.numero_frentes} />
                <Dato label="Alcance por frente" valor={datos.alcance_frentes} />
              </Seccion>

              <Seccion numero="03" titulo="Contratista">
                <Dato label="Contratista" valor={datos.contratista} />
                <Dato label="Representante legal" valor={datos.representante_legal} />
                <Dato label="RFC" valor={datos.rfc} />
                <Dato label="Domicilio fiscal" valor={datos.domicilio_fiscal} />
              </Seccion>

              <Seccion numero="04" titulo="Contrato de supervisión externa">
                {vinculadaSupervision ? (
                  <>
                    <Dato label="Número de contrato" valor={datosSupervision.numero_contrato} />
                    <Dato label="Fecha de contrato" valor={datosSupervision.fecha_contrato} />
                    <Dato label="Empresa" valor={datosSupervision.contratista} />
                    <Dato label="Representante legal" valor={datosSupervision.representante_legal} />
                    <Dato label="Importe con IVA" valor={datosSupervision.importe_total} />
                    <Dato label="Periodo" valor={datosSupervision.fecha_inicio ? `${datosSupervision.fecha_inicio} al ${datosSupervision.fecha_termino}` : ""} />
                  </>
                ) : (
                  <p className="text-xs sm:col-span-3" style={{ color: "var(--ink-faint)" }}>
                    Este contrato de obra aún no tiene un contrato de supervisión vinculado — es un registro independiente, se vincula desde el Registro de Contratos.
                  </p>
                )}
              </Seccion>

              {/* Pedido real del área, 2026-08-21: antes de capturar avance,
                  la carátula de supervisión debe dejar ver cuántas y
                  cuáles obras atiende ese mismo contrato — la vinculación
                  la sigue haciendo Concursos y Contratos (fuente directa),
                  esto es de solo lectura, igual que el resto de la
                  carátula. Sin esto no había forma de confirmar "atiendo
                  11 de 22 módulos" sin ir obra por obra. */}
              {vinculadaSupervision && (
                <Seccion numero="05" titulo="Frentes de trabajo supervisados">
                  <div className="sm:col-span-3">
                    {datosSupervision.frentes_supervisados.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        Aún no se cargó la lista de obras que atiende este contrato — vuelve a abrir esta carátula en un momento.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink)" }}>
                          {datosSupervision.frentes_supervisados.length} obra{datosSupervision.frentes_supervisados.length === 1 ? "" : "s"} bajo este contrato:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {datosSupervision.frentes_supervisados.map((f) => (
                            <div
                              key={f.obraId}
                              className="text-xs px-2.5 py-1.5 rounded-lg truncate"
                              style={{
                                backgroundColor: String(f.obraId) === String(obra.id) ? "rgba(105,28,50,0.08)" : "#F7F3EE",
                                color: "var(--ink)",
                                fontWeight: String(f.obraId) === String(obra.id) ? 700 : 400,
                              }}
                              title={f.nombreObra}
                            >
                              {f.nombreObra}{String(f.obraId) === String(obra.id) ? " (esta obra)" : ""}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Seccion>
              )}

              <div className="rounded-2xl p-5 mt-3" style={{ backgroundColor: "#fff", borderLeft: "4px solid #92400e", boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>06 /</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "#92400e" }}>Observaciones y correcciones</h3>
                </div>
                <div className="space-y-2 mb-3">
                  {datos.observaciones.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin observaciones — así se reportan inconsistencias sin editar la carátula directamente.</p>
                  )}
                  {datos.observaciones.map((o) => (
                    <div key={o.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                      <p className="text-sm" style={{ color: "var(--ink)" }}>{o.texto}</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>{o.autor} · {formatearFechaHora(o.fecha)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    placeholder="Reporta aquí una inconsistencia (ej. diferencia de redondeo en el IVA)..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#691C32]/30"
                    style={{ border: "1px solid #D4C4B0" }}
                    value={observacionNueva}
                    onChange={(e) => setObservacionNueva(e.target.value)}
                  />
                  <Button size="sm" onClick={enviarObservacion} disabled={!observacionNueva.trim()}>Enviar</Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-end shrink-0" style={{ borderTop: "1px solid rgba(201,166,107,0.25)", backgroundColor: "#fff" }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
