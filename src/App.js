import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ObraProvider }          from "./context/ObraContext";
import "./App.css";

/* ── Lazy loading de páginas ── */
const Login          = lazy(() => import("./pages/Login"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const ListadoObras   = lazy(() => import("./pages/ListadoObras"));
const VistaHistorico = lazy(() => import("./pages/VistaHistorico"));
const NotFound       = lazy(() => import("./pages/NotFound"));

/* ── Loader de Suspense ── */
function PageLoader() {
  return (
    <div className="suspense-loader">
      <div className="suspense-spinner" aria-label="Cargando página" role="status" />
    </div>
  );
}

/* ── Guarda de rutas protegidas ── */
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <ObraProvider>
      <Outlet />
    </ObraProvider>
  );
}

/* ── Guarda de ruta pública (redirige si ya autenticado) ── */
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

/* ── Router principal ── */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Ruta raíz → redirigir a dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Ruta pública: login */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Rutas protegidas */}
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/obras"     element={<ListadoObras />} />
              <Route path="/historico" element={<VistaHistorico />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
