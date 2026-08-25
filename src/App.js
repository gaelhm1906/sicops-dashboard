import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ObraProvider } from "./context/ObraContext";
import { ModulesProvider, useModules } from "./context/ModulesContext";
import RestrictedModule from "./components/security/RestrictedModule";
import ModalSesionExpirada from "./components/Modal/ModalSesionExpirada";
import CommandBar from "./components/Shared/CommandBar";
import { getToken } from "./utils/api";
import "./App.css";

const Login          = lazy(() => import("./pages/Login"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const ListadoObras   = lazy(() => import("./pages/ListadoObras"));
const Visitas        = lazy(() => import("./pages/Visitas"));
const AgregarAlcances= lazy(() => import("./pages/AgregarAlcances"));
const VistaHistorico = lazy(() => import("./pages/VistaHistorico"));
const MapView        = lazy(() => import("./pages/MapView"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const UtopiasList    = lazy(() => import("./pages/Utopias/index"));
const UtopiaDetalle  = lazy(() => import("./pages/Utopias/UtopiaDetalle"));
const Topiarios         = lazy(() => import("./pages/Topiarios/index"));
const CoberturaAlcances  = lazy(() => import("./pages/CoberturaAlcances/index"));
const GestionObras       = lazy(() => import("./pages/GestionObras/index"));
const EstadoOperativo    = lazy(() => import("./pages/EstadoOperativo/index"));
const InteligenciaOperativa = lazy(() => import("./pages/InteligenciaOperativa/index"));
const PreviewSeguimiento    = lazy(() => import("./pages/PreviewSeguimiento"));
const Galeria                = lazy(() => import("./pages/Galeria"));
const BandejaObservaciones    = lazy(() => import("./pages/BandejaObservaciones"));
const Contratos               = lazy(() => import("./pages/Contratos"));
const ContratosPS             = lazy(() => import("./pages/ContratosPS/index"));
const AdminImportarObras      = lazy(() => import("./pages/AdminImportarObras"));

function PageLoader() {
  return (
    <div className="suspense-loader">
      <div className="suspense-spinner" aria-label="Cargando página" role="status" />
    </div>
  );
}

/* ── Controlador global de sesión expirada ──────────────────────────────────
   Escucha el CustomEvent "sicops:session-expired" disparado por apiCall
   cuando el backend devuelve 401. Muestra el modal institucional una sola
   vez aunque fallen varias peticiones simultáneas (firedRef).
   También evalúa preventivamente el tiempo restante del JWT cada 60 s.
─────────────────────────────────────────────────────────────────────────── */
const WARN_MINUTES = 30; // mostrar banner si quedan menos de N minutos

function decodeJwtExp(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).exp || null;
  } catch {
    return null;
  }
}

function SessionExpiredController() {
  const { logout, isAuthenticated } = useAuth();
  const [showModal,  setShowModal]  = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const firedRef = useRef(false);

  /* ── Escucha el evento global de sesión expirada ── */
  useEffect(() => {
    const handler = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setShowBanner(false);
      setShowModal(true);
    };
    window.addEventListener("sicops:session-expired", handler);
    return () => window.removeEventListener("sicops:session-expired", handler);
  }, []);

  /* ── Timer preventivo: evalúa cada 60 s si quedan < WARN_MINUTES ── */
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = () => {
      if (showModal) return;
      const token = getToken();
      if (!token) return;
      const exp = decodeJwtExp(token);
      if (!exp) return;
      const minutesLeft = (exp - Date.now() / 1000) / 60;
      if (minutesLeft <= 0) {
        /* Ya expiró pero el modal no se abrió (p.ej. sin peticiones recientes) */
        if (!firedRef.current) { firedRef.current = true; setShowModal(true); }
      } else if (minutesLeft <= WARN_MINUTES) {
        setShowBanner(true);
      } else {
        setShowBanner(false);
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, showModal]);

  const handleLoginNuevo = useCallback(async () => {
    setShowModal(false);
    setShowBanner(false);
    firedRef.current = false;
    await logout();
    window.location.hash = "/login";
  }, [logout]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    /* No se resetea firedRef — la próxima mutación reabre si el token sigue inválido */
  }, []);

  return (
    <>
      {/* Banner preventivo — aparece cuando quedan < 30 min */}
      {showBanner && !showModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 1200,
            background: "linear-gradient(90deg, #78350f 0%, #92400e 100%)",
            color: "#fff", fontSize: "13px", fontWeight: 600,
            padding: "10px 20px", display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
          }}
        >
          <span>⏱ Tu sesión está por expirar. Guarda tu información para no perder cambios.</span>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            style={{ background: "transparent", border: "none", color: "#fff",
              cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "0 4px" }}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <ModalSesionExpirada open={showModal} onLoginNuevo={handleLoginNuevo} onClose={handleClose} />
    </>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <ObraProvider>
      <ModulesProvider>
        <CommandBar />
        <Outlet />
      </ModulesProvider>
    </ObraProvider>
  );
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return children;
}

/* ── Ruta guardada por módulo — usa ModulesContext + config estática como fallback ── */
function ModuleRoute({ moduleKey, children }) {
  const { user }                              = useAuth();
  const { canAccess, getModuleInfo, loading } = useModules();

  /* Mientras el contexto carga desde BD, evitar mostrar pantalla de restricción */
  if (loading) return <PageLoader />;

  const allowed = canAccess(moduleKey, user);
  if (allowed) return children;

  const info = getModuleInfo(moduleKey);
  return (
    <RestrictedModule
      mode="page"
      badge="Módulo restringido"
      title={info?.label ? `${info.label} — Acceso Restringido` : "MÓDULO EN VALIDACIÓN OPERATIVA"}
      message={info?.message}
    />
  );
}

/* ── Ruta de Alcances — usa ModuleRoute para respetar el estado dinámico de BD ── */
function AlcancesRoute() {
  return (
    <ModuleRoute moduleKey="ALCANCES">
      <AgregarAlcances />
    </ModuleRoute>
  );
}

/* ── Ruta de Utopías ── */
function UtopiaRoute() {
  return (
    <ModuleRoute moduleKey="UTOPIAS">
      <UtopiasList />
    </ModuleRoute>
  );
}

/* ── Ruta de detalle de Utopía ── */
function UtopiaDetalleRoute() {
  return (
    <ModuleRoute moduleKey="UTOPIAS">
      <UtopiaDetalle />
    </ModuleRoute>
  );
}

export default function App() {
  return (
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <SessionExpiredController />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* Preview temporal sin login — validación visual de SEGUIMIENTO_PS 2.0 */}
            <Route path="/preview-seguimiento" element={<PreviewSeguimiento />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard"    element={<Dashboard />} />
              <Route path="/obras"        element={<ListadoObras />} />
              <Route path="/visitas"      element={<Visitas />} />
              <Route path="/alcances"     element={<AlcancesRoute />} />
              <Route path="/update"       element={<AlcancesRoute />} />
              <Route path="/actualizacion"element={<AlcancesRoute />} />
              <Route path="/mapa"         element={<MapView />} />
              <Route path="/historico"    element={<VistaHistorico />} />
              {/* ── Subsistema Utopías ── */}
              <Route path="/utopias"              element={<UtopiaRoute />} />
              <Route path="/utopias/:clave"       element={<UtopiaDetalleRoute />} />
              {/* ── Herramienta Topiarios ── */}
              <Route path="/topiarios"            element={<Topiarios />} />
              {/* ── Panel admin: cobertura de alcances ── */}
              <Route path="/admin/cobertura"          element={<CoberturaAlcances />} />
              {/* ── Módulo Gestión de Obras (GEOESTADISTICA) ── */}
              <Route path="/gestion-obras"            element={<GestionObras />} />
              {/* ── Centro de Estado Operativo (ADMIN) ── */}
              <Route path="/admin/estado"             element={<EstadoOperativo />} />
              {/* ── Inteligencia Operativa — Fase 1 (ADMIN) ── */}
              <Route path="/admin/inteligencia"       element={<InteligenciaOperativa />} />
              {/* ── Galería Fotográfica (ADMIN) ── */}
              <Route path="/galeria"                  element={<Galeria />} />
              {/* ── Bandeja de entrada de observaciones del Secretario ── */}
              <Route path="/notificaciones"           element={<BandejaObservaciones />} />
              {/* ── Registro de Contratos (Director de Concursos y Contratos) ── */}
              <Route path="/contratos"                element={<Contratos />} />
              {/* ── PS_SICOPS_FINAL: clasificación y vinculación de contratos (Home/Mis
                   Pendientes/Visitas ya funcionan con datos reales vía ObraContext) ── */}
              <Route path="/contratos-ps"              element={<ContratosPS />} />
              {/* ── PS_SICOPS_FINAL: alta masiva de obras desde GeoJSON (solo ADMIN) ── */}
              <Route path="/admin/importar-obras"      element={<AdminImportarObras />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  );
}
