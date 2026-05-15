import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ObraProvider } from "./context/ObraContext";
import { ModulesProvider, useModules } from "./context/ModulesContext";
import RestrictedModule from "./components/security/RestrictedModule";
import "./App.css";

const Login          = lazy(() => import("./pages/Login"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const ListadoObras   = lazy(() => import("./pages/ListadoObras"));
const AgregarAlcances= lazy(() => import("./pages/AgregarAlcances"));
const VistaHistorico = lazy(() => import("./pages/VistaHistorico"));
const MapView        = lazy(() => import("./pages/MapView"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const UtopiasList    = lazy(() => import("./pages/Utopias/index"));
const UtopiaDetalle  = lazy(() => import("./pages/Utopias/UtopiaDetalle"));

function PageLoader() {
  return (
    <div className="suspense-loader">
      <div className="suspense-spinner" aria-label="Cargando página" role="status" />
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <ObraProvider>
      <ModulesProvider>
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
  const { user }      = useAuth();
  const { canAccess, getModuleInfo } = useModules();

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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
              <Route path="/alcances"     element={<AlcancesRoute />} />
              <Route path="/update"       element={<AlcancesRoute />} />
              <Route path="/actualizacion"element={<AlcancesRoute />} />
              <Route path="/mapa"         element={<MapView />} />
              <Route path="/historico"    element={<VistaHistorico />} />
              {/* ── Subsistema Utopías ── */}
              <Route path="/utopias"              element={<UtopiaRoute />} />
              <Route path="/utopias/:clave"       element={<UtopiaDetalleRoute />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  );
}
