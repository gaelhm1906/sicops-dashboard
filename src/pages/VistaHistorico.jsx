import React, { useState, useEffect, useCallback } from "react";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Button from "../components/Shared/Button";
import { obrasAPI, reportesAPI } from "../utils/api";
import { exportarCorte } from "../utils/exporters";
import { formatearFechaLarga } from "../utils/formatters";

/* Normaliza la respuesta de GET /api/obras/historico?periodo=X */
function normalizeCorte(data) {
  return {
    periodo:        data.periodo,
    fechaCierre:    data.fecha_cierre,
    totalObras:     data.resumen?.total_obras     ?? 0,
    actualizadas:   data.resumen?.actualizadas    ?? 0,
    noActualizadas: data.resumen?.no_actualizadas ?? 0,
    obras: (data.snapshot_obras || []).map((s) => ({
      id:         s.id,
      nombre:     s.nombre     || `Obra #${s.id}`,
      programa:   s.programa   || "—",
      porcentaje: s.porcentaje_avance ?? 0,
      estado:     s.estado,
      usuario:    s.confirmado_por   || null,
    })),
  };
}

export default function VistaHistorico() {
  const [periodos,  setPeriodos]  = useState([]);   // lista de períodos disponibles
  const [periodoId, setPeriodoId] = useState("");   // período seleccionado
  const [corte,     setCorte]     = useState(null); // datos del corte actual
  const [loadingP,  setLoadingP]  = useState(true); // cargando lista de períodos
  const [loadingC,  setLoadingC]  = useState(false);// cargando corte seleccionado
  const [errorMsg,  setErrorMsg]  = useState("");

  /* Cargar lista de períodos al montar */
  useEffect(() => {
    setLoadingP(true);
    reportesAPI.getPeriodos()
      .then((res) => setPeriodos(res.data || []))
      .catch((err) => setErrorMsg(err.message || "Error al cargar los períodos"))
      .finally(() => setLoadingP(false));
  }, []);

  /* Cargar detalle del corte cuando cambia periodoId */
  useEffect(() => {
    if (!periodoId) { setCorte(null); return; }

    setLoadingC(true);
    setErrorMsg("");
    obrasAPI.getHistorico(periodoId)
      .then((res) => setCorte(normalizeCorte(res.data)))
      .catch((err) => {
        setErrorMsg(err.message || "Error al cargar el histórico");
        setCorte(null);
      })
      .finally(() => setLoadingC(false));
  }, [periodoId]);

  const pctActualizadas = corte
    ? Math.round((corte.actualizadas / Math.max(corte.totalObras, 1)) * 100)
    : 0;

  const handleCSV  = useCallback(() => corte && exportarCorte(corte, "csv"),  [corte]);
  const handleJSON = useCallback(() => corte && exportarCorte(corte, "json"), [corte]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F5F3F0" }}>
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">

          {/* Título */}
          <div className="mb-6 animate-fade-in">
            <h1 className="text-2xl font-bold" style={{ color: "#691C32" }}>Histórico de cortes</h1>
            <p className="text-sm mt-1" style={{ color: "#666666" }}>Consulta los datos de cortes anteriores</p>
          </div>

          {/* Selector de corte */}
          <div className="bg-white rounded-xl p-4 mb-6 animate-fade-in"
            style={{ border: "1px solid #D4C4B0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <label htmlFor="selector-corte" className="block text-sm font-medium mb-2" style={{ color: "#2C2C2C" }}>
              Seleccionar período
            </label>

            {loadingP ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
                Cargando períodos...
              </div>
            ) : (
              <select
                id="selector-corte"
                value={periodoId}
                onChange={(e) => setPeriodoId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 text-sm rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#691C32] focus:border-[#691C32]"
                style={{ border: "1px solid #D4C4B0", color: "#2C2C2C" }}
                aria-label="Seleccionar período histórico"
              >
                <option value="">-- Seleccione un período --</option>
                {periodos.map((p) => (
                  <option key={p.periodo} value={p.periodo}>
                    {p.periodo}
                    {p.resumen ? ` — ${p.resumen.actualizadas}/${p.resumen.total_obras} actualizadas` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700 animate-fade-in">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Sin selección */}
          {!periodoId && !loadingP && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center animate-fade-in">
              <span className="text-4xl mb-4 block">📅</span>
              <p className="text-gray-500 font-medium">Sin cortes seleccionados</p>
              <p className="text-gray-400 text-sm mt-1">Seleccione un período del dropdown para ver el histórico.</p>
            </div>
          )}

          {/* Cargando corte */}
          {loadingC && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#691C32", borderTopColor: "transparent" }} />
            </div>
          )}

          {/* Datos del corte */}
          {!loadingC && corte && (
            <div className="animate-fade-in space-y-6">

              {/* Resumen del corte */}
              <div className="bg-white rounded-2xl p-6"
                style={{ border: "1px solid #D4C4B0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: "#691C32" }}>Corte: {corte.periodo}</h2>
                    <p className="text-sm mt-0.5" style={{ color: "#666666" }}>
                      Fecha cierre: {formatearFechaLarga(corte.fechaCierre)},{" "}
                      {new Date(corte.fechaCierre).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Botones descarga */}
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" size="sm" onClick={handleCSV}  aria-label="Descargar reporte CSV">
                      ⬇ CSV
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleJSON} aria-label="Descargar reporte JSON">
                      ⬇ JSON
                    </Button>
                  </div>
                </div>

                {/* Stats del corte */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "Total obras",     valor: corte.totalObras,      color: "#2C2C2C"  },
                    { label: "Actualizadas",    valor: corte.actualizadas,    color: "#006341"  },
                    { label: "No actualizadas", valor: corte.noActualizadas,  color: "#691C32"  },
                    { label: "% Completado",    valor: `${pctActualizadas}%`, color: "#691C32"  },
                  ].map(({ label, valor, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: "#FAFAF8" }}>
                      <p className="text-2xl font-bold" style={{ color }}>{valor}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Barra global */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: "#666666" }}>
                    <span>Completado</span>
                    <span className="font-semibold" style={{ color: "#691C32" }}>{pctActualizadas}%</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "#F5F3F0" }}>
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${pctActualizadas}%`, backgroundColor: "#006341" }}
                    />
                  </div>
                </div>
              </div>

              {/* Tabla obras del corte */}
              <div className="bg-white rounded-2xl overflow-hidden"
                style={{ border: "1px solid #D4C4B0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <div className="px-6 py-4" style={{ borderBottom: "1px solid #D4C4B0" }}>
                  <h3 className="font-semibold" style={{ color: "#2C2C2C" }}>
                    Detalle por obra
                    <span className="ml-2 text-xs font-normal text-gray-400">({corte.obras.length} obras)</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: "#FAFAF8", borderBottom: "1px solid #D4C4B0" }}>
                      <tr>
                        {["Obra", "Programa", "% en corte", "Estado", "Usuario"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                            style={{ color: "#666666" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {corte.obras.map((co) => {
                        const pctColor =
                          co.porcentaje >= 80 ? "#006341" :
                          co.porcentaje >= 50 ? "#C9A66B" : "#691C32";
                        return (
                          <tr key={co.id} className="transition-colors"
                            style={{ borderBottom: "1px solid rgba(212,196,176,0.4)" }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F5F3F0"; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <td className="px-4 py-4">
                              <p className="font-medium text-sm" style={{ color: "#2C2C2C" }}>{co.nombre}</p>
                            </td>
                            <td className="px-4 py-4 hidden md:table-cell">
                              <span className="text-xs px-2 py-1 rounded-full"
                                style={{ backgroundColor: "rgba(212,196,176,0.25)", color: "#666666" }}>
                                {co.programa}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 rounded-full h-1.5 hidden sm:block overflow-hidden"
                                  style={{ backgroundColor: "#F5F3F0" }}>
                                  <div
                                    className="h-1.5 rounded-full"
                                    style={{
                                      width: `${co.porcentaje}%`,
                                      backgroundColor: co.porcentaje >= 80 ? "#006341" : co.porcentaje >= 50 ? "#F4B860" : "#E8A8A8",
                                    }}
                                  />
                                </div>
                                <span className="font-bold text-sm" style={{ color: pctColor }}>{co.porcentaje}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 hidden sm:table-cell">
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                                style={{
                                  backgroundColor: co.estado === "actualizada" ? "#006341"
                                    : co.estado === "en_progreso" ? "rgba(244,184,96,0.25)"
                                    : "rgba(232,168,168,0.3)",
                                  color: co.estado === "actualizada" ? "#FFFFFF"
                                    : co.estado === "en_progreso" ? "#7A5A00"
                                    : "#691C32",
                                }}>
                                {co.estado === "actualizada" ? "Actualizada"
                                : co.estado === "en_progreso" ? "En progreso"
                                : "Pendiente"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs" style={{ color: "#666666" }}>
                              {co.usuario || (
                                <span className="italic" style={{ color: "#E8A8A8" }}>Sin actualizar</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      <Footer />
    </div>
  );
}
