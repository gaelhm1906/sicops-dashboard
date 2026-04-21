import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getToken, setToken, clearToken } from "../utils/api";

const AuthContext = createContext(null);

function getDGFromUser(username) {
  if (!username || !String(username).startsWith("actualizacion_")) return null;
  return String(username).replace("actualizacion_", "").toUpperCase();
}

function normalizeUser(user) {
  if (!user) return null;
  const username = user.username || user.email?.split("@")[0] || null;
  return {
    ...user,
    username,
    dg: user.dg || getDGFromUser(username),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenSt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = getToken();
    const savedUser = localStorage.getItem("sicops_user");
    if (savedToken && savedUser) {
      try {
        setTokenSt(savedToken);
        setUser(normalizeUser(JSON.parse(savedUser)));
      } catch {
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    if (!username || !password) {
      return { success: false, error: "Ingrese usuario y contraseña." };
    }

    const localUser = normalizeUser({
      id:       1,
      email:    username.includes("@") ? username : `${username}@sobse.cdmx.gob.mx`,
      username,
      nombre:   username,
      rol:      "OPERATIVO",
      dg:       getDGFromUser(username),
    });

    const localToken = `local_${Date.now()}`;
    setToken(localToken);
    localStorage.setItem("sicops_user", JSON.stringify(localUser));
    setTokenSt(localToken);
    setUser(localUser);

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTokenSt(null);
    clearToken();
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
