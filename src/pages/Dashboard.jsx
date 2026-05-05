import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useObras } from "../context/ObraContext";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import CardResumen from "../components/Cards/CardResumen";
import Button from "../components/Shared/Button";
import { getEstadoSistema, getSemanaInfo } from "../utils/api";

const DIAS_SIN_ACTUALIZACION = 3;
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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
  const { obras, obrasRaw, loading } = useObras();

  const [ahora, setAhora] = useState(new Date());
  const [sistemaAbierto, setSistemaAbierto] = useState(true);
  const [loadingSistema, setLoadSist] = useState(true);
  const [semanaInfo, setSemanaInfo] = useState({ semana_activa: 1, nombre: "SEMANA 1 DE ACTUALIZACIÓN" });
  const [dgSeleccionada, setDgSeleccionada] = useState("");

  const dgsList = useMemo(() => {
    const set = new Set();
    (obrasRaw || obras).forEach((o) => {
      const dg = (o.direccion_general || "").toUpperCase().trim();
      if (dg) set.add(dg);
    });
    return [...set].sort();
  }, [obrasRaw, obras]);

  const obrasDG = useMemo(() => {
    const base = obrasRaw || obras;
    if (!dgSeleccionada) return base;
    return base.filter((o) =>
      (o.direccion_general || "").toUpperCase().includes(dgSeleccionada.toUpperCase())
    );
  }, [obrasRaw, obras, dgSeleccionada]);

  const statsDG = useMemo(() => {
    const av  = (o) => Number(o.avance ?? o.avance_real ?? o.porcentaje ?? 0);
    const est = (o) => String(o.estatus || o.estado || "").toUpperCase().trim();
    const esCancelada = (o) => est(o).includes("CANCELAD");

    const canceladas   = obrasDG.filter(esCancelada).length;
    const noCanceladas = obrasDG.filter((o) => !esCancelada(o));

    const inauguradas = noCanceladas.filter((o) =>
      est(o).includes("INAUGURAD") || est(o).includes("ENTREGAD")
    ).length;
    const terminadas = noCanceladas.filter((o) =>
      est(o) === "TERMINADO" || est(o) === "TERMINADA"
    ).length;
    const enProceso  = noCanceladas.filter((o) => est(o) === "EN PROCESO").length;
    const sinIniciarBase = noCanceladas.filter((o) =>
      est(o) === "SIN INICIAR" || est(o) === ""
    ).length;
    const sinIniciar = sinIniciarBase + canceladas;

    const sumAvance = noCanceladas.reduce((acc, o) => acc + av(o), 0);
    const pct = noCanceladas.length > 0 ? Math.round(sumAvance / noCanceladas.length) : 0;
    const total = obrasDG.length;

    return { total, inauguradas, terminadas, enProceso, sinIniciar, canceladas, pct };
  }, [obrasDG]);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setLoadSist(true);
    getEstadoSistema()
      .then((abierto) => setSistemaAbierto(abierto))
      .catch(() => setSistemaAbierto(true))
      .finally(() => setLoadSist(false));
  }, []);

  useEffect(() => {
    getSemanaInfo().then((info) => setSemanaInfo(info)).catch(() => {});
  }, []);

  const horaFormateada = ahora.toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const fechaFormateada = `${ahora.getDate()} ${MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;


  const handleVerObras = useCallback(() => navigate("/obras"), [navigate]);

  const obrasSinActualizacion = useMemo(() => {
    return [...obrasDG]
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
  }, [obrasDG]);

  const riesgo = getEstadoRiesgo(statsDG.pct);

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

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto w-full">

          {/* Banner de semana activa */}
          <div className="mb-2 animate-fade-in">
            <div
              className="rounded-2xl px-5 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              style={{
                background: "linear-gradient(135deg, #691C32 0%, #9B2335 100%)",
                boxShadow: "0 4px 14px rgba(105,28,50,0.35)",
              }}
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Período de actualización
                  </p>
                  <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>
                    {semanaInfo.nombre || `SEMANA ${semanaInfo.semana_activa} DE ACTUALIZACIÓN`}
                  </p>
                </div>
              </div>
              <span
                className="self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.35)" }}
              >
                SEMANA {semanaInfo.semana_activa}
              </span>
            </div>
          </div>

          {/* Header institucional */}
          <div className="mb-3 animate-fade-in">
            <div className="rounded-2xl px-5 py-3 shadow-md" style={{ background: "linear-gradient(135deg, #F7F3EE 0%, #EFE7DD 100%)", border: "1px solid rgba(201,166,107,0.35)" }}>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <h1 className="text-xl lg:text-2xl font-bold" style={{ color: "#691C32" }}>
                  Seguimiento Obras 2025
                </h1>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid rgba(201,166,107,0.22)" }}>
                    <p className="text-xs" style={{ color: "#8C6B41" }}>Reloj operativo</p>
                    <p className="text-sm font-semibold" style={{ color: "#2C2C2C" }}>{horaFormateada}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: sistemaAbierto ? "rgba(0,99,65,0.08)" : "rgba(105,28,50,0.08)", border: `1px solid ${sistemaAbierto ? "rgba(0,99,65,0.18)" : "rgba(105,28,50,0.18)"}` }}>
                    <p className="text-xs" style={{ color: sistemaAbierto ? "#006341" : "#691C32" }}>Sistema</p>
                    <p className="text-sm font-semibold" style={{ color: sistemaAbierto ? "#006341" : "#691C32" }}>
                      {loadingSistema ? "Verificando..." : sistemaAbierto ? "Abierto" : "Cerrado"}
                    </p>
                  </div>
                </div>
              </div>
              {user?.rol === "ADMIN" && dgsList.length > 0 && (
                <div className="flex items-center gap-2 pt-2 mt-2 border-t" style={{ borderColor: "rgba(201,166,107,0.22)" }}>
                  <span className="text-xs font-semibold" style={{ color: "#8C6B41" }}>
                    Dirección General:
                  </span>
                  <select
                    value={dgSeleccionada}
                    onChange={(e) => setDgSeleccionada(e.target.value)}
                    className="text-xs rounded-lg px-2 py-1 border font-medium cursor-pointer"
                    style={{ borderColor: "rgba(201,166,107,0.45)", backgroundColor: "white", color: "#374151", outline: "none" }}
                  >
                    <option value="">Todas las DGs</option>
                    {dgsList.map((dg) => (
                      <option key={dg} value={dg}>{dg}</option>
                    ))}
                  </select>
                  {dgSeleccionada && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: "rgba(105,28,50,0.10)", color: "#691C32" }}
                    >
                      {statsDG.total} obras
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Grid principal: izquierda (tarjeta + alertas) | derecha (KPIs) */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-3 mb-3 xl:items-start">

            {/* Columna izquierda */}
            <div className="flex flex-col gap-2">

              {/* Tarjeta principal — blanca, moderna */}
              <section
                className="rounded-2xl animate-fade-in flex flex-col gap-3"
                style={{ background: "#ffffff", boxShadow: "0 6px 18px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0", padding: "16px" }}
              >
                {/* BLOQUE SUPERIOR: Total + meta-info */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] font-semibold" style={{ color: "#9ca3af" }}>Total de obras</p>
                      <p className="mt-1 font-bold leading-none" style={{ fontSize: "42px", color: "#1f2937" }}>{statsDG.total}</p>
                      <p className="mt-1 text-xs" style={{ color: "#6b7280" }}>Corte operativo actual</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "#f3f4f6", color: "#691C32" }}>
                      ▣
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#f9fafb" }}>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>Usuario</p>
                      <p className="mt-0.5 text-sm font-semibold truncate" style={{ color: "#374151" }}>{user?.nombre || "Administrador"}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#f9fafb" }}>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>Semana</p>
                      <p className="mt-0.5 text-sm font-semibold" style={{ color: "#374151" }}>Semana {semanaInfo.semana_activa}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#f9fafb" }}>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>Fecha</p>
                      <p className="mt-0.5 text-sm font-semibold truncate" style={{ color: "#374151" }}>{fechaFormateada}</p>
                    </div>
                  </div>
                </div>

                {/* BLOQUE MEDIO: Avance global */}
                <div className="flex flex-col gap-2">
                  <div className="border-t" style={{ borderColor: "#f3f4f6" }} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: "#9ca3af" }}>Avance global del corte</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: "#1f2937" }}>{statsDG.pct}%</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${riesgo.color}18`, color: riesgo.color }}>
                        {riesgo.label}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: "10px", backgroundColor: "#e5e7eb" }}>
                    <div
                      className="rounded-full transition-all duration-700"
                      style={{
                        height: "10px",
                        width: `${statsDG.pct}%`,
                        background: "linear-gradient(90deg, #7c2d12 0%, #16a34a 100%)",
                      }}
                    />
                  </div>
                </div>

                {/* BLOQUE INFERIOR: Mini KPIs */}
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-[68px] rounded-xl px-3 py-3" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <p className="text-xs font-medium" style={{ color: "#1d4ed8" }}>Inauguradas</p>
                    <p className="mt-0.5 text-base font-bold" style={{ color: "#1e40af" }}>{statsDG.inauguradas}</p>
                  </div>
                  <div className="flex-1 min-w-[68px] rounded-xl px-3 py-3" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <p className="text-xs font-medium" style={{ color: "#15803d" }}>Terminadas</p>
                    <p className="mt-0.5 text-base font-bold" style={{ color: "#166534" }}>{statsDG.terminadas}</p>
                  </div>
                  <div className="flex-1 min-w-[68px] rounded-xl px-3 py-3" style={{ backgroundColor: "#fefce8", border: "1px solid #fde68a" }}>
                    <p className="text-xs font-medium" style={{ color: "#92400e" }}>En proceso</p>
                    <p className="mt-0.5 text-base font-bold" style={{ color: "#78350f" }}>{statsDG.enProceso}</p>
                  </div>
                  <div className="flex-1 min-w-[68px] rounded-xl px-3 py-3" style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3" }}>
                    <p className="text-xs font-medium" style={{ color: "#be123c" }}>Sin iniciar</p>
                    <p className="mt-0.5 text-base font-bold" style={{ color: "#9f1239" }}>{statsDG.sinIniciar}</p>
                  </div>
                  {statsDG.canceladas > 0 && (
                    <div className="flex-1 min-w-[68px] rounded-xl px-3 py-3" style={{ backgroundColor: "#fff5f5", border: "2px solid #ef4444" }}>
                      <p className="text-xs font-medium" style={{ color: "#b91c1c" }}>Canceladas</p>
                      <p className="mt-0.5 text-base font-bold" style={{ color: "#991b1b" }}>{statsDG.canceladas}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Alertas — dentro de la columna izquierda */}
              <section
                className="rounded-2xl p-4 shadow-md animate-fade-in"
                style={{ background: "linear-gradient(180deg, rgba(105,28,50,0.06) 0%, rgba(255,255,255,0.98) 100%)", border: "1px solid rgba(105,28,50,0.14)" }}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] font-semibold" style={{ color: "#691C32" }}>Alertas</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: "#2C2C2C" }}>Sin actualización reciente</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(105,28,50,0.10)", color: "#691C32" }}>!</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {obrasSinActualizacion.map((obra, index) => (
                    <div
                      key={`${obra.nombre}-${index}`}
                      className="rounded-xl px-3 py-3"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(105,28,50,0.10)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "#2C2C2C" }}>{obra.nombre}</p>
                          <p className="text-xs truncate" style={{ color: "#999" }}>{obra.programa || "Sin programa"}</p>
                        </div>
                        <span className="text-xs font-semibold shrink-0" style={{ color: "#691C32" }}>
                          {obra.diasSinActualizar === null ? "—" : `${obra.diasSinActualizar}d`}
                        </span>
                      </div>
                      <div className="mt-2 rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: "#F1E6E8" }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, ((obra.diasSinActualizar ?? (DIAS_SIN_ACTUALIZACION + 1)) / DIAS_SIN_ACTUALIZACION) * 100)}%`,
                            backgroundColor: "#691C32",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {obrasSinActualizacion.length === 0 && (
                    <div className="col-span-full rounded-xl px-3 py-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,99,65,0.12)" }}>
                      <p className="text-xs font-semibold" style={{ color: "#006341" }}>Sin alertas</p>
                      <p className="text-xs mt-0.5" style={{ color: "#666666" }}>Todas las obras tienen actualización reciente.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Acción ejecutiva — dentro de la columna izquierda */}
              <div
                className="rounded-2xl px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in"
                style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F7F3EE 100%)", border: "1px solid rgba(201,166,107,0.24)" }}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] font-semibold" style={{ color: "#8C6B41" }}>Acción ejecutiva</p>
                  <p className="mt-0.5 text-sm font-bold" style={{ color: "#2C2C2C" }}>Revisar el universo completo de obras</p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleVerObras}
                  className="shrink-0"
                  aria-label="Ir al listado completo de obras"
                >
                  Ver listado ejecutivo
                </Button>
              </div>

            </div>{/* fin columna izquierda */}

            {/* KPI cards columna derecha */}
            <section className="grid grid-cols-1 gap-3">
              <CardResumen
                titulo="Inauguradas"
                valor={statsDG.inauguradas}
                subtitulo={`${statsDG.total ? Math.round((statsDG.inauguradas / statsDG.total) * 100) : 0}% del universo monitoreado`}
                icono="IN"
                colorClase="text-[#1d4ed8]"
                bgClase="bg-[rgba(29,78,216,0.10)]"
                borderColor="#3b82f6"
                progressValue={statsDG.total ? Math.round((statsDG.inauguradas / statsDG.total) * 100) : 0}
                progressColor="#3b82f6"
              />
              <CardResumen
                titulo="Terminadas"
                valor={statsDG.terminadas}
                subtitulo={`${statsDG.total ? Math.round((statsDG.terminadas / statsDG.total) * 100) : 0}% del universo monitoreado`}
                icono="OK"
                colorClase="text-[#006341]"
                bgClase="bg-[rgba(0,99,65,0.10)]"
                borderColor="#006341"
                progressValue={statsDG.total ? Math.round((statsDG.terminadas / statsDG.total) * 100) : 0}
                progressColor="#006341"
              />
              <CardResumen
                titulo="En proceso"
                valor={statsDG.enProceso}
                subtitulo={`${statsDG.total ? Math.round((statsDG.enProceso / statsDG.total) * 100) : 0}% del universo monitoreado`}
                icono="EP"
                colorClase="text-[#8C6B41]"
                bgClase="bg-[rgba(201,166,107,0.14)]"
                borderColor="#C9A66B"
                progressValue={statsDG.total ? Math.round((statsDG.enProceso / statsDG.total) * 100) : 0}
                progressColor="#C9A66B"
              />
              <CardResumen
                titulo="Sin iniciar"
                valor={statsDG.sinIniciar}
                subtitulo={`${statsDG.total ? Math.round((statsDG.sinIniciar / statsDG.total) * 100) : 0}% sin iniciar`}
                icono="SI"
                colorClase="text-[#691C32]"
                bgClase="bg-[rgba(105,28,50,0.08)]"
                borderColor="#691C32"
                progressValue={statsDG.total ? Math.round((statsDG.sinIniciar / statsDG.total) * 100) : 0}
                progressColor="#691C32"
              />
              {statsDG.canceladas > 0 && (
                <CardResumen
                  titulo="Canceladas"
                  valor={statsDG.canceladas}
                  subtitulo={`${statsDG.total ? Math.round((statsDG.canceladas / statsDG.total) * 100) : 0}% del universo`}
                  icono="X"
                  colorClase="text-[#b91c1c]"
                  bgClase="bg-[rgba(239,68,68,0.08)]"
                  borderColor="#ef4444"
                  progressValue={statsDG.total ? Math.round((statsDG.canceladas / statsDG.total) * 100) : 0}
                  progressColor="#ef4444"
                />
              )}
            </section>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
