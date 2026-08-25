import React, { useEffect } from "react";
import Sidebar from "../Layout/Sidebar";
import Footer from "../Layout/Footer";

const RESTRICTED_THEME = {
  backdrop:    "rgba(23, 15, 18, 0.56)",
  panelBg:     "linear-gradient(180deg, #fffdf9 0%, #f6f1e8 100%)",
  panelBorder: "1px solid rgba(201,166,107,0.28)",
  panelShadow: "0 24px 60px rgba(38,26,17,0.24)",
  heroBg:      "linear-gradient(135deg, #691C32 0%, #7E2843 58%, #4F0E21 100%)",
  heroBorder:  "1px solid rgba(255,255,255,0.12)",
  badgeBg:     "rgba(201,166,107,0.18)",
  badgeBorder: "1px solid rgba(201,166,107,0.35)",
  badgeText:   "#8C6B41",
  title:       "#2C2C2C",
  body:        "#5B5560",
  accent:      "#691C32",
  accentSoft:  "#F5E8D1",
  line:        "rgba(201,166,107,0.20)",
};

const DEFAULT_TITLE   = "MÓDULO EN VALIDACIÓN OPERATIVA";
const DEFAULT_SUBTITLE = "Validación temporal del módulo";
const DEFAULT_MESSAGE  = "La Administración SOBSE restringió temporalmente el acceso a este módulo mientras concluyen las validaciones operativas internas.";
const DEFAULT_FOOTER   = "El acceso será habilitado próximamente. Contacte al administrador si requiere acceso inmediato.";

function LockBadgeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L4 7v5c0 4.418 3.582 8 8 9 4.418-1 8-4.582 8-9V7l-8-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RestrictedCard({ onClose, badge = "Acceso restringido", title, subtitle, message, footer }) {
  const displayTitle    = title    || DEFAULT_TITLE;
  const displaySubtitle = subtitle || DEFAULT_SUBTITLE;
  const displayMessage  = message  || DEFAULT_MESSAGE;
  const displayFooter   = footer   || DEFAULT_FOOTER;

  return (
    <div
      className="w-full rounded-[28px] overflow-hidden"
      style={{
        maxWidth:    "640px",
        background:  RESTRICTED_THEME.panelBg,
        border:      RESTRICTED_THEME.panelBorder,
        boxShadow:   RESTRICTED_THEME.panelShadow,
      }}
    >
      {/* Hero guinda */}
      <div
        className="px-6 py-5"
        style={{ background: RESTRICTED_THEME.heroBg, borderBottom: RESTRICTED_THEME.heroBorder }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
              style={{
                backgroundColor: "rgba(255,255,255,0.10)",
                color:           "rgba(255,248,241,0.88)",
                border:          "1px solid rgba(255,255,255,0.16)",
              }}
            >
              <LockBadgeIcon />
              Control de acceso — SICOPS / PLATAFORMA SOBSE
            </div>
            <h2 className="mt-4 text-xl sm:text-2xl font-bold text-white">{displayTitle}</h2>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "rgba(255,248,241,0.80)" }}>
              {displaySubtitle}
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full w-10 h-10 text-lg font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,0.10)",
                color:           "#FFFFFF",
                border:          "1px solid rgba(255,255,255,0.18)",
              }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-6 sm:px-7 sm:py-7">
        <div className="flex items-start gap-4">
          {/* Icono shield */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background:  "linear-gradient(135deg, #F5E8D1 0%, #EAD7B1 100%)",
              color:       RESTRICTED_THEME.accent,
              border:      "1px solid rgba(201,166,107,0.26)",
              boxShadow:   "0 12px 24px rgba(105,28,50,0.08)",
            }}
          >
            <ShieldIcon />
          </div>

          <div className="min-w-0">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{
                backgroundColor: RESTRICTED_THEME.badgeBg,
                border:          RESTRICTED_THEME.badgeBorder,
                color:           RESTRICTED_THEME.badgeText,
              }}
            >
              {badge}
            </span>

            <p className="mt-4 text-sm sm:text-[15px] leading-7" style={{ color: RESTRICTED_THEME.body }}>
              {displayMessage}
            </p>
            <p className="mt-3 text-sm sm:text-[15px] leading-7" style={{ color: RESTRICTED_THEME.body }}>
              {displayFooter}
            </p>
          </div>
        </div>

        <div
          className="mt-6 pt-5 flex justify-end"
          style={{ borderTop: `1px solid ${RESTRICTED_THEME.line}` }}
        >
          <button
            type="button"
            onClick={onClose || (() => window.history.back())}
            className="rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              background:  "linear-gradient(135deg, #691C32 0%, #7E2843 100%)",
              color:       "#FFFFFF",
              border:      "1px solid rgba(105,28,50,0.14)",
              boxShadow:   "0 10px 24px rgba(105,28,50,0.18)",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * RestrictedModule
 * @param {string}   mode      - "page" (pantalla completa) | "modal" (overlay)
 * @param {function} onClose   - callback al cerrar (requerido en mode="modal")
 * @param {string}   badge     - texto del chip pequeño
 * @param {string}   title     - título principal (override de DEFAULT_TITLE)
 * @param {string}   subtitle  - subtítulo (override)
 * @param {string}   message   - párrafo explicativo (override)
 * @param {string}   footer    - párrafo de cierre (override)
 */
export default function RestrictedModule({ mode = "page", onClose, badge, title, subtitle, message, footer }) {
  useEffect(() => {
    if (mode !== "modal") return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mode, onClose]);

  if (mode === "modal") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: RESTRICTED_THEME.backdrop, backdropFilter: "blur(8px)" }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <RestrictedCard
          onClose={onClose}
          badge={badge || "En configuración"}
          title={title}
          subtitle={subtitle}
          message={message}
          footer={footer}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto w-full flex items-center">
          <div className="w-full">
            <RestrictedCard
              onClose={() => window.history.back()}
              badge={badge || "En configuración"}
              title={title}
              subtitle={subtitle}
              message={message}
              footer={footer}
            />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
