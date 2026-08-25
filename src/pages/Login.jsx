import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validarEmail, validarPassword } from "../utils/validations";

/* ═══════════════════════════════════════════════════════════════
   Login — apariencia portada del login institucional aprobado
   (C:\Users\Usuario\Desktop\LOGIN). Lógica de autenticación 100%
   propia de este proyecto; solo se tomó la capa visual.
═══════════════════════════════════════════════════════════════ */

function IconUsuario() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function IconEscudo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconFlecha() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconOjo({ tachado }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <line x1="2" y1="2" x2="22" y2="22" />}
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [usuario, setUsuario] = useState("");
  const [password, setPass] = useState("");
  const [usuarioErr, setUsuarioErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [apiErr, setApiErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ usuario: false, pass: false });
  const [verPassword, setVerPassword] = useState(false);

  /* Si ya está autenticado, ir al Home — funciona igual para cualquier
     sistema (ObraContext ya sabe de dónde traer las obras según la sesión). */
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  /* Validar en tiempo real solo si ya tocó el campo */
  useEffect(() => {
    if (touched.usuario) setUsuarioErr(validarEmail(usuario) || "");
  }, [usuario, touched.usuario]);

  useEffect(() => {
    if (touched.pass) setPassErr(validarPassword(password) || "");
  }, [password, touched.pass]);

  const canSubmit = !usuarioErr && !passErr && usuario && password;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setTouched({ usuario: true, pass: true });

    const uErr = validarEmail(usuario);
    const pErr = validarPassword(password);
    setUsuarioErr(uErr || "");
    setPassErr(pErr || "");
    if (uErr || pErr) return;

    setLoading(true);
    setApiErr("");

    const result = await login(usuario, password);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setApiErr(result.error);
    }
  }, [usuario, password, login, navigate]);

  /* ── RENDER ── */
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 overflow-hidden" style={{ backgroundColor: "var(--crema)" }}>
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="animate-blob-a absolute -top-[10%] -left-[10%] w-[80%] sm:w-[40%] h-[40%] rounded-full"
          style={{ backgroundColor: "var(--guinda)", opacity: 0.05, filter: "blur(100px)" }}
        />
        <div
          className="animate-blob-b absolute -bottom-[10%] -right-[10%] w-[90%] sm:w-[50%] h-[50%] rounded-full"
          style={{ backgroundColor: "var(--oro)", opacity: 0.06, filter: "blur(120px)" }}
        />

        <img
          src="/web/assets/img/saludo.png"
          alt=""
          aria-hidden="true"
          className="animate-float-a absolute top-10 right-[5%] sm:top-20 sm:right-[10%] w-32 sm:w-48 lg:w-64"
          style={{ opacity: 0.07, filter: "grayscale(1) brightness(1.25) contrast(1.15)" }}
        />
        <img
          src="/web/assets/img/saludo.png"
          alt=""
          aria-hidden="true"
          className="animate-float-b absolute bottom-20 left-[2%] sm:bottom-40 sm:left-[5%] w-24 sm:w-32 lg:w-52"
          style={{ opacity: 0.07, filter: "grayscale(1) brightness(1.25) contrast(1.15)" }}
        />

        <div
          className="absolute inset-0"
          style={{ opacity: 0.03, backgroundImage: "radial-gradient(var(--guinda) 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        />
      </div>

      <div className="w-full max-w-lg relative z-10 px-2 sm:px-0">
        <div
          className="animate-card-enter bg-white rounded-[32px] sm:rounded-[40px] p-8 sm:p-12 border"
          style={{ borderColor: "var(--border-soft)", boxShadow: "0 32px 64px -16px rgba(105,28,50,0.10)" }}
        >
          <div className="flex flex-col items-center mb-8 sm:mb-10">
            <div className="mb-6 sm:mb-8 flex items-center gap-4 sm:gap-6">
              <img src="/web/assets/img/LOGO-NUEVO.png" alt="Logo CDMX SOBSE" className="h-10 sm:h-12 w-auto" />
              <div className="h-6 sm:h-8 w-px" style={{ backgroundColor: "var(--border)" }} />
              <span className="text-lg sm:text-xl font-black tracking-tighter" style={{ color: "var(--guinda)" }}>SOBSE</span>
            </div>

            <div className="flex flex-col items-center gap-1 mb-2 w-full">
              <div className="flex items-center gap-3 sm:gap-4 mb-1">
                <div className="w-8 sm:w-12 lg:w-16 h-[2px]" style={{ backgroundColor: "var(--oro)", opacity: 0.35 }} />
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] whitespace-nowrap" style={{ color: "var(--oro)" }}>
                  Sistema de Información
                </p>
                <div className="w-8 sm:w-12 lg:w-16 h-[2px]" style={{ backgroundColor: "var(--oro)", opacity: 0.35 }} />
              </div>
              <h1 className="text-[28px] sm:text-[40px] lg:text-[44px] font-black tracking-tighter text-center leading-tight sm:leading-none w-full">
                <span style={{ color: "var(--ink)" }}>Plataforma</span>{" "}
                <span style={{ color: "var(--guinda)" }}>SOBSE</span>
              </h1>
              <p className="mt-3 text-sm font-normal text-center max-w-[360px]" style={{ color: "var(--ink-soft)" }}>
                SICOPS
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <label htmlFor="login-usuario" className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1" style={{ color: "var(--ink-faint)" }}>
                Usuario
              </label>
              <div className="relative group">
                <span className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 transition-colors" style={{ color: usuarioErr ? "var(--rojo)" : "var(--ink-faint)" }}>
                  <IconUsuario />
                </span>
                <input
                  id="login-usuario"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, usuario: true }))}
                  placeholder="usuario.institucional"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full pl-12 sm:pl-16 pr-6 sm:pr-8 py-4 sm:py-5 border-2 rounded-[18px] sm:rounded-[24px] transition-all outline-none text-base sm:text-lg font-semibold"
                  style={{
                    backgroundColor: "var(--crema)",
                    borderColor: usuarioErr ? "var(--rojo)" : "transparent",
                    color: "var(--ink)",
                  }}
                />
              </div>
              {usuarioErr && <p className="text-xs font-semibold ml-1" style={{ color: "var(--rojo)" }}>{usuarioErr}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-pass" className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1" style={{ color: "var(--ink-faint)" }}>
                Contraseña
              </label>
              <div className="relative group">
                <span className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 transition-colors" style={{ color: passErr ? "var(--rojo)" : "var(--ink-faint)" }}>
                  <IconEscudo />
                </span>
                <input
                  id="login-pass"
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, pass: true }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-12 sm:pl-16 pr-12 sm:pr-14 py-4 sm:py-5 border-2 rounded-[18px] sm:rounded-[24px] transition-all outline-none text-base sm:text-lg font-semibold tracking-widest"
                  style={{
                    backgroundColor: "var(--crema)",
                    borderColor: passErr ? "var(--rojo)" : "transparent",
                    color: "var(--guinda)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <IconOjo tachado={verPassword} />
                </button>
              </div>
              {passErr && <p className="text-xs font-semibold ml-1" style={{ color: "var(--rojo)" }}>{passErr}</p>}
            </div>

            {apiErr && (
              <div
                className="animate-fade-in rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-3 sm:py-4 flex items-center gap-3"
                style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}
              >
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: "var(--rojo)" }} />
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--rojo)" }}>{apiErr}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full py-4 sm:py-5 h-16 sm:h-20 rounded-[18px] sm:rounded-[24px] font-black text-lg sm:text-xl text-white transition-all duration-200 ease-[var(--ease-out)] flex items-center justify-center gap-3 disabled:opacity-40 hover:-translate-y-0.5 active:scale-[0.98] mt-2"
              style={{ backgroundColor: "var(--guinda)", boxShadow: "0 20px 40px -12px rgba(105,28,50,0.3)" }}
            >
              {loading ? (
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 sm:border-[3px] rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              ) : (
                <>
                  Entrar al sistema <IconFlecha />
                </>
              )}
            </button>
          </form>

          <footer className="mt-8 sm:mt-12 flex flex-col items-center gap-4 sm:gap-5">
            {/* Guía y presentación de arranque (12-13 de agosto): piezas
                autocontenidas copiadas a public/ para que se sirvan desde
                el propio dominio en vez de enlazar a claude.ai.
                Rutas SIN "/" inicial a propósito: el despliegue es manual
                y a veces cae en una subcarpeta (ej. /pruebas/v_2/) en vez
                de la raíz del dominio — una ruta relativa resuelve contra
                donde sea que quedó este mismo index.html, sin importar la
                subcarpeta; una ruta absoluta ("/archivo.html") solo
                funciona si el despliegue es justo la raíz. */}
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-bold">
              <a
                href="guia-operacion-sicops.html"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:underline"
                style={{ color: "var(--guinda)" }}
              >
                Guía de operación
              </a>
              <span style={{ color: "var(--border)" }}>·</span>
              <a
                href="como-funciona-sicops.html"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:underline"
                style={{ color: "var(--guinda)" }}
              >
                Cómo funciona SICOPS
              </a>
            </div>
            <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-center max-w-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
              Secretaría de Obras y Servicios CDMX
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
