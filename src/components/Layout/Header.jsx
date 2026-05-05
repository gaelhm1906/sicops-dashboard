import React, { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getEstadoSistema } from "../../utils/api";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ahora, setAhora] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [sistema, setSistema] = useState({ abierto: false, estado: "cerrado", cargando: true, error: null });

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadSistemaEstado = useCallback(async () => {
    try {
      const abierto = await getEstadoSistema();
      setSistema({ abierto, estado: abierto ? "abierto" : "cerrado", cargando: false, error: null });
    } catch (err) {
      setSistema({
        abierto: true,
        estado: "abierto",
        cargando: false,
        error: err.message || "No se pudo cargar el estado del sistema",
      });
    }
  }, []);

  useEffect(() => {
    loadSistemaEstado();
    const intervalId = setInterval(loadSistemaEstado, 60000);
    window.addEventListener("sicops-system-updated", loadSistemaEstado);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("sicops-system-updated", loadSistemaEstado);
    };
  }, [loadSistemaEstado]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const horaFormateada = ahora.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const sistemaAbierto = sistema.abierto;

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        minHeight: "80px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        borderBottom: "1px solid #e5e5e5",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("sidebar-toggle"))}
              aria-label="Abrir menu"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#691C32",
                fontSize: "22px",
                lineHeight: 1,
                padding: "4px 6px",
                borderRadius: "6px",
              }}
            >
              ☰
            </button>
            <img
              src="https://plataformasobse.info/web/assets/img/LOGO-NUEVO.png"
              alt="Logo SOBSE"
              className="object-contain"
              style={{ height: "52px", width: "auto" }}
            />
            <div className="self-stretch w-px mx-1 hidden sm:block" style={{ backgroundColor: "#D4C4B0" }} />
            <div className="hidden sm:block">
              <p className="text-xs leading-tight" style={{ color: "#6b7280" }}>
                Gobierno de la Ciudad de Mexico
              </p>
              <p className="font-semibold leading-tight" style={{ fontSize: "15px", color: "#1a1a1a" }}>
                SOBSE
              </p>
            </div>
          </div>

          <div
            className="hidden md:flex items-center justify-center gap-5 justify-self-center rounded-[22px] px-5 py-3 text-xs font-medium"
            style={{
              background: "rgba(122, 28, 46, 0.08)",
              border: "1px solid rgba(122, 28, 46, 0.15)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                background: sistemaAbierto ? "rgba(0,128,0,0.10)" : "rgba(220,53,69,0.10)",
                color: sistemaAbierto ? "#1e7e34" : "#a61e2d",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              <span
                className={`w-2 h-2 rounded-full ${sistemaAbierto ? "animate-pulse" : ""}`}
                style={{ backgroundColor: sistemaAbierto ? "#28a745" : "#dc3545" }}
              />
              {sistema.cargando ? "CARGANDO" : sistemaAbierto ? "ABIERTO" : "CERRADO"}
            </div>

            <div
              className="rounded-xl px-4 py-2 font-semibold"
              style={{
                backgroundColor: "#f9fafb",
                color: "#691C32",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              <span className="font-mono font-medium tracking-[0.08em]">{horaFormateada}</span>
            </div>

            {sistema.error && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                {sistema.error}
              </span>
            )}
            {user?.dg && (
              <span
                className="px-3 py-2 rounded-full font-semibold"
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#691C32",
                  border: "1px solid rgba(105,28,50,0.12)",
                }}
              >
                Direccion General: {user.dg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 justify-self-end">
            <span
            className="md:hidden w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: sistemaAbierto ? "#006341" : "#E8A8A8" }}
          />

            <div className="relative">
              <button
                onClick={() => setMenuOpen((value) => !value)}
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
                    <p className="text-xs" style={{ color: "#666666" }}>
                      Sesion activa
                    </p>
                    <p className="text-sm font-medium truncate" style={{ color: "#2C2C2C" }}>
                      {user?.email}
                    </p>
                    {user?.dg && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: "#691C32" }}>
                        DG: {user.dg}
                      </p>
                    )}
                  </div>

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

        <div
          className="flex md:hidden flex-col items-center justify-center gap-2 mt-3 rounded-2xl px-3 py-3 text-xs font-semibold"
          style={{
            background: "rgba(122, 28, 46, 0.08)",
            border: "1px solid rgba(122, 28, 46, 0.15)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: sistemaAbierto ? "rgba(0,128,0,0.10)" : "rgba(220,53,69,0.10)",
              color: sistemaAbierto ? "#1e7e34" : "#a61e2d",
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${sistemaAbierto ? "animate-pulse" : ""}`}
              style={{ backgroundColor: sistemaAbierto ? "#28a745" : "#dc3545" }}
            />
            {sistema.cargando ? "CARGANDO" : sistemaAbierto ? "ABIERTO" : "CERRADO"}
          </div>
          <div
            className="rounded-xl px-4 py-2 font-semibold"
            style={{
              backgroundColor: "#f9fafb",
              color: "#691C32",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <span className="font-mono font-medium tracking-[0.08em]">{horaFormateada}</span>
          </div>
        </div>
      </div>

      {menuOpen && <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />}

      {!sistema.cargando && !sistemaAbierto && (
        <div
          className="w-full text-center text-sm font-semibold py-2 px-4"
          style={{ backgroundColor: "#691C32", color: "#FFFFFF", letterSpacing: "0.04em" }}
        >
          Sistema cerrado - Solo consulta permitida. Contacte al administrador para habilitar actualizaciones.
        </div>
      )}
    </header>
  );
}

export default memo(Header);
