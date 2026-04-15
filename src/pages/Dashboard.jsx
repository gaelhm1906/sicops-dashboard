import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useObras } from "../context/ObraContext";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import CardResumen from "../components/Cards/CardResumen";
import Button from "../components/Shared/Button";
import OrchestradorPanel from "../components/OrchestradorPanel";
import { controlAPI } from "../utils/api";

const DIAS_SIN_ACTUALIZACION = 3;

function getEstadoRiesgo(pct) {
  if (pct >= 80) return { label: "En control", color: "#006341" };
  if (pct >= 50) return { label: "Riesgo moderado", color: "#C9A66B" };
  return { label: "Critico", color: "#691C32" };
}

function getDiasSinActualizar(fecha) {
  if (!fecha) return null;
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obras, stats, loading, fuente } = useObras();

  const [ahora, setAhora] = useState(new Date());
  const [sistemaInfo, setSistema] = useState(null);
  const [loadingSistema, setLoadSist] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setLoadSist(true);
    controlAPI.getEstado()
      .then((res) => setSistema(res))
      .catch(() => setSistema(null))
      .finally(() => setLoadSist(false));
  }, []);

  const sistemaAbierto = sistemaInfo
    ? sistemaInfo.abierto
    : ahora.getHours() < 12;

  const horaFormateada = ahora.toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const tiempoRestante = sistemaInfo?.tiempoRestanteMinutos;
  const formatearRestante = () => {
    if (!tiempoRestante || tiempoRestante <= 0) return null;
    const h = Math.floor(tiempoRestante / 60);
    const m = tiempoRestante % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleVerObras = useCallback(() => navigate("/obras"), [navigate]);

  const obrasSinActualizacion = useMemo(() => {
    return [...obras]
      .map((obra) => {
        const diasSinActualizar = getDiasSinActualizar(obra.ultimaActualizacion);
        const sinActualizacion = diasSinActualizar === null || diasSinActualizar > DIAS_SIN_ACTUALIZACION;
        return { ...obra, diasSinActualizar, sinActualizacion };
      })
      .filter((obra) => obra.sinActualizacion)
      .sort((a, b) => {
        const diasA = a.diasSinActualizar ?? Number.POSITIVE_INFINITY;
        const diasB = b.diasSinActualizar ?? Number.POSITIVE_INFINITY;
        return diasB - diasA;
      })
      .slice(0, 5);
  }, [obras]);

  const riesgo = getEstadoRiesgo(stats.pct);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F3F2EF" }}>
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#691C32", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#666666" }}>Cargando centro de control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #F3F2EF 0%, #ECE9E2 100%)" }}>
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
          <div className="mb-8 animate-fade-in">
            <div className="rounded-3xl p-6 lg:p-8 shadow-lg transition-all duration-300" style={{ background: "linear-gradient(135deg, #F7F3EE 0%, #EFE7DD 48%, #E5DACB 100%)", border: "1px solid rgba(201,166,107,0.35)" }}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "#8C6B41" }}>
                    Centro De Control Ejecutivo
                  </p>
                  <h1 className="mt-3 text-3xl lg:text-4xl font-bold" style={{ color: "#691C32" }}>
                    SICOPS SOBSE
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm lg:text-base" style={{ color: "#6B6762" }}>
                    Supervisión institucional de obra pública con trazabilidad operativa, seguimiento por programa y lectura ejecutiva del avance real.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full lg:min-w-[540px]">
                  <div className="rounded-2xl px-4 py-4 shadow-md" style={{ backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid rgba(201,166,107,0.22)" }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#8C6B41" }}>Fuente</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "#2C2C2C" }}>
                      {fuente === "postgresql" ? "PostgreSQL" : "Local"}
                    </p>
                  </div>
                  <div className="rounded-2xl px-4 py-4 shadow-md" style={{ backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid rgba(201,166,107,0.22)" }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#8C6B41" }}>Reloj operativo</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "#2C2C2C" }}>{horaFormateada}</p>
                  </div>
                  <div className="rounded-2xl px-4 py-4 shadow-md" style={{ backgroundColor: sistemaAbierto ? "rgba(0,99,65,0.08)" : "rgba(105,28,50,0.08)", border: `1px solid ${sistemaAbierto ? "rgba(0,99,65,0.18)" : "rgba(105,28,50,0.18)"}` }}>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: sistemaAbierto ? "#006341" : "#691C32" }}>Estado del sistema</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: sistemaAbierto ? "#006341" : "#691C32" }}>
                      {loadingSistema ? "Verificando..." : sistemaAbierto ? "Abierto" : "Cerrado"}
                    </p>
                    {sistemaAbierto && formatearRestante() && (
                      <p className="text-xs mt-1" style={{ color: "#006341" }}>Cierre en {formatearRestante()}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-6 mb-6">
            <section
              className="rounded-3xl p-7 lg:p-8 shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl animate-fade-in"
              style={{ background: "linear-gradient(135deg, #691C32 0%, #7F2742 42%, #4F0E21 100%)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] font-semibold text-white/70">Total de obras</p>
                  <p className="mt-5 text-5xl lg:text-6xl font-bold text-white">{stats.total}</p>
                  <p className="mt-3 text-sm lg:text-base text-white/75">Obras registradas en el corte operativo actual</p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  ▣
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Usuario activo</p>
                  <p className="mt-2 text-lg font-semibold text-white">{user?.nombre || "Administrador"}</p>
                </div>
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Periodo</p>
                  <p className="mt-2 text-lg font-semibold text-white">{sistemaInfo?.periodo_actual || "Operacion diaria"}</p>
                </div>
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Estado</p>
                  <p className="mt-2 text-lg font-semibold text-white">{riesgo.label}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4">
              <CardResumen
                titulo="Actualizadas"
                valor={stats.actualizadas}
                subtitulo={`${stats.total ? Math.round((stats.actualizadas / stats.total) * 100) : 0}% del universo monitoreado`}
                icono="OK"
                colorClase="text-[#006341]"
                bgClase="bg-[rgba(0,99,65,0.10)]"
                borderColor="#006341"
                progressValue={stats.total ? Math.round((stats.actualizadas / stats.total) * 100) : 0}
                progressColor="#006341"
              />
              <CardResumen
                titulo="En proceso"
                valor={stats.enProgreso}
                subtitulo={`${stats.total ? Math.round((stats.enProgreso / stats.total) * 100) : 0}% del universo monitoreado`}
                icono="EP"
                colorClase="text-[#8C6B41]"
                bgClase="bg-[rgba(201,166,107,0.14)]"
                borderColor="#C9A66B"
                progressValue={stats.total ? Math.round((stats.enProgreso / stats.total) * 100) : 0}
                progressColor="#C9A66B"
              />
              <CardResumen
                titulo="Pendientes"
                valor={stats.pendientes}
                subtitulo={`${stats.total ? Math.round((stats.pendientes / stats.total) * 100) : 0}% con atencion requerida`}
                icono="AT"
                colorClase="text-[#691C32]"
                bgClase="bg-[rgba(105,28,50,0.08)]"
                borderColor="#691C32"
                progressValue={stats.total ? Math.round((stats.pendientes / stats.total) * 100) : 0}
                progressColor="#691C32"
              />
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-6 mb-8">
            <section
              className="rounded-3xl p-6 lg:p-7 shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl animate-fade-in"
              style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F7F3EE 100%)", border: "1px solid rgba(201,166,107,0.24)" }}
            >
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] font-semibold" style={{ color: "#8C6B41" }}>Modulo protagonista</p>
                  <h2 className="mt-2 text-2xl font-bold" style={{ color: "#2C2C2C" }}>Avance global del corte</h2>
                  <p className="mt-1 text-sm" style={{ color: "#666666" }}>
                    {stats.actualizadas} obras actualizadas de un universo de {stats.total}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl lg:text-5xl font-bold" style={{ color: "#691C32" }}>{stats.pct}%</p>
                  <span
                    className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${riesgo.color}14`, color: riesgo.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riesgo.color }} />
                    {riesgo.label}
                  </span>
                </div>
              </div>

              <div className="rounded-full h-5 overflow-hidden" style={{ backgroundColor: "#E9E5DD" }}>
                <div
                  className="h-5 rounded-full transition-all duration-700"
                  style={{
                    width: `${stats.pct}%`,
                    background: "linear-gradient(90deg, #691C32 0%, #C9A66B 52%, #006341 100%)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(0,99,65,0.06)" }}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#006341" }}>Fortaleza</p>
                  <p className="mt-2 text-lg font-semibold" style={{ color: "#2C2C2C" }}>{stats.actualizadas}</p>
                  <p className="text-xs mt-1" style={{ color: "#666666" }}>frentes actualizados</p>
                </div>
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(201,166,107,0.12)" }}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#8C6B41" }}>Seguimiento</p>
                  <p className="mt-2 text-lg font-semibold" style={{ color: "#2C2C2C" }}>{stats.enProgreso}</p>
                  <p className="text-xs mt-1" style={{ color: "#666666" }}>obras en proceso</p>
                </div>
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "rgba(105,28,50,0.08)" }}>
                  <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "#691C32" }}>Atencion</p>
                  <p className="mt-2 text-lg font-semibold" style={{ color: "#2C2C2C" }}>{stats.pendientes}</p>
                  <p className="text-xs mt-1" style={{ color: "#666666" }}>pendientes de actualización</p>
                </div>
              </div>
            </section>

            <section
              className="rounded-3xl p-6 lg:p-7 shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl animate-fade-in"
              style={{ background: "linear-gradient(180deg, rgba(105,28,50,0.06) 0%, rgba(255,255,255,0.98) 100%)", border: "1px solid rgba(105,28,50,0.14)" }}
            >
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] font-semibold" style={{ color: "#691C32" }}>Alertas</p>
                  <h2 className="mt-2 text-2xl font-bold" style={{ color: "#2C2C2C" }}>Obras sin actualización reciente</h2>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(105,28,50,0.10)", color: "#691C32" }}>
                  !
                </div>
              </div>

              <div className="space-y-3">
                {obrasSinActualizacion.map((obra, index) => (
                  <div
                    key={`${obra.nombre}-${index}`}
                    className="rounded-2xl px-4 py-4 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(105,28,50,0.10)", boxShadow: "0 6px 18px rgba(60,43,28,0.05)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#2C2C2C" }}>{obra.nombre}</p>
                        <p className="text-xs mt-1 truncate" style={{ color: "#666666" }}>{obra.programa || "Sin programa"}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ backgroundColor: "rgba(105,28,50,0.10)", color: "#691C32" }}
                          >
                            Sin actualización
                          </span>
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ backgroundColor: "rgba(105,28,50,0.06)", color: "#691C32" }}
                          >
                            {obra.diasSinActualizar === null ? "Sin fecha válida" : `${obra.diasSinActualizar} día(s) sin actualizar`}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold shrink-0 px-3 py-1.5 rounded-full" style={{ color: "#691C32", backgroundColor: "rgba(105,28,50,0.08)" }}>
                        {obra.diasSinActualizar === null ? "Pendiente" : `${obra.diasSinActualizar} días`}
                      </span>
                    </div>
                    <div className="mt-3 rounded-full h-3 overflow-hidden" style={{ backgroundColor: "#F1E6E8" }}>
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ((obra.diasSinActualizar ?? (DIAS_SIN_ACTUALIZACION + 1)) / DIAS_SIN_ACTUALIZACION) * 100)}%`,
                          backgroundColor: "#691C32",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {obrasSinActualizacion.length === 0 && (
                  <div
                    className="rounded-2xl px-4 py-5"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,99,65,0.12)" }}
                  >
                    <p className="text-sm font-semibold" style={{ color: "#006341" }}>Sin alertas de actualización</p>
                    <p className="text-xs mt-1" style={{ color: "#666666" }}>
                      Todas las obras visibles cuentan con una actualización válida dentro de los últimos {DIAS_SIN_ACTUALIZACION} días.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div
            className="rounded-3xl p-6 lg:p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 shadow-lg transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F7F3EE 100%)", border: "1px solid rgba(201,166,107,0.24)" }}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-semibold" style={{ color: "#8C6B41" }}>Acción ejecutiva</p>
              <h3 className="mt-2 text-2xl font-bold" style={{ color: "#2C2C2C" }}>Revisar el universo completo de obras</h3>
              <p className="mt-2 text-sm max-w-3xl" style={{ color: "#666666" }}>
                Navega al listado jerárquico para inspeccionar Direcciones Generales, Programas y frentes de obra con capacidad de actualización inmediata.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleVerObras}
              className="shrink-0"
              aria-label="Ir al listado completo de obras"
            >
              Ver listado ejecutivo
            </Button>
          </div>

          <OrchestradorPanel />
        </main>
      </div>

      <Footer />
    </div>
  );
}
