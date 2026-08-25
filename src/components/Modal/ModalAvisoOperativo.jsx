import React, { useEffect } from "react";

export const AVISO_REPETIR_KEY = "sicops_aviso_repetir_visto";

export default function ModalAvisoOperativo({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1200, backgroundColor: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full animate-fade-in"
        style={{
          maxWidth: "480px",
          borderRadius: "20px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.98)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(105,28,50,0.18)",
          border: "1px solid rgba(201,166,107,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-op-title"
      >
        {/* Franja dorada superior */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #B8912A 0%, #D4A840 50%, #B8912A 100%)" }} />

        {/* Header guinda con logo */}
        <div
          style={{
            background: "linear-gradient(135deg, #691C32 0%, #7E2843 58%, #4F0E21 100%)",
            padding: "28px 24px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          {/* Círculo logo SOBSE */}
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              background: "#FFFFFF",
              border: "2px solid rgba(255,255,255,0.60)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src="/web/assets/img/saludo.png"
              alt="SOBSE"
              style={{ width: "62px", height: "62px", objectFit: "contain" }}
              onError={(e) => {
                const parent = e.currentTarget.parentElement;
                e.currentTarget.style.display = "none";
                if (parent) {
                  parent.textContent = "🏛️";
                  parent.style.fontSize = "28px";
                }
              }}
            />
          </div>

          {/* Etiquetas */}
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "rgba(212,168,64,0.90)",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Plataforma SOBSE
            </p>
            <h2
              id="aviso-op-title"
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              IMPORTANTE
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.70)",
                fontWeight: 500,
                marginTop: "5px",
              }}
            >
              Actualización operativa
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "22px 24px 16px" }}>

          {/* Mensaje principal */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(105,28,50,0.04) 0%, rgba(201,166,107,0.05) 100%)",
              border: "1px solid rgba(105,28,50,0.12)",
              borderRadius: "14px",
              padding: "16px 18px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "rgba(105,28,50,0.08)",
                border: "1.5px solid rgba(105,28,50,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "16px",
              }}
            >
              ⚠️
            </div>
            <p style={{ fontSize: "13.5px", lineHeight: "1.65", color: "#1f2937", margin: 0 }}>
              Recuerda que, aunque el porcentaje de avance de una obra no presente cambios,
              es necesario presionar el botón{" "}
              <span
                style={{
                  display: "inline-block",
                  background: "#691C32",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "1px 9px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  verticalAlign: "middle",
                }}
              >
                REPETIR
              </span>{" "}
              para registrar la validación semanal.
            </p>
          </div>

          {/* Nota obligatoria */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "10px 13px",
              background: "rgba(184,145,42,0.06)",
              border: "1px solid rgba(184,145,42,0.22)",
              borderRadius: "10px",
            }}
          >
            <span style={{ fontSize: "14px", flexShrink: 0 }}>📋</span>
            <p style={{ fontSize: "12px", color: "#78350f", margin: 0, fontWeight: 500, lineHeight: "1.5" }}>
              Esta acción es obligatoria durante el periodo operativo abierto.
            </p>
          </div>
        </div>

        {/* Footer — botón ENTENDIDO */}
        <div style={{ padding: "4px 24px 22px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "13px 24px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #691C32 0%, #7E2843 58%, #4F0E21 100%)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.10em",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(105,28,50,0.32)",
              transition: "opacity 0.15s, transform 0.10s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.88";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            ENTENDIDO
          </button>
          <p style={{ textAlign: "center", fontSize: "11px", color: "#9ca3af", margin: 0 }}>
            Este aviso no volverá a aparecer durante la sesión actual.
          </p>
        </div>
      </div>
    </div>
  );
}
