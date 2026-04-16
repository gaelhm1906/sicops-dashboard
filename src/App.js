import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ObraProvider } from "./context/ObraContext";
import "./App.css";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ListadoObras = lazy(() => import("./pages/ListadoObras"));
const VistaHistorico = lazy(() => import("./pages/VistaHistorico"));
const NotFound = lazy(() => import("./pages/NotFound"));

function getRouterBasename() {
  const publicUrl = process.env.PUBLIC_URL || "";

  if (!publicUrl || publicUrl === ".") {
    return "/";
  }

  try {
    const pathname = new URL(publicUrl, window.location.origin).pathname;
    return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  } catch {
    return publicUrl;
  }
}

function PageLoader() {
  return (
    <div className="suspense-loader">
      <div className="suspense-spinner" aria-label="Cargando pagina" role="status" />
    </div>
  );
}

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

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/obras" element={<ListadoObras />} />
              <Route path="/historico" element={<VistaHistorico />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
