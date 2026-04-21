import React, { useState, useCallback, useMemo, memo } from "react";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Button from "../components/Shared/Button";
import Input from "../components/Shared/Input";
import ModalActualizacion from "../components/Modal/ModalActualizacion";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useObras } from "../context/ObraContext";
import { useAuth } from "../context/AuthContext";
import { obrasNuevoAPI } from "../utils/api";
import { colorBarra, estadoLabel, formatearFechaHora } from "../utils/formatters";

const ESTADOS = [
  { value: "",            label: "Todos los estados" },
  { value: "SIN INICIAR", label: "Sin iniciar" },
  { value: "EN PROCESO",  label: "En proceso" },
  { value: "TERMINADO",   label: "Terminado" },
  { value: "ENTREGADO",   label: "Entregado" },
  { value: "CANCELADA",    label: "Cancelada" },
];

const BarraPct = memo(function BarraPct({ pct }) {
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <div className="flex-1 rounded-full h-4 overflow-hidden" style={{ backgroundColor: "#F0ECE5" }}>
        <div
          className={`h-4 rounded-full ${colorBarra(pct)} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold w-11 text-right" style={{ color: "#2C2C2C" }}>{pct}%</span>
    </div>
  );
});

const BadgeEstado = memo(function BadgeEstado({ estado }) {
  const info = estadoLabel(estado);
  return <span className={`badge ${info.clase} text-xs font-semibold`}>{info.icono} {info.label}</span>;
});

function getObraKey(obra, index) {
  return `${obra.direccion_general || "sin-direccion"}-${obra.programa || "sin-programa"}-${obra.nombre || "sin-nombre"}-${index}`;
}

function getProgramaResumen(obras) {
  const total = obras.length;
  const est = (o) => String(o.estatus || o.estado || "").toUpperCase();
  const terminadas = obras.filter((o) => est(o) === "TERMINADO" || est(o) === "ENTREGADO").length;
  const promedio = total > 0
    ? Math.round(obras.reduce((acc, obra) => acc + Number(obra.avance ?? obra.porcentaje ?? 0), 0) / total)
    : 0;
  return { total, actualizadas: terminadas, promedio };
}

function getObraReferenciaGeneral(obra, direccionVisible) {
  return [
    obra.id_obra || obra.id ? `ID ${obra.id_obra || obra.id}` : null,
    obra.alcaldia || null,
    obra.programa || null,
    direccionVisible || obra.direccion_general || null,
  ].filter(Boolean).join(" • ");
}

export default function ListadoObras() {
  const {
    obrasFiltradas,
    loading,
    busqueda, setBusqueda,
    filtroProg, setFiltroProg,
    filtroEst, setFiltroEst,
    updateObraLocal,
    filterCanceladas,
  } = useObras();
  const { user } = useAuth();

  const [obraModal, setObraModal] = useState(null);
  const [dgAbierta, setDgAbierta] = useState(null);
  const [programaAbierto, setProgramaAbierto] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const vistaPorDG = !user?.dg;

  const abrirModal = useCallback((obra) => setObraModal(obra), []);
  const cerrarModal = useCallback(() => setObraModal(null), []);
  const abrirConfirmacion = useCallback((payload) => setConfirmacion(payload), []);
  const cerrarConfirmacion = useCallback(() => setConfirmacion(null), []);

  // Actualizar obra usando el nuevo endpoint PUT /api/avance
  const updateObraInline = useCallback(async (obra, nuevoAvance, options = {}) => {
    try {
      const data = await obrasNuevoAPI.updateAvance(
        obra.id_obra || obra.id,
        nuevoAvance,
        user?.email || "sistema",
        { tabla: obra.tabla, ...options }   // tabla como hint para evitar búsqueda en todas las tablas
      );
      if (!data.success) throw new Error(data.message || "Error al actualizar");

      const timestamp = new Date().toISOString();

      // Sincronizar estado local usando uid para matching preciso
      updateObraLocal({
        uid:     obra.uid,
        id:      obra.id_obra || obra.id,
        id_obra: obra.id_obra || obra.id,
        avance:  data.avance_nuevo,
        porcentaje: data.avance_nuevo,
        porcentaje_avance: data.avance_nuevo,
        estatus: data.estatus,
        estado:  data.estatus,
        color:   data.color,
        ultimaActualizacion: timestamp,
        fecha_actualizacion: timestamp,
      });

      // Limpiar obras canceladas del listado tras cualquier actualización
      filterCanceladas();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [updateObraLocal, filterCanceladas, user?.email]);

  const toggleDg = useCallback((direccion) => {
    setDgAbierta((prev) => (prev === direccion ? null : direccion));
    setProgramaAbierto(null);
  }, []);
  const togglePrograma = useCallback((programaKey) => {
    setProgramaAbierto((prev) => (prev === programaKey ? null : programaKey));
  }, []);

  const programas = useMemo(() => {
    return [...new Set(
      obrasFiltradas
        .map((obra) => obra.programa)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [obrasFiltradas]);

  const groupedData = useMemo(() => {
    return obrasFiltradas.reduce((acc, obra) => {
      const dg = obra.direccion_general || "SIN DIRECCION";
      const programa = obra.programa || "SIN PROGRAMA";

      if (!acc[dg]) acc[dg] = {};
      if (!acc[dg][programa]) acc[dg][programa] = [];

      acc[dg][programa].push(obra);
      return acc;
    }, {});
  }, [obrasFiltradas]);

  const direcciones = useMemo(() => {
    return Object.entries(groupedData)
      .map(([direccion, programasMap]) => {
        const programasLista = Object.entries(programasMap)
          .map(([programa, obrasPrograma]) => ({
            programa,
            obras: obrasPrograma,
            resumen: getProgramaResumen(obrasPrograma),
          }))
          .sort((a, b) => a.programa.localeCompare(b.programa));

        const totalObras = programasLista.reduce((acc, item) => acc + item.obras.length, 0);
        const totalProgramas = programasLista.length;

        return {
          direccion,
          programas: programasLista,
          totalObras,
          totalProgramas,
        };
      })
      .sort((a, b) => a.direccion.localeCompare(b.direccion));
  }, [groupedData]);

  const programasDeUsuario = useMemo(() => {
    return Object.entries(groupedData)
      .flatMap(([, programasMap]) =>
        Object.entries(programasMap).map(([programa, obrasPrograma]) => ({
          programa,
          obras: obrasPrograma,
          resumen: getProgramaResumen(obrasPrograma),
        }))
      )
      .sort((a, b) => a.programa.localeCompare(b.programa));
  }, [groupedData]);

  const totalTarjetaSecundaria = vistaPorDG ? obrasFiltradas.length : programasDeUsuario.length;
  const sinResultados = vistaPorDG ? direcciones.length === 0 : programasDeUsuario.length === 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #F3F2EF 0%, #ECE9E2 100%)" }}>
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto w-full">
          <div className="mb-4 animate-fade-in">
            <div className="rounded-2xl px-5 py-4" style={{ background: "linear-gradient(135deg, #F7F3EE 0%, #EFE7DD 100%)", border: "1px solid rgba(201,166,107,0.25)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "#8C6B41" }}>
                    Centro De Control De Obras
                  </p>
                  <h1 className="mt-1 text-2xl lg:text-3xl font-bold" style={{ color: "#691C32" }}>Listado Ejecutivo</h1>
                  <p className="mt-0.5 text-xs" style={{ color: "#666666" }}>
                    {user?.dg
                      ? `${obrasFiltradas.length} obras · DG ${user.dg}`
                      : `${obrasFiltradas.length} obras · ${direcciones.length} direcciones generales`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.2)" }}>
                    <p className="text-xs" style={{ color: "#8C6B41" }}>{user?.dg ? "Dirección" : "Direcciones"}</p>
                    <p className="text-lg font-bold" style={{ color: "#2C2C2C" }}>{user?.dg || direcciones.length}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.2)" }}>
                    <p className="text-xs" style={{ color: "#8C6B41" }}>{user?.dg ? "Programas" : "Obras"}</p>
                    <p className="text-lg font-bold" style={{ color: "#2C2C2C" }}>{totalTarjetaSecundaria}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-3 mb-4 animate-fade-in"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.22)" }}
          >
            <div className="flex flex-col lg:flex-row gap-2">
              <div className="flex-1">
                <Input
                  id="busqueda-obras"
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  aria-label="Buscar obras por nombre"
                />
              </div>

              <select
                value={filtroProg}
                onChange={(e) => setFiltroProg(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32] transition-colors"
                style={{ border: "1px solid rgba(201,166,107,0.34)", color: "#2C2C2C" }}
                aria-label="Filtrar por programa"
              >
                <option value="">Todos los programas</option>
                {programas.map((programa) => (
                  <option key={programa} value={programa}>{programa}</option>
                ))}
              </select>

              <select
                value={filtroEst}
                onChange={(e) => setFiltroEst(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32] transition-colors"
                style={{ border: "1px solid rgba(201,166,107,0.34)", color: "#2C2C2C" }}
                aria-label="Filtrar por estado"
              >
                {ESTADOS.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>

              {(busqueda || filtroProg || filtroEst) && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => { setBusqueda(""); setFiltroProg(""); setFiltroEst(""); }}
                  aria-label="Limpiar todos los filtros"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#691C32", borderTopColor: "transparent" }}
              />
            </div>
          ) : sinResultados ? (
            <div
              className="text-center py-14 text-sm rounded-3xl animate-fade-in shadow-md"
              style={{ color: "#666666", border: "1px solid rgba(201,166,107,0.22)", backgroundColor: "#FFFFFF" }}
            >
              No se encontraron obras con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              {vistaPorDG && direcciones.map((direccion) => (
                <section
                  key={direccion.direccion}
                  className="rounded-2xl overflow-hidden shadow-md"
                  style={{ border: "1px solid rgba(201,166,107,0.20)", backgroundColor: "#FFFFFF" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleDg(direccion.direccion)}
                    className="w-full text-left px-4 py-3"
                    style={{ background: "linear-gradient(135deg, #691C32 0%, #7E2843 60%, #4F0E21 100%)", color: "#FFF8F1" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Dirección General</p>
                        <h2 className="mt-0.5 text-base lg:text-lg font-bold truncate">{direccion.direccion}</h2>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-white/70">{direccion.totalProgramas} prog. · {direccion.totalObras} obras</span>
                        <span className="text-white/80 font-bold">{dgAbierta === direccion.direccion ? "−" : "+"}</span>
                      </div>
                    </div>
                  </button>

                  {dgAbierta === direccion.direccion && (
                    <div className="p-3 space-y-2" style={{ background: "linear-gradient(180deg, #FFFDFC 0%, #F7F3EE 100%)" }}>
                      {direccion.programas.map((programaItem) => {
                        const programaKey = `${direccion.direccion}::${programaItem.programa}`;

                        return (
                          <section
                            key={programaKey}
                            className="rounded-2xl overflow-hidden"
                            style={{ border: "1px solid rgba(201,166,107,0.28)", backgroundColor: "#FFFFFF" }}
                          >
                            <button
                              type="button"
                              onClick={() => togglePrograma(programaKey)}
                              className="w-full text-left px-4 py-3"
                              style={{ background: "linear-gradient(180deg, rgba(201,166,107,0.12) 0%, #FFFFFF 100%)" }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Programa</p>
                                  <h3 className="mt-0.5 text-sm font-bold truncate" style={{ color: "#2C2C2C" }}>
                                    {programaItem.programa}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: "#8C6B41" }}>
                                  <span>{programaItem.resumen.total} obras · {programaItem.resumen.promedio}%</span>
                                  <span className="font-bold">{programaAbierto === programaKey ? "−" : "+"}</span>
                                </div>
                              </div>
                            </button>

                            {programaAbierto === programaKey && (
                              <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "rgba(201,166,107,0.20)" }}>
                                {programaItem.obras.map((obra, index) => (
                                  <ObraRow
                                    key={getObraKey(obra, index)}
                                    obra={obra}
                                    abrirModal={abrirModal}
                                    abrirConfirmacion={abrirConfirmacion}
                                    editingId={editingId}
                                    setEditingId={setEditingId}
                                    updateObraInline={updateObraInline}
                                    direccionVisible={obra.direccion_general}
                                  />
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}

              {!vistaPorDG && programasDeUsuario.map((programaItem) => {
                const programaKey = `dg::${programaItem.programa}`;

                return (
                  <section
                    key={programaKey}
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(201,166,107,0.20)", backgroundColor: "#FFFFFF" }}
                  >
                    <button
                      type="button"
                      onClick={() => togglePrograma(programaKey)}
                      className="w-full text-left px-4 py-3"
                      style={{ background: "linear-gradient(180deg, rgba(201,166,107,0.12) 0%, #FFFFFF 100%)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8C6B41" }}>Programa</p>
                          <h3 className="mt-0.5 text-sm font-bold truncate" style={{ color: "#2C2C2C" }}>
                            {programaItem.programa}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: "#8C6B41" }}>
                          <span>{programaItem.resumen.total} obras · {programaItem.resumen.promedio}%</span>
                          <span className="font-bold">{programaAbierto === programaKey ? "−" : "+"}</span>
                        </div>
                      </div>
                    </button>

                    {programaAbierto === programaKey && (
                      <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "rgba(201,166,107,0.20)" }}>
                        {programaItem.obras.map((obra, index) => (
                          <ObraRow
                            key={getObraKey(obra, index)}
                            obra={obra}
                            abrirModal={abrirModal}
                            abrirConfirmacion={abrirConfirmacion}
                            editingId={editingId}
                            setEditingId={setEditingId}
                            updateObraInline={updateObraInline}
                            direccionVisible={user?.dg || obra.direccion_general}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <Footer />

      {obraModal && (
        <ModalActualizacion obra={obraModal} onClose={cerrarModal} />
      )}

      {confirmacion && (
        <ModalConfirmacionActualizacion
          obra={confirmacion.obra}
          titulo={confirmacion.titulo}
          mensaje={confirmacion.mensaje}
          avanceAnterior={confirmacion.avanceAnterior}
          avanceNuevo={confirmacion.avanceNuevo}
          botonConfirmar={confirmacion.botonConfirmar}
          variant={confirmacion.variant}
          onConfirm={confirmacion.onConfirm}
          onClose={cerrarConfirmacion}
        />
      )}
    </div>
  );
}

// Devuelve el estado de la obra para lógica visual:
// "inaugurada" | "terminada" | "en_proceso" | "sin_iniciar" | "cancelada"
function getEstadoObra(obra) {
  const estatus = String(obra.estatus || obra.estado || "").toUpperCase();
  const avance  = Number(obra.avance ?? obra.porcentaje ?? obra.porcentaje_avance ?? 0);
  if (estatus === "CANCELADA" || estatus === "CANCELADO") return "cancelada";
  if (estatus.includes("ENTREGAD") || estatus.includes("INAUGUR"))  return "inaugurada";
  if (avance === 100)          return "terminada";
  if (avance > 0)              return "en_proceso";
  return "sin_iniciar";
}

function ObraRow({ obra, abrirModal, abrirConfirmacion, editingId, setEditingId, updateObraInline, direccionVisible }) {
  const avanceActual = obra.avance ?? obra.porcentaje ?? obra.porcentaje_avance ?? 0;
  const referenciaGeneral = getObraReferenciaGeneral(obra, direccionVisible);
  const [inputValue,       setInputValue]       = useState("");
  const [updating,         setUpdating]         = useState(false);
  const [updated,          setUpdated]          = useState(false);
  const [errorMsg,         setErrorMsg]         = useState(null);
  // Modal inaugurar
  const [modalInaugurar,   setModalInaugurar]   = useState(false);
  const [fechaInauguracion,setFechaInauguracion] = useState("");
  // Modal cancelar
  const [modalCancelar,    setModalCancelar]    = useState(false);
  const [motivo,           setMotivo]           = useState("");

  const isEditing    = editingId === (obra.id_obra || obra.id);
  const estadoObra   = getEstadoObra(obra);
  const isInaugurada = estadoObra === "inaugurada";
  const isTerminada  = estadoObra === "terminada";
  const isEnProceso  = estadoObra === "en_proceso";
  const yaCancelada  = estadoObra === "cancelada";

  const startEdit = useCallback(() => {
    setInputValue(avanceActual === 0 ? "" : String(avanceActual));
    setErrorMsg(null);
    setEditingId(obra.id_obra || obra.id);
  }, [obra.id_obra, obra.id, avanceActual, setEditingId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setInputValue("");
    setErrorMsg(null);
  }, [setEditingId]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setInputValue(val);
      setErrorMsg(null);
    }
  }, []);

  const ejecutarActualizacion = useCallback(async (payload) => {
    setUpdating(true);
    setErrorMsg(null);
    const result = await updateObraInline(obra, payload.nuevoAvance, payload.options);
    setUpdating(false);
    if (result.success) {
      setUpdated(true);
      setEditingId(null);
      setInputValue("");
      setTimeout(() => setUpdated(false), 2500);
      return { success: true };
    }

    setErrorMsg(result.error || "Error al actualizar");
    return { success: false };
  }, [obra, setEditingId, updateObraInline]);

  const confirmEdit = useCallback(async () => {
    const finalValue = parseFloat(inputValue || 0);
    if (finalValue === avanceActual) { cancelEdit(); return; }

    abrirConfirmacion({
      obra,
      titulo: "Confirmar actualización",
      mensaje: "Se aplicará el nuevo porcentaje de avance a la obra seleccionada.",
      avanceAnterior: avanceActual,
      avanceNuevo: finalValue,
      botonConfirmar: "Sí, actualizar",
      variant: "primary",
      onConfirm: () => ejecutarActualizacion({ nuevoAvance: finalValue }),
    });
  }, [inputValue, avanceActual, cancelEdit, abrirConfirmacion, obra, ejecutarActualizacion]);

  const marcarInaugurada = useCallback(() => {
    if (isInaugurada || yaCancelada) return;
    setFechaInauguracion("");
    setModalInaugurar(true);
  }, [isInaugurada, yaCancelada]);

  const confirmarInaugurada = useCallback(async () => {
    if (!fechaInauguracion) return;
    setUpdating(true);
    setErrorMsg(null);
    const result = await updateObraInline(obra, 100, {
      marcar_entregada: true,
      fecha_inauguracion: fechaInauguracion,
    });
    setUpdating(false);
    setModalInaugurar(false);
    if (result.success) {
      setUpdated(true);
      setTimeout(() => setUpdated(false), 2500);
    } else {
      setErrorMsg(result.error || "Error al marcar como inaugurada");
    }
  }, [fechaInauguracion, updateObraInline, obra]);

  const marcarCancelada = useCallback(() => {
    if (yaCancelada) return;
    setMotivo("");
    setModalCancelar(true);
  }, [yaCancelada]);

  const confirmarCancelada = useCallback(async () => {
    if (!motivo.trim()) return;
    setUpdating(true);
    setErrorMsg(null);
    const result = await updateObraInline(obra, avanceActual, {
      marcar_cancelada: true,
      motivo_cancelacion: motivo.trim(),
    });
    setUpdating(false);
    setModalCancelar(false);
    if (!result.success) {
      setErrorMsg(result.error || "Error al cancelar obra");
    }
  }, [motivo, updateObraInline, obra, avanceActual]);

  const repetirPorcentaje = useCallback(() => {
    abrirConfirmacion({
      obra,
      titulo: "Confirmar repetición de porcentaje",
      mensaje: "Se registrará nuevamente el mismo porcentaje para que la obra quede actualizada en este corte semanal.",
      avanceAnterior: avanceActual,
      avanceNuevo: avanceActual,
      botonConfirmar: "Sí, repetir porcentaje",
      variant: "secondary",
      onConfirm: () => ejecutarActualizacion({
        nuevoAvance: avanceActual,
        options: { repetir_porcentaje: true },
      }),
    });
  }, [abrirConfirmacion, avanceActual, ejecutarActualizacion, obra]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      confirmEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }, [confirmEdit, cancelEdit]);

  const cardStyle = updated
    ? { backgroundColor: "#F0FFF4", border: "1px solid #68D391", boxShadow: "0 4px 12px rgba(72,187,120,0.25)" }
    : isInaugurada
    ? { background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "2px solid #2563eb", boxShadow: "0 2px 8px rgba(37,99,235,0.10)", opacity: 0.95 }
    : isTerminada
    ? { background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", border: "2px solid #16a34a", boxShadow: "0 2px 8px rgba(22,163,74,0.10)" }
    : yaCancelada
    ? { backgroundColor: "rgba(255, 0, 0, 0.05)", border: "1px solid #ef4444", boxShadow: "0 2px 8px rgba(239,68,68,0.08)", opacity: 0.85 }
    : { backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.16)", boxShadow: "0 2px 8px rgba(76,57,35,0.05)" };

  return (
    <>
    <div
      className="mt-2 rounded-xl px-3 py-3 transition-all duration-200"
      style={cardStyle}
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base leading-tight" style={{ color: "#2C2C2C" }}>
            {obra.nombre || "SIN NOMBRE"}
          </p>
          {referenciaGeneral && (
            <p className="mt-1 text-xs font-medium" style={{ color: "#8C6B41" }}>
              {referenciaGeneral}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "#666666" }}>
            <span>{formatearFechaHora(obra.ultimaActualizacion)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end xl:min-w-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            {/* ── CASO 1: Inaugurada ── */}
            {isInaugurada && (
              <>
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
                  title="Esta obra ya fue inaugurada y no puede modificarse"
                >
                  ✔ Inaugurada
                </span>
                <span className="text-xs font-medium italic" style={{ color: "#1d4ed8" }}>
                  Obra inaugurada
                </span>
              </>
            )}

            {/* ── CASO 2: Terminada (100%) pero aún no inaugurada ── */}
            {isTerminada && (
              <>
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#16a34a", color: "#ffffff" }}
                >
                  Lista para inaugurar
                </span>
                <Button
                  size="sm"
                  onClick={marcarInaugurada}
                  aria-label={`Marcar como obra inaugurada ${obra.nombre}`}
                  style={{ backgroundColor: "#16a34a", color: "#ffffff", border: "none" }}
                >
                  Marcar como obra inaugurada
                </Button>
              </>
            )}

            {/* ── CASO 3: En proceso (1–99) ── */}
            {isEnProceso && (
              <>
                <BadgeEstado estado={obra.estatus || obra.estado} />
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={confirmEdit} disabled={updating}>
                      {updating ? "Guardando..." : "Confirmar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={updating}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button size="sm" variant="primary" onClick={startEdit} aria-label={`Actualizar ${obra.nombre}`}>
                      Actualizar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={repetirPorcentaje} aria-label={`Repetir porcentaje de ${obra.nombre}`}>
                      Repetir porcentaje
                    </Button>
                    <Button size="sm" variant="danger" onClick={marcarCancelada} aria-label={`Cancelar obra ${obra.nombre}`}>
                      Cancelar obra
                    </Button>
                  </>
                )}
              </>
            )}

            {/* ── CASO 4: Sin iniciar (0) ── */}
            {estadoObra === "sin_iniciar" && (
              <>
                <BadgeEstado estado={obra.estatus || obra.estado} />
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={confirmEdit} disabled={updating}>
                      {updating ? "Guardando..." : "Confirmar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={updating}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="primary" onClick={startEdit} aria-label={`Registrar avance en ${obra.nombre}`}>
                    Registrar avance
                  </Button>
                )}
              </>
            )}

            {/* ── CASO: Cancelada ── */}
            {yaCancelada && (
              <>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
                >
                  OBRA CANCELADA
                </span>
                <span className="text-xs font-medium italic" style={{ color: "#991b1b" }}>
                  no editable
                </span>
              </>
            )}
          </div>
          {isEditing && !isInaugurada && !yaCancelada && !isTerminada ? (
            <div className="flex flex-col gap-1 min-w-[220px]">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  autoFocus
                  placeholder="0"
                />
                <span className="text-sm font-bold" style={{ color: "#2C2C2C" }}>%</span>
                <div className="flex-1 rounded-full h-4 overflow-hidden" style={{ backgroundColor: "#F0ECE5" }}>
                  <div
                    className={`h-4 rounded-full ${colorBarra(parseFloat(inputValue || 0))} transition-all duration-300`}
                    style={{ width: `${parseFloat(inputValue || 0)}%` }}
                  />
                </div>
              </div>
              {errorMsg && (
                <div className="text-xs" style={{ color: "#d50000" }}>{errorMsg}</div>
              )}
            </div>
          ) : (
            <BarraPct pct={Number(avanceActual)} />
          )}
          {updated && (
            <div className="text-xs font-semibold" style={{ color: "#2e7d32" }}>
              ✓ Actualizado correctamente
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Modal: Inaugurar obra */}
    <ConfirmModal
      open={modalInaugurar}
      title="Marcar obra como inaugurada"
      subtitle={obra.nombre}
      onConfirm={confirmarInaugurada}
      onCancel={() => setModalInaugurar(false)}
      confirmText="Sí, marcar inaugurada"
      confirmDisabled={!fechaInauguracion}
      loading={updating}
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
        style={{ border: "1px solid #d1d5db", focusRingColor: "#2563eb" }}
      />
    </ConfirmModal>

    {/* Modal: Cancelar obra */}
    <ConfirmModal
      open={modalCancelar}
      title="Cancelar obra"
      subtitle={obra.nombre}
      onConfirm={confirmarCancelada}
      onCancel={() => setModalCancelar(false)}
      confirmText="Sí, cancelar obra"
      confirmDisabled={!motivo.trim()}
      loading={updating}
      variant="danger"
    >
      <p className="text-sm mb-4" style={{ color: "#4b5563" }}>
        Esta acción marcará la obra como cancelada. El registro se conserva en base de datos.
      </p>
      <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
        Motivo de cancelación <span style={{ color: "#dc2626" }}>*</span>
      </label>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Describe el motivo de cancelación..."
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2"
        style={{ border: "1px solid #d1d5db" }}
      />
    </ConfirmModal>
    </>
  );
}

function ModalConfirmacionActualizacion({
  obra,
  titulo,
  mensaje,
  avanceAnterior,
  avanceNuevo,
  botonConfirmar,
  variant = "primary",
  onConfirm,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const confirmar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await onConfirm?.();
      if (result?.success === false) {
        setError(result.error || "No fue posible completar la acción.");
        return;
      }
      onClose?.();
    } catch (err) {
      setError(err.message || "No fue posible completar la acción.");
    } finally {
      setLoading(false);
    }
  }, [onConfirm, onClose]);

  return (
    <ConfirmModal
      open={true}
      title={titulo}
      subtitle={obra?.nombre}
      onConfirm={confirmar}
      onCancel={onClose}
      confirmText={botonConfirmar}
      cancelText="Cancelar"
      loading={loading}
      variant={variant}
    >
      <p className="text-sm mb-3" style={{ color: "#4b5563" }}>{mensaje}</p>
      <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: "#F9F7F3", border: "1px solid rgba(201,166,107,0.22)" }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: "#666666" }}>Avance actual</span>
          <strong style={{ color: "#2C2C2C" }}>{Number(avanceAnterior)}%</strong>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span style={{ color: "#666666" }}>Nuevo avance</span>
          <strong style={{ color: "#2563EB" }}>{Number(avanceNuevo)}%</strong>
        </div>
      </div>
      {error && (
        <div className="text-sm rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
          {error}
        </div>
      )}
    </ConfirmModal>
  );
}
