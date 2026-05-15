import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useObras } from "../../context/ObraContext";
import { useModules } from "../../context/ModulesContext";
import { getEstadoSistema } from "../../utils/api";
import ModalNuevaSemana from "../Modal/ModalNuevaSemana";
import ModalSistema from "../Modal/ModalSistema";
import ModalControlModulos from "../Modal/ModalControlModulos";
import RestrictedModule from "../security/RestrictedModule";
import { isEnlaceUtopias } from "../../utils/permissions";

/* ── Icono SVG helpers ── */
const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

const IconUtopia = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ── Links de navegación base ── */
const BASE_LINKS = [
  { to: "/dashboard", label: "Home",             icon: <IconHome />,   moduleKey: null },
  { to: "/obras",     label: "Actualizar Obras",  icon: <IconEdit />,   moduleKey: null },
  { to: "/alcances",  label: "Agregar Alcances",  icon: <IconDoc />,    moduleKey: "ALCANCES" },
  { to: "/utopias",   label: "Sistema Utopías",   icon: <IconUtopia />, moduleKey: "UTOPIAS" },
];

function AdminAction({ icon, label, description, onClick, tone = "neutral" }) {
  const accent    = tone === "danger" ? "rgba(105,28,50,0.92)" : "rgba(122,28,46,0.84)";
  const iconColor = tone === "danger" ? "#FFD7D7"              : "#F4D7A1";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3 transition-all duration-200 hover:translate-x-1"
      style={{
        backgroundColor: accent,
        border:          "1px solid rgba(255,255,255,0.16)",
        boxShadow:       "0 10px 24px rgba(70,16,29,0.20)",
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

function NavItem({ link, canAccess, onClose, onShowRestricted }) {
  const { to, label, icon } = link;

  if (!canAccess) {
    return (
      <button
        type="button"
        onClick={() => onShowRestricted(link)}
        className="w-full text-left"
        style={{
          display:         "flex",
          alignItems:      "center",
          gap:             "10px",
          padding:         "10px 12px",
          borderRadius:    "10px",
          fontSize:        "14px",
          fontWeight:      600,
          color:           "#4A1825",
          background:      "linear-gradient(135deg, rgba(154,122,80,0.22) 0%, rgba(255,255,255,0.24) 100%)",
          boxShadow:       "0 10px 20px rgba(122,92,51,0.12)",
          border:          "1px solid rgba(154,122,80,0.24)",
          cursor:          "not-allowed",
          opacity:         0.95,
        }}
      >
        <span style={{ opacity: 0.9 }}>{icon}</span>
        <span className="flex-1 min-w-0">{label}</span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full shrink-0"
          style={{
            color:           "#8C6B41",
            backgroundColor: "rgba(255,248,241,0.82)",
            border:          "1px solid rgba(154,122,80,0.24)",
          }}
        >
          Restringido
        </span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={onClose}
      style={({ isActive }) => ({
        display:         "flex",
        alignItems:      "center",
        gap:             "10px",
        padding:         "10px 12px",
        borderRadius:    "10px",
        fontSize:        "14px",
        fontWeight:      isActive ? 700 : 500,
        color:           isActive ? "#ffffff" : "#4A1825",
        textDecoration:  "none",
        backgroundColor: isActive ? "rgba(105,28,50,0.88)" : "rgba(255,255,255,0.18)",
        boxShadow:       isActive ? "0 10px 20px rgba(105,28,50,0.22)" : "none",
        transition:      "background-color 0.15s, transform 0.15s, box-shadow 0.15s",
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.getAttribute("aria-current")) {
          e.currentTarget.style.backgroundColor = "rgba(122, 28, 46, 0.10)";
          e.currentTarget.style.transform        = "translateX(3px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.getAttribute("aria-current")) {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)";
          e.currentTarget.style.transform        = "translateX(0)";
        }
      }}
    >
      <span style={{ opacity: 0.9 }}>{icon}</span>
      {label}
    </NavLink>
  );
}

function Sidebar() {
  const { user }                           = useAuth();
  const { refreshObras }                   = useObras();
  const { canAccess, getModuleInfo }       = useModules();
  const navigate                           = useNavigate();

  const [open, setOpen]                    = useState(false);
  const [modalSemanaOpen, setModalSemanaOpen]   = useState(false);
  const [modalSistemaOpen, setModalSistemaOpen] = useState(false);
  const [modalModulosOpen, setModalModulosOpen] = useState(false);
  const [sistemaAbierto, setSistemaAbierto]     = useState(true);
  const [restrictedLink, setRestrictedLink]     = useState(null);

  const isAdmin = useMemo(
    () => user?.rol === "ADMIN" || user?.role === "admin",
    [user?.rol, user?.role]
  );

  /* El enlace de utopías solo ve su módulo — ocultar el resto */
  const soloUtopias = useMemo(() => isEnlaceUtopias(user), [user]);

  /* Construir links según rol */
  const visibleLinks = useMemo(() => {
    if (soloUtopias) return BASE_LINKS.filter((l) => l.to === "/utopias" || l.to === "/dashboard");
    return BASE_LINKS;
  }, [soloUtopias]);

  const loadSistemaEstado = useCallback(async () => {
    try {
      const abierto = await getEstadoSistema();
      setSistemaAbierto(!!abierto);
    } catch {
      setSistemaAbierto(true);
    }
  }, []);

  useEffect(() => {
    function handleToggle() { setOpen((v) => !v); }
    window.addEventListener("sidebar-toggle", handleToggle);
    return () => window.removeEventListener("sidebar-toggle", handleToggle);
  }, []);

  useEffect(() => {
    if (open && isAdmin) loadSistemaEstado();
  }, [open, isAdmin, loadSistemaEstado]);

  const openSemanaModal   = useCallback(() => setModalSemanaOpen(true), []);
  const openSistemaModal  = useCallback(async () => { await loadSistemaEstado(); setModalSistemaOpen(true); }, [loadSistemaEstado]);
  const openModulosModal  = useCallback(() => setModalModulosOpen(true), []);

  const handleSistemaChange = useCallback(async (response) => {
    setSistemaAbierto(!!response?.abierto);
    window.dispatchEvent(new CustomEvent("sicops-system-updated"));
    await refreshObras();
  }, [refreshObras]);

  const handleShowRestricted = useCallback((link) => setRestrictedLink(link), []);
  const handleCloseRestricted = useCallback(() => setRestrictedLink(null), []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position:        "fixed",
          inset:           0,
          zIndex:          998,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter:  "blur(2px)",
        }}
      />

      <aside
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         "min(320px, 90vw)",
          height:        "100%",
          background:    "linear-gradient(180deg, #ffffff 0%, #f3ebeb 24%, #7A1C2E 100%)",
          color:         "#ffffff",
          zIndex:        999,
          padding:       "20px",
          display:       "flex",
          flexDirection: "column",
          boxShadow:     "4px 0 24px rgba(0,0,0,0.22)",
          backdropFilter:"blur(8px)",
        }}
      >
        {/* Logo + nombre */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => { navigate("/dashboard"); setOpen(false); }}
            className="flex items-center gap-3 min-w-0 text-left"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
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
                Controles y navegación principal
              </p>
            </div>
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            style={{
              background:    "rgba(105,28,50,0.10)",
              border:        "none",
              color:         "#691C32",
              borderRadius:  "8px",
              width:         "32px",
              height:        "32px",
              cursor:        "pointer",
              display:       "flex",
              alignItems:    "center",
              justifyContent:"center",
              fontSize:      "18px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Estado del sistema */}
        <div
          className="rounded-2xl px-4 py-3 mb-4"
          style={{
            backgroundColor: "rgba(255,255,255,0.28)",
            border:          "1px solid rgba(255,255,255,0.36)",
            boxShadow:       "0 4px 12px rgba(0,0,0,0.10)",
            backdropFilter:  "blur(8px)",
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

        {/* Navegación */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {visibleLinks.map((link) => {
            const accessible = !link.moduleKey || canAccess(link.moduleKey, user);
            return (
              <NavItem
                key={link.to}
                link={link}
                canAccess={accessible}
                onClose={() => setOpen(false)}
                onShowRestricted={handleShowRestricted}
              />
            );
          })}
        </nav>

        {/* Operaciones ADMIN */}
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
                label="Iniciar nueva semana de actualización"
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
              <AdminAction
                icon="🔐"
                label="Control de módulos"
                description="Habilita o restringe módulos específicos del sistema."
                onClick={openModulosModal}
                tone="neutral"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-6">
          <div
            className="rounded-2xl px-4 py-3 text-xs"
            style={{
              backgroundColor: "rgba(255,255,255,0.16)",
              color:           "rgba(255,255,255,0.82)",
              backdropFilter:  "blur(8px)",
              boxShadow:       "0 4px 12px rgba(0,0,0,0.10)",
            }}
          >
            {isAdmin
              ? "Todas las acciones operativas están centralizadas aquí para mantener el header limpio y mejorar la experiencia en móvil."
              : "Usa este menú para navegar por el sistema desde cualquier dispositivo."}
          </div>
        </div>
      </aside>

      {/* Modales */}
      {modalSemanaOpen && (
        <ModalNuevaSemana
          onClose={() => { setModalSemanaOpen(false); setOpen(false); }}
        />
      )}

      {modalSistemaOpen && (
        <ModalSistema
          abierto={sistemaAbierto}
          onChange={handleSistemaChange}
          onClose={() => { setModalSistemaOpen(false); setOpen(false); }}
        />
      )}

      {modalModulosOpen && (
        <ModalControlModulos
          onClose={() => setModalModulosOpen(false)}
        />
      )}

      {/* Modal de módulo restringido al hacer clic en un link bloqueado */}
      {restrictedLink && (() => {
        const info = getModuleInfo(restrictedLink.moduleKey);
        return (
          <RestrictedModule
            mode="modal"
            badge="Módulo restringido"
            title={info?.label ? `${info.label} — Acceso Restringido` : undefined}
            message={info?.message}
            onClose={handleCloseRestricted}
          />
        );
      })()}
    </>
  );
}

export default memo(Sidebar);
