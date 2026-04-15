import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Shared/Button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center animate-fade-in max-w-sm">
        <p className="text-8xl font-black text-gray-200 select-none">404</p>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">Página no encontrada</h1>
        <p className="text-gray-500 text-sm mt-2">
          La ruta que buscas no existe o fue movida.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← Volver
          </Button>
          <Button onClick={() => navigate("/dashboard")}>
            Ir al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
