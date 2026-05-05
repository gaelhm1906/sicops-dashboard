import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useObras } from "../../context/ObraContext";
import { getEstadoSistema } from "../../utils/api";
import ModalNuevaSemana from "../Modal/ModalNuevaSemana";
import ModalSistema from "../Modal/ModalSistema";

const LINKS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: "/obras",
    label: "Listado Obras",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

function AdminAction({ icon, label, description, onClick, tone = "neutral" }) {
  const accent = tone === "danger" ? "rgba(105,28,50,0.92)" : "rgba(122,28,46,0.84)";
  const iconColor = tone === "danger" ? "#FFD7D7" : "#F4D7A1";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3 transition-all duration-200 hover:translate-x-1"
      style={{
        backgroundColor: accent,
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "0 10px 24px rgba(70,16,29,0.20)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5" style={{ color: iconColor }}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs mt-1 text-white/75">{description}</p>
        </div>
      </div>
    </button>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const { refreshObras } = useObras();
  const [open, setOpen] = useState(false);
  const [modalSemanaOpen, setModalSemanaOpen] = useState(false);
  const [modalSistemaOpen, setModalSistemaOpen] = useState(false);
  const [sistemaAbierto, setSistemaAbierto] = useState(true);

  const isAdmin = useMemo(
    () => user?.rol === "ADMIN" || user?.role === "admin",
    [user?.rol, user?.role]
  );

  const loadSistemaEstado = useCallback(async () => {
    try {
      const abierto = await getEstadoSistema();
      setSistemaAbierto(!!abierto);
    } catch {
      setSistemaAbierto(true);
    }
  }, []);

  useEffect(() => {
    function handleToggle() {
      setOpen((value) => !value);
    }

    window.addEventListener("sidebar-toggle", handleToggle);
    return () => window.removeEventListener("sidebar-toggle", handleToggle);
  }, []);

  useEffect(() => {
    if (open && isAdmin) {
      loadSistemaEstado();
    }
  }, [open, isAdmin, loadSistemaEstado]);

  const openSemanaModal = useCallback(() => {
    setModalSemanaOpen(true);
  }, []);

  const openSistemaModal = useCallback(async () => {
    await loadSistemaEstado();
    setModalSistemaOpen(true);
  }, [loadSistemaEstado]);

  const handleSistemaChange = useCallback(
    async (response) => {
      setSistemaAbierto(!!response?.abierto);
      window.dispatchEvent(new CustomEvent("sicops-system-updated"));
      await refreshObras();
    },
    [refreshObras]
  );

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 998,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(2px)",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "min(320px, 90vw)",
          height: "100%",
          background: "linear-gradient(180deg, #ffffff 0%, #f3ebeb 24%, #7A1C2E 100%)",
          color: "#ffffff",
          zIndex: 999,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 0 24px rgba(0,0,0,0.22)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/web/assets/img/corazon-snfondo.png"
              alt="Logo SOBSE"
              style={{ width: "40px", height: "40px", objectFit: "contain", flexShrink: 0 }}
            />
            <div className="min-w-0">
              <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "0.02em", color: "#691C32" }}>
                PLATAFORMA SOBSE
              </span>
              <p className="text-xs mt-1" style={{ color: "rgba(105,28,50,0.76)" }}>
                Controles y navegacion principal
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menu"
            style={{
              background: "rgba(105,28,50,0.10)",
              border: "none",
              color: "#691C32",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="rounded-2xl px-4 py-3 mb-4"
          style={{
            backgroundColor: "rgba(255,255,255,0.28)",
            border: "1px solid rgba(255,255,255,0.36)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
            backdropFilter: "blur(8px)",
          }}
        >
          <p className="text-xs" style={{ color: "#5E1828" }}>Estado del sistema</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${sistemaAbierto ? "animate-pulse" : ""}`}
              style={{ backgroundColor: sistemaAbierto ? "#28a745" : "#dc3545" }}
            />
            <span className="text-sm font-semibold" style={{ color: sistemaAbierto ? "#1e7e34" : "#8B1E2D" }}>
              {sistemaAbierto ? "Abierto" : "Cerrado"}
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#ffffff" : "#4A1825",
                textDecoration: "none",
                backgroundColor: isActive ? "rgba(105,28,50,0.88)" : "rgba(255,255,255,0.18)",
                boxShadow: isActive ? "0 10px 20px rgba(105,28,50,0.22)" : "none",
                transition: "background-color 0.15s, transform 0.15s, box-shadow 0.15s",
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.backgroundColor = "rgba(122, 28, 46, 0.10)";
                  e.currentTarget.style.transform = "translateX(3px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.getAttribute("aria-current")) {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)";
                  e.currentTarget.style.transform = "translateX(0)";
                }
              }}
            >
              <span style={{ opacity: 0.9 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {isAdmin && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(105,28,50,0.18)" }} />
              <span className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "rgba(105,28,50,0.62)" }}>
                Operaciones
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(105,28,50,0.18)" }} />
            </div>

            <div className="space-y-3">
              <AdminAction
                icon="📅"
                label="Iniciar nueva semana de actualizacion"
                description="Cierra la semana vigente y genera el snapshot semanal."
                onClick={openSemanaModal}
              />
              <AdminAction
                icon="⚙️"
                label="Abrir / Cerrar sistema"
                description="Controla si los usuarios pueden capturar actualizaciones."
                onClick={openSistemaModal}
                tone="danger"
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-6">
          <div
            className="rounded-2xl px-4 py-3 text-xs"
            style={{
              backgroundColor: "rgba(255,255,255,0.16)",
              color: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
            }}
          >
            {isAdmin
              ? "Todas las acciones operativas estan centralizadas aqui para mantener el header limpio y mejorar la experiencia en movil."
              : "Usa este menu para navegar por el sistema desde cualquier dispositivo."}
          </div>
        </div>
      </aside>

      {modalSemanaOpen && (
        <ModalNuevaSemana
          onClose={() => {
            setModalSemanaOpen(false);
            setOpen(false);
          }}
        />
      )}

      {modalSistemaOpen && (
        <ModalSistema
          abierto={sistemaAbierto}
          onChange={handleSistemaChange}
          onClose={() => {
            setModalSistemaOpen(false);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export default memo(Sidebar);
