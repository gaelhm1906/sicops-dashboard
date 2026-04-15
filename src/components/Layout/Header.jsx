import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sistemaAPI } from "../../utils/api";

const HORA_CIERRE = 12;

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ahora, setAhora] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [sistema, setSistema] = useState({ abierto: false, estado: "cerrado", cargando: true, error: null });
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadSistemaEstado = useCallback(async () => {
    try {
      const res = await sistemaAPI.getEstado();
      setSistema({
        abierto: res.abierto,
        estado: res.estado,
        cargando: false,
        error: null,
      });
    } catch (err) {
      setSistema({ abierto: false, estado: "cerrado", cargando: false, error: err.message || "No se pudo cargar el estado del sistema" });
    }
  }, []);

  useEffect(() => {
    loadSistemaEstado();
    const intervalId = setInterval(loadSistemaEstado, 60000);
    return () => clearInterval(intervalId);
  }, [loadSistemaEstado]);

  const handleToggleSistema = async () => {
    setToggling(true);
    try {
      const res = await sistemaAPI.toggle();
      setSistema({
        abierto: !!res.abierto,
        estado: res.estado?.estado || res.estado || (res.abierto ? "abierto" : "cerrado"),
        cargando: false,
        error: null,
      });
    } catch (err) {
      setSistema((prev) => ({ ...prev, error: err.message || "No se pudo cambiar el estado" }));
    } finally {
      setToggling(false);
    }
  };

  const horaFormateada = ahora.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const sistemaAbierto = sistema.abierto;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="bg-white sticky top-0 z-30"
      style={{ height: "80px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderBottom: "1px solid #D4C4B0" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            <img
              src="https://plataformasobse.info/web/assets/img/LOGO-NUEVO.png"
              alt="Logo SOBSE"
              className="object-contain"
              style={{ height: "52px", width: "auto" }}
            />
            <div className="self-stretch w-px mx-1" style={{ backgroundColor: "#D4C4B0" }} />
            <div className="hidden sm:block">
              <p className="text-xs leading-tight" style={{ color: "#666666" }}>
                Gobierno de la Ciudad de Mexico
              </p>
              <p className="font-semibold leading-tight" style={{ fontSize: "15px", color: "#691C32" }}>
                SOBSE
              </p>
            </div>
          </div>

          <div
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
            style={{
              backgroundColor: sistemaAbierto ? "rgba(0,99,65,0.06)" : "rgba(232,168,168,0.18)",
              border: sistemaAbierto ? "1px solid rgba(0,99,65,0.22)" : "1px solid rgba(105,28,50,0.18)",
              color: sistemaAbierto ? "#006341" : "#691C32",
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${sistemaAbierto ? "animate-pulse" : ""}`}
              style={{ backgroundColor: sistemaAbierto ? "#006341" : "#E8A8A8" }}
            />
            {sistema.cargando ? "Cargando estado del sistema..." : sistemaAbierto ? "ABIERTO" : "CERRADO"}
            <span style={{ color: "#D4C4B0" }}>·</span>
            <span className="font-mono">{horaFormateada}</span>

            {sistema.error && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                {sistema.error}
              </span>
            )}

            {user?.rol === "ADMIN" ? (
              <>
                <span style={{ color: "#D4C4B0" }}>·</span>
                <button
                  type="button"
                  onClick={handleToggleSistema}
                  disabled={toggling || sistema.cargando}
                  className="px-2.5 py-1 rounded-full font-semibold text-[11px] transition-colors"
                  style={{
                    backgroundColor: sistemaAbierto ? "#691C32" : "#006341",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.18)",
                    opacity: toggling ? 0.7 : 1,
                  }}
                >
                  {sistemaAbierto ? "Cerrar sistema" : "Abrir sistema"}
                </button>
              </>
            ) : user?.dg ? (
              <>
                <span style={{ color: "#D4C4B0" }}>·</span>
                <span
                  className="px-2.5 py-1 rounded-full font-semibold"
                  style={{ backgroundColor: "rgba(105,28,50,0.08)", color: "#691C32", border: "1px solid rgba(105,28,50,0.12)" }}
                >
                  Dirección General: {user.dg}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span
              className="md:hidden w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: sistemaAbierto ? "#006341" : "#E8A8A8" }}
            />

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 text-sm focus:outline-none"
                style={{ color: "#2C2C2C" }}
                aria-label="Menu de usuario"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white"
                  style={{ backgroundColor: "#691C32" }}
                >
                  {user?.nombre?.charAt(0) || "A"}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate" style={{ color: "#2C2C2C" }}>
                  {user?.nombre || user?.email}
                </span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#D4C4B0" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl py-1 animate-fade-in"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid #D4C4B0" }}
                >
                  <div className="px-4 py-2" style={{ borderBottom: "1px solid #D4C4B0" }}>
                    <p className="text-xs" style={{ color: "#666666" }}>Sesion activa</p>
                    <p className="text-sm font-medium truncate" style={{ color: "#2C2C2C" }}>
                      {user?.email}
                    </p>
                    {user?.dg && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: "#691C32" }}>
                        DG: {user.dg}
                      </p>
                    )}
                  </div>

                  {[
                    { label: "Dashboard", path: "/dashboard" },
                    { label: "Listado de obras", path: "/obras" },
                    { label: "Historico", path: "/historico" },
                  ].map(({ label, path }) => (
                    <button
                      key={path}
                      onClick={() => { setMenuOpen(false); navigate(path); }}
                      className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[rgba(105,28,50,0.06)]"
                      style={{ color: "#2C2C2C" }}
                    >
                      {label}
                    </button>
                  ))}

                  <div style={{ borderTop: "1px solid #D4C4B0", marginTop: "4px" }} />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[rgba(105,28,50,0.06)]"
                    style={{ color: "#691C32" }}
                  >
                    Cerrar sesion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />
      )}
    </header>
  );
}

export default memo(Header);
