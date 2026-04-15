import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authAPI, getToken, clearToken } from "../utils/api";

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

  const login = useCallback(async (email, password) => {
    try {
      const result = await authAPI.login(email, password);
      const normalizedUser = normalizeUser(result.user);
      setTokenSt(result.token);
      setUser(normalizedUser);
      localStorage.setItem("sicops_user", JSON.stringify(normalizedUser));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Error al iniciar sesión",
        code: err.code || null,
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try { authAPI.logout(); } catch {}
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
