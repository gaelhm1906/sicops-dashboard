import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useObras } from "../../context/ObraContext";
import { useModules } from "../../context/ModulesContext";
import { getEstadoSistema } from "../../utils/api";
import ModalNuevaSemana from "../Modal/ModalNuevaSemana";
import ModalSistema from "../Modal/ModalSistema";
import ModalControlModulos from "../Modal/ModalControlModulos";
import ModalConfigEdicion from "../Modal/ModalConfigEdicion";
import RestrictedModule from "../security/RestrictedModule";
import { isEnlaceUtopias } from "../../utils/permissions";
import { esVistaEjecutiva } from "../../utils/roles";
import { contarNoLeidas } from "../../utils/evaluaciones";
import { puedeEditarContrato, puedeEditarFrentes } from "../../utils/contratos";

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

const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconTopiario = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12,2 20,16 4,16" />
    <line x1="12" y1="16" x2="12" y2="21" />
    <line x1="9"  y1="21" x2="15" y2="21" />
  </svg>
);

const IconCampana = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconGaleria = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconContrato = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

const IconSubirMapa = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l6 3 6-3 6 3v15l-6-3-6 3-6-3z" />
    <line x1="9" y1="6" x2="9" y2="21" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

/* ── Links de navegación base ── */
const BASE_LINKS = [
  { to: "/dashboard",      label: "Home",             icon: <IconHome />,    moduleKey: null },
  { to: "/obras",          label: "Mis Pendientes",   icon: <IconEdit />,    moduleKey: null },
  { to: "/visitas",        label: "Visitas",          icon: <IconPin />,     moduleKey: null },
  { to: "/notificaciones", label: "Notificaciones",   icon: <IconCampana />, moduleKey: null },
];

/* Galería Fotográfica — mismo público que Revisión Integral de la
   Ejecución de Obra: secretario, admin y funcionarios de DG. No entra en
   BASE_LINKS porque su visibilidad depende del rol, no es universal. */
const GALERIA_LINK = { to: "/galeria", label: "Galería", icon: <IconGaleria />, moduleKey: null };

/* Registro de Contratos — Director de Concursos y Contratos (edita) y
   Director de Obra (solo el campo de frentes); no entra en BASE_LINKS
   porque su visibilidad depende del rol. */
const CONTRATOS_LINK = { to: "/contratos", label: "Contratos", icon: <IconContrato />, moduleKey: null };
/* Piloto PS_SICOPS_FINAL — login y base de datos propios, ver
   backend/DISENO_BD_PS_SICOPS_FINAL.md */
const CONTRATOS_PS_LINK = { to: "/contratos-ps", label: "Contratos", icon: <IconContrato />, moduleKey: null };
/* Alta masiva de obras desde GeoJSON — solo la cuenta ADMIN de
   PS_SICOPS_FINAL (dar de alta obras reales es delicado, se restringe a
   administración del sistema, no al área operativa). */
const ADMIN_IMPORTAR_LINK = { to: "/admin/importar-obras", label: "Importar Obras", icon: <IconSubirMapa />, moduleKey: null };

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

function NavItem({ link, canAccess, badge, onClose, onShowRestricted }) {
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
        position:        "relative",
        display:         "flex",
        alignItems:      "center",
        gap:             "10px",
        padding:         "11px 14px",
        borderRadius:    "12px",
        fontSize:        "14px",
        fontWeight:      isActive ? 700 : 600,
        color:           isActive ? "#ffffff" : "#767179",
        textDecoration:  "none",
        backgroundColor: isActive ? "var(--guinda)" : "transparent",
        boxShadow:       isActive ? "0 8px 18px rgba(105,28,50,0.28)" : "none",
        transition:      "background-color 0.15s, color 0.15s, transform 0.15s",
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.getAttribute("aria-current")) {
          e.currentTarget.style.backgroundColor = "rgba(105,28,50,0.06)";
          e.currentTarget.style.color            = "var(--guinda)";
          e.currentTarget.style.transform        = "translateX(2px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.getAttribute("aria-current")) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color            = "#767179";
          e.currentTarget.style.transform        = "translateX(0)";
        }
      }}
    >
      {({ isActive }) => (
        <>
          <span style={{ opacity: 0.9 }}>{icon}</span>
          <span className="flex-1 min-w-0">{label}</span>
          {badge > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[18px] text-center"
              style={{
                backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "var(--guinda)",
                color: "#fff",
              }}
            >
              {badge}
            </span>
          )}
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: "var(--oro)" }}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { user, logout }                   = useAuth();
  const { refreshObras }                   = useObras();
  const { canAccess, getModuleInfo }       = useModules();
  const navigate                           = useNavigate();

  const [open, setOpen]                              = useState(false);
  /* Panel persistente en escritorio (Design System v2 — ya no es un menú
     hamburguesa que se abre encima del contenido); en móvil sigue siendo
     un overlay que se muestra/oculta. */
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  const [modalSemanaOpen,   setModalSemanaOpen]      = useState(false);
  const [modalSistemaOpen,  setModalSistemaOpen]     = useState(false);
  const [modalModulosOpen,  setModalModulosOpen]     = useState(false);
  const [modalEdicionOpen,  setModalEdicionOpen]     = useState(false);
  const [sistemaAbierto,    setSistemaAbierto]       = useState(true);
  const [restrictedLink,    setRestrictedLink]       = useState(null);

  const isAdmin = useMemo(
    () => user?.rol === "ADMIN" || user?.role === "admin",
    [user?.rol, user?.role]
  );
  const isGeoestadistica = useMemo(
    () => user?.rol === "GEOESTADISTICA" || user?.rol === "ADMIN",
    [user?.rol]
  );
  /* Galería Fotográfica — mismo público que Revisión Integral de la
     Ejecución de Obra: secretario, admin y funcionarios de DG. */
  const puedeVerGaleria = useMemo(() => esVistaEjecutiva(user?.rol), [user?.rol]);

  /* Registro de Contratos — Director de Concursos y Contratos (captura y
     vincula) y Director de Obra (solo frentes, dentro de la página). */
  const puedeVerContratos = useMemo(
    () => puedeEditarContrato(user?.rol) || puedeEditarFrentes(user?.rol),
    [user?.rol]
  );

  /* Clasificación de contratos (PS_SICOPS_FINAL) — solo para cuentas de
     ese sistema (login unificado, ver src/utils/api.js authAPI.login).
     No depende de puedeVerContratos: son roles y credenciales distintos. */
  const esCuentaPS = user?.sistema === "ps_sicops_final";

  /* Contador de observaciones sin leer para el badge de "Notificaciones"
     — snapshot al montar/navegar, no necesita ser en vivo dentro de la
     misma pantalla. */
  const notificacionesSinLeer = useMemo(() => contarNoLeidas(user), [user]);

  /* El enlace de utopías solo ve su módulo — ocultar el resto */
  const soloUtopias = useMemo(() => isEnlaceUtopias(user), [user]);

  /* Construir links según rol */
  const visibleLinks = useMemo(() => {
    /* Cuenta de PS_SICOPS_FINAL: el dashboard/menú del sistema viejo no
       tiene datos reales para esta sesión — solo se le muestra su módulo. */
    /* Cuenta de PS_SICOPS_FINAL: mismo menú base que cualquier otra sesión
       (Home/Mis Pendientes/Visitas/Notificaciones ya funcionan con datos
       reales vía ObraContext). "Contratos" es exclusivo del Director de
       Concursos y Contratos — el backend ya lo bloquea para cualquier
       otro rol (ver utils/alcanceObras.js, 2026-08-21: Supervisión
       Externa veía TODOS los contratos de la DG por este mismo enlace),
       así que tampoco tiene caso mostrárselo. */
    if (esCuentaPS) {
      const links = user?.rol === "DIRECTOR_CONCURSOS_CONTRATOS" ? [...BASE_LINKS, CONTRATOS_PS_LINK] : BASE_LINKS;
      return user?.rol === "ADMIN" ? [...links, ADMIN_IMPORTAR_LINK] : links;
    }
    if (soloUtopias) return BASE_LINKS.filter((l) => l.to === "/utopias" || l.to === "/dashboard");
    let links = BASE_LINKS;
    if (puedeVerGaleria) links = [...links, GALERIA_LINK];
    if (puedeVerContratos) links = [...links, CONTRATOS_LINK];
    return links;
  }, [soloUtopias, puedeVerGaleria, puedeVerContratos, esCuentaPS, user?.rol]);

  const loadSistemaEstado = useCallback(async () => {
    try {
      const abierto = await getEstadoSistema();
      setSistemaAbierto(!!abierto);
    } catch {
      setSistemaAbierto(true);
    }
  }, []);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* El estado del sistema ahora se muestra aquí (antes vivía también en el
     Header, que ya no existe) — se consulta al montar y cada vez que algo
     lo cambia, para cualquier usuario, no solo admin. */
  useEffect(() => {
    loadSistemaEstado();
    const intervalId = setInterval(loadSistemaEstado, 60000);
    window.addEventListener("sicops-system-updated", loadSistemaEstado);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("sicops-system-updated", loadSistemaEstado);
    };
  }, [loadSistemaEstado]);

  const openSemanaModal   = useCallback(() => setModalSemanaOpen(true), []);
  const openSistemaModal  = useCallback(async () => { await loadSistemaEstado(); setModalSistemaOpen(true); }, [loadSistemaEstado]);
  const openModulosModal  = useCallback(() => setModalModulosOpen(true), []);
  const openEdicionModal  = useCallback(() => setModalEdicionOpen(true), []);

  const handleSistemaChange = useCallback(async (response) => {
    setSistemaAbierto(!!response?.abierto);
    window.dispatchEvent(new CustomEvent("sicops-system-updated"));
    await refreshObras();
  }, [refreshObras]);

  const handleShowRestricted = useCallback((link) => setRestrictedLink(link), []);
  const handleCloseRestricted = useCallback(() => setRestrictedLink(null), []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const estadoInfo = sistemaAbierto
    ? { dot: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", label: "Todo disponible" }
    : { dot: "#691C32", bg: "#fdf2f5", border: "rgba(105,28,50,0.22)", color: "#691C32", label: "Actualización cerrada" };

  const dockedWidth = 268;

  /* En móvil, sin el Header que antes cargaba el hamburguesa, el propio
     Sidebar tiene que dejar un disparador flotante para poder abrirse. */
  if (!isDesktop && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="fixed top-3 left-3 z-40 lg:hidden w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "#ffffff", color: "var(--guinda)", boxShadow: "0 4px 14px rgba(0,0,0,0.16)", border: "1px solid var(--border)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Espaciador — reserva el ancho real del panel en escritorio (docked);
          en móvil no ocupa espacio, el panel flota como overlay. */}
      <div style={{ width: isDesktop ? dockedWidth : 0, flexShrink: 0, transition: "width 200ms var(--ease-out)" }} />

      {/* Backdrop — solo en móvil, donde el panel sigue siendo un overlay dismissible */}
      {!isDesktop && (
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
      )}

      <aside
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         isDesktop ? dockedWidth : "min(320px, 90vw)",
          height:        "100%",
          backgroundColor: "#ffffff",
          color:         "var(--ink)",
          zIndex:        999,
          padding:       "20px",
          display:       "flex",
          flexDirection: "column",
          boxShadow:     isDesktop ? "1px 0 0 rgba(0,0,0,0.06)" : "4px 0 24px rgba(0,0,0,0.14)",
          overflow:      "hidden",
        }}
      >
        {/* Logo + nombre — identidad de la barra, siempre visible (en
            escritorio también, como base del "app shell"); en móvil el
            overlay tapa el Header, así que aquí además vive el cierre. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => { navigate("/dashboard"); setOpen(false); }}
            className="flex items-center gap-3 min-w-0 text-left"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <img
              src="/web/assets/img/LOGO-NUEVO.png"
              alt="Logo SOBSE"
              style={{ width: "48px", height: "40px", objectFit: "contain", flexShrink: 0 }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] leading-tight" style={{ color: "var(--oro)" }}>
                Gobierno de la Ciudad de México
              </p>
              <span style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "0.01em", color: "#691C32" }}>
                Plataforma SOBSE
              </span>
            </div>
          </button>
          {!isDesktop && (
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
                flexShrink:    0,
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ height: "1px", backgroundColor: "var(--border)", marginBottom: "16px" }} />

        {/* Área scrollable: navegación + operaciones admin */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column" }}>

          {/* Navegación */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {visibleLinks.map((link) => {
              const accessible = !link.moduleKey || canAccess(link.moduleKey, user);
              return (
                <NavItem
                  key={link.to}
                  link={link}
                  canAccess={accessible}
                  badge={link.to === "/notificaciones" ? notificacionesSinLeer : 0}
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
                <AdminAction
                  icon="✏️"
                  label="Edición de alcances"
                  description="Permite o bloquea que los usuarios editen registros ya guardados."
                  onClick={openEdicionModal}
                  tone="neutral"
                />
                <AdminAction
                  icon="📊"
                  label="Cobertura de alcances"
                  description="Obras con y sin alcances registrados. Exportar a CSV."
                  onClick={() => { navigate("/admin/cobertura"); setOpen(false); }}
                  tone="neutral"
                />
              </div>
            </div>
          )}

          {/* Operaciones GEOESTADÍSTICA */}
          {isGeoestadistica && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ backgroundColor: "rgba(37,99,235,0.18)" }} />
                <span className="text-[11px] tracking-[0.18em] uppercase"
                  style={{ color: "rgba(37,99,235,0.62)" }}>
                  Geoestadística
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: "rgba(37,99,235,0.18)" }} />
              </div>
              <div className="space-y-2">
                {/* Gestión de Obras — estilo sólido mejorado */}
                <button type="button"
                  onClick={() => { navigate("/gestion-obras"); setOpen(false); }}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                  style={{ backgroundColor: "#1e3a8a", color: "#ffffff",
                    border: "1px solid #1e40af", cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(30,58,138,0.20)" }}>
                  🗺️ Gestión de Obras
                  <p className="text-xs font-normal mt-0.5" style={{ color: "rgba(219,234,254,0.80)" }}>
                    Altas, bajas y modificaciones controladas
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Estado Operativo — solo ADMIN */}
          {isAdmin && (
            <div className="mt-3">
              <button type="button"
                onClick={() => { navigate("/admin/estado"); setOpen(false); }}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                style={{ backgroundColor: "#1e293b", color: "#f1f5f9",
                  border: "1px solid #334155", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(30,41,59,0.20)" }}>
                🖥️ Estado Operativo
                <p className="text-xs font-normal mt-0.5" style={{ color: "rgba(203,213,225,0.75)" }}>
                  Diagnóstico e integridad del ecosistema
                </p>
              </button>
            </div>
          )}

          {/* Inteligencia Operativa — solo ADMIN */}
          {isAdmin && (
            <div className="mt-3">
              <button type="button"
                onClick={() => { navigate("/admin/inteligencia"); setOpen(false); }}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                style={{ backgroundColor: "#312e81", color: "#eef2ff",
                  border: "1px solid #4338ca", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(49,46,129,0.20)" }}>
                📈 Inteligencia Operativa
                <p className="text-xs font-normal mt-0.5" style={{ color: "rgba(199,210,254,0.80)" }}>
                  Resumen, transiciones y obras sin movimiento
                </p>
              </button>
            </div>
          )}

          {/* Espaciador para que el footer quede separado */}
          <div style={{ flexShrink: 0, height: 16 }} />

        </div>

        {/* Footer — fijo al final, fuera del área scrollable. Antes esta
            identidad (estado del sistema + usuario) vivía en el Header;
            al quitarlo para no duplicar la marca, se consolida aquí junto
            a Cerrar sesión. */}
        <div style={{ flexShrink: 0, paddingTop: 12 }}>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
            style={{ backgroundColor: estadoInfo.bg, color: estadoInfo.color, border: `1px solid ${estadoInfo.border}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: estadoInfo.dot }} />
            {estadoInfo.label}
          </span>

          <div className="flex items-center gap-2.5 px-1 py-1 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0"
              style={{ backgroundColor: "var(--guinda)" }}
            >
              {user?.nombre?.charAt(0) || "A"}
            </div>
            <span className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
              {user?.nombre || user?.email}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ color: "var(--guinda)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(105,28,50,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Cerrar sesión
          </button>
          {isAdmin && (
            <div
              className="rounded-2xl px-4 py-3 text-xs"
              style={{
                backgroundColor: "var(--surface-2)",
                color:           "var(--ink-soft)",
                border:          "1px solid var(--border)",
              }}
            >
              Todas las acciones operativas están centralizadas aquí.
            </div>
          )}
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

      {modalEdicionOpen && (
        <ModalConfigEdicion
          onClose={() => setModalEdicionOpen(false)}
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
