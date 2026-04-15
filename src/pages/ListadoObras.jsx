import React, { useState, useCallback, useMemo, memo } from "react";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Button from "../components/Shared/Button";
import Input from "../components/Shared/Input";
import ModalActualizacion from "../components/Modal/ModalActualizacion";
import { useObras } from "../context/ObraContext";
import { useAuth } from "../context/AuthContext";
import { obrasAPI, normalizeObra } from "../utils/api";
import { colorBarra, estadoLabel, formatearFechaHora } from "../utils/formatters";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "actualizada", label: "Actualizada" },
  { value: "en_progreso", label: "En progreso" },
  { value: "pendiente", label: "Pendiente" },
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
  const actualizadas = obras.filter((obra) => obra.estado === "actualizada").length;
  const promedio = total > 0
    ? Math.round(obras.reduce((acc, obra) => acc + Number(obra.porcentaje || 0), 0) / total)
    : 0;

  return { total, actualizadas, promedio };
}

export default function ListadoObras() {
  const {
    obrasFiltradas,
    loading,
    busqueda, setBusqueda,
    filtroProg, setFiltroProg,
    filtroEst, setFiltroEst,
    updateObraLocal,
  } = useObras();
  const { user } = useAuth();

  const [obraModal, setObraModal] = useState(null);
  const [dgAbierta, setDgAbierta] = useState(null);
  const [programaAbierto, setProgramaAbierto] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const vistaPorDG = !user?.dg;

  const abrirModal = useCallback((obra) => setObraModal(obra), []);
  const cerrarModal = useCallback(() => setObraModal(null), []);

  // Función para actualizar obra inline
  const updateObraInline = useCallback(async (obra, nuevoPorcentaje) => {
    try {
      // Paso 1: iniciar edición
      const res1 = await obrasAPI.editar(obra.id, nuevoPorcentaje, "Actualización inline");
      const cambioId = res1.cambio_id;

      // Paso 2: confirmar step1
      await obrasAPI.confirmarStep1(obra.id, cambioId);

      // Paso 3: confirmar step2 con "CONFIRMO"
      const res3 = await obrasAPI.confirmarStep2(obra.id, cambioId, "CONFIRMO");

      // Actualizar estado local
      updateObraLocal(normalizeObra(res3.obra));

      return { success: true };
    } catch (error) {
      console.error("Error updating obra:", error);
      return { success: false, error: error.message };
    }
  }, [updateObraLocal]);

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

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
          <div className="mb-8 animate-fade-in">
            <div className="rounded-3xl p-6 lg:p-8 shadow-lg" style={{ background: "linear-gradient(135deg, #F7F3EE 0%, #EFE7DD 100%)", border: "1px solid rgba(201,166,107,0.25)" }}>
              <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "#8C6B41" }}>
                Centro De Control De Obras
              </p>
              <div className="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold" style={{ color: "#691C32" }}>Listado Ejecutivo</h1>
                  <p className="mt-2 text-sm lg:text-base" style={{ color: "#666666" }}>
                    {user?.dg
                      ? `${obrasFiltradas.length} obras correspondientes a la Dirección General ${user.dg}, agrupadas por programa.`
                      : `${obrasFiltradas.length} obras agrupadas en ${direcciones.length} direcciones generales para inspección jerárquica.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl px-4 py-4 shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.2)" }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#8C6B41" }}>
                      {user?.dg ? "Direccion General" : "Direcciones"}
                    </p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: "#2C2C2C" }}>
                      {user?.dg || direcciones.length}
                    </p>
                  </div>
                  <div className="rounded-2xl px-4 py-4 shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(201,166,107,0.2)" }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#8C6B41" }}>
                      {user?.dg ? "Programas" : "Obras filtradas"}
                    </p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: "#2C2C2C" }}>
                      {totalTarjetaSecundaria}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-3xl p-5 lg:p-6 mb-6 shadow-lg animate-fade-in"
            style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F7F3EE 100%)", border: "1px solid rgba(201,166,107,0.22)" }}
          >
            <div className="flex flex-col lg:flex-row gap-3">
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
                className="px-4 py-3 text-sm rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32] transition-colors"
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
                className="px-4 py-3 text-sm rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32] transition-colors"
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
            <div className="space-y-5 animate-fade-in">
              {vistaPorDG && direcciones.map((direccion) => (
                <section
                  key={direccion.direccion}
                  className="rounded-3xl overflow-hidden shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl"
                  style={{ border: "1px solid rgba(201,166,107,0.20)", backgroundColor: "#FFFFFF" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleDg(direccion.direccion)}
                    className="w-full text-left px-6 py-5"
                    style={{ background: "linear-gradient(135deg, #691C32 0%, #7E2843 60%, #4F0E21 100%)", color: "#FFF8F1" }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] font-semibold text-white/70">Direccion General</p>
                        <h2 className="mt-2 text-xl lg:text-2xl font-bold">{direccion.direccion}</h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                          {direccion.totalProgramas} programas
                        </span>
                        <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                          {direccion.totalObras} obras
                        </span>
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
                          {dgAbierta === direccion.direccion ? "−" : "+"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {dgAbierta === direccion.direccion && (
                    <div className="p-4 sm:p-5 lg:p-6 space-y-4" style={{ background: "linear-gradient(180deg, #FFFDFC 0%, #F7F3EE 100%)" }}>
                      {direccion.programas.map((programaItem) => {
                        const programaKey = `${direccion.direccion}::${programaItem.programa}`;

                        return (
                          <section
                            key={programaKey}
                            className="rounded-3xl overflow-hidden shadow-md transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
                            style={{ border: "1px solid rgba(201,166,107,0.28)", background: "linear-gradient(180deg, rgba(201,166,107,0.20) 0%, #FFFFFF 100%)" }}
                          >
                            <button
                              type="button"
                              onClick={() => togglePrograma(programaKey)}
                              className="w-full text-left px-5 py-5"
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.22em] font-semibold" style={{ color: "#8C6B41" }}>Programa</p>
                                  <h3 className="mt-2 text-lg font-bold" style={{ color: "#2C2C2C" }}>
                                    {programaItem.programa}
                                  </h3>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#5B4B3F", border: "1px solid rgba(201,166,107,0.28)" }}>
                                    {programaItem.resumen.total} obras
                                  </span>
                                  <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#5B4B3F", border: "1px solid rgba(201,166,107,0.28)" }}>
                                    {programaItem.resumen.promedio}% promedio
                                  </span>
                                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#8C6B41", border: "1px solid rgba(201,166,107,0.28)" }}>
                                    {programaAbierto === programaKey ? "−" : "+"}
                                  </span>
                                </div>
                              </div>
                            </button>

                            {programaAbierto === programaKey && (
                              <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t" style={{ borderColor: "rgba(201,166,107,0.20)" }}>
                                {programaItem.obras.map((obra, index) => (
                                  <ObraRow
                                    key={getObraKey(obra, index)}
                                    obra={obra}
                                    abrirModal={abrirModal}
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
                    className="rounded-3xl overflow-hidden shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl"
                    style={{ border: "1px solid rgba(201,166,107,0.20)", backgroundColor: "#FFFFFF" }}
                  >
                    <button
                      type="button"
                      onClick={() => togglePrograma(programaKey)}
                      className="w-full text-left px-6 py-5"
                      style={{ background: "linear-gradient(180deg, rgba(201,166,107,0.22) 0%, #FFFFFF 100%)" }}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] font-semibold" style={{ color: "#8C6B41" }}>Programa</p>
                          <h3 className="mt-2 text-xl font-bold" style={{ color: "#2C2C2C" }}>
                            {programaItem.programa}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#5B4B3F", border: "1px solid rgba(201,166,107,0.28)" }}>
                            {programaItem.resumen.total} obras
                          </span>
                          <span className="px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#5B4B3F", border: "1px solid rgba(201,166,107,0.28)" }}>
                            {programaItem.resumen.promedio}% promedio
                          </span>
                          <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-semibold" style={{ backgroundColor: "#FFFFFF", color: "#8C6B41", border: "1px solid rgba(201,166,107,0.28)" }}>
                            {programaAbierto === programaKey ? "−" : "+"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {programaAbierto === programaKey && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t" style={{ borderColor: "rgba(201,166,107,0.20)" }}>
                        {programaItem.obras.map((obra, index) => (
                          <ObraRow
                            key={getObraKey(obra, index)}
                            obra={obra}
                            abrirModal={abrirModal}
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
    </div>
  );
}

function ObraRow({ obra, abrirModal, editingId, setEditingId, updateObraInline, direccionVisible }) {
  const [nuevoAvance, setNuevoAvance] = useState(obra.porcentaje || 0);
  const [inputValue, setInputValue] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);

  const isEditing = editingId === obra.id;

  const startEdit = useCallback(() => {
    const currentValue = obra.porcentaje || 0;
    setNuevoAvance(currentValue);
    setInputValue(currentValue === 0 ? "" : String(currentValue));
    setEditingId(obra.id);
  }, [obra.id, obra.porcentaje, setEditingId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setInputValue("");
  }, [setEditingId]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setInputValue(val);
    }
  }, []);

  const confirmEdit = useCallback(async () => {
    const finalValue = parseFloat(inputValue || 0);
    if (finalValue === obra.porcentaje) {
      cancelEdit();
      return;
    }
    setUpdating(true);
    const result = await updateObraInline(obra, finalValue);
    setUpdating(false);
    if (result.success) {
      setUpdated(true);
      setEditingId(null);
      setInputValue("");
      setTimeout(() => setUpdated(false), 2000);
    } else {
      // Handle error
      console.error(result.error);
    }
  }, [inputValue, obra, updateObraInline, cancelEdit, setEditingId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      confirmEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }, [confirmEdit, cancelEdit]);

  return (
    <div
      className={`mt-4 rounded-2xl px-4 py-4 lg:px-5 lg:py-5 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg ${
        updated ? "bg-green-50 border-green-200 scale-105 shadow-green-200" : ""
      }`}
      style={{
        backgroundColor: updated ? "#F0FFF4" : "#FFFFFF",
        border: updated ? "1px solid #68D391" : "1px solid rgba(201,166,107,0.16)",
        boxShadow: updated ? "0 10px 24px rgba(72,187,120,0.3)" : "0 10px 24px rgba(76,57,35,0.06)"
      }}
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base leading-tight" style={{ color: "#2C2C2C" }}>
            {obra.nombre || "SIN NOMBRE"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "#666666" }}>
            <span>{direccionVisible || obra.direccion_general || "SIN DIRECCION"}</span>
            <span>{formatearFechaHora(obra.ultimaActualizacion)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end xl:min-w-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeEstado estado={obra.estado} />
            {isEditing ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={confirmEdit}
                  disabled={updating}
                >
                  {updating ? "Guardando..." : "Confirmar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  disabled={updating}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant={obra.estado === "actualizada" ? "secondary" : "primary"}
                onClick={startEdit}
                aria-label={`Actualizar ${obra.nombre}`}
              >
                Actualizar
              </Button>
            )}
          </div>
          {isEditing ? (
            <div className="flex items-center gap-3 min-w-[180px]">
              <input
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-sm border rounded"
                autoFocus
                placeholder="0"
              />
              <span className="text-sm font-bold w-11 text-right" style={{ color: "#2C2C2C" }}>%</span>
              <div className="flex-1 rounded-full h-4 overflow-hidden" style={{ backgroundColor: "#F0ECE5" }}>
                <div
                  className={`h-4 rounded-full ${colorBarra(parseFloat(inputValue || 0))} transition-all duration-300`}
                  style={{ width: `${parseFloat(inputValue || 0)}%` }}
                />
              </div>
            </div>
          ) : (
            <BarraPct pct={Number(obra.porcentaje || 0)} />
          )}
          {updated && (
            <div className="text-xs text-green-600 font-semibold animate-pulse">
              ✓ Actualizado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
