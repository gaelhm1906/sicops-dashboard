import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validarEmail, validarPassword } from "../utils/validations";
import Button from "../components/Shared/Button";
import Input from "../components/Shared/Input";

/* Login minimalista para SIG-SOBSE */

/* ═══════════════════════════════════════════════════════════════
   Login — identidad visual gubernamental CDMX / SOBSE
   LÓGICA: 100% sin cambios. Solo refactor CSS/JSX.
═══════════════════════════════════════════════════════════════ */
export default function Login() {
  const navigate          = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [usuario, setUsuario]       = useState("");
  const [password, setPass]     = useState("");
  const [usuarioErr, setUsuarioErr] = useState("");
  const [passErr, setPassErr]   = useState("");
  const [apiErr, setApiErr]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [touched, setTouched]   = useState({ usuario: false, pass: false });

  /* Si ya está autenticado, ir al dashboard */
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
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4" style={{ fontFamily: '"Inter", -apple-system, sans-serif' }}>
      <div className="w-full max-w-[460px] bg-white rounded-[24px] border border-[#E8E2D7] shadow-[0_20px_80px_rgba(105,28,50,0.08)] p-10 sm:p-12">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="https://plataformasobse.info/web/assets/img/LOGO-NUEVO.png"
            alt="Logo CDMX SOBSE"
            className="h-14 w-auto mb-4"
          />
          <h1 className="text-2xl font-semibold leading-[1.2] text-[#2C2C2C] mb-2">
            Centro de Actualización
            <span
              className="block font-black text-3xl sm:text-4xl text-[#691C32] mt-1"
              style={{
                wordBreak: "keep-all",
                whiteSpace: "normal",
              }}
            >
              SIG-SOBSE
            </span>
          </h1>
          <p className="mt-6 text-sm font-normal text-[#6B7280] max-w-[360px]">
            Acceso al sistema de captura de avances
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <Input
            label="Usuario"
            type="text"
            id="login-usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, usuario: true }))}
            error={usuarioErr}
            placeholder="Usuario"
            required
            autoComplete="username"
            autoFocus
          />

          <Input
            label="Contraseña"
            type="password"
            id="login-pass"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, pass: true }))}
            error={passErr}
            placeholder="Contraseña"
            required
            autoComplete="current-password"
          />

          {apiErr && (
            <div className="rounded-xl border border-[#FBCACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
              {apiErr}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit}
            loading={loading}
            className="w-full !bg-[#691C32] !border-[#691C32] hover:!bg-[#550A1F] hover:!border-[#550A1F] transition-all duration-200"
            style={{ padding: "1rem", borderRadius: "0.75rem" }}
          >
            Entrar al sistema
          </Button>
        </form>
      </div>
    </div>
  );
}
