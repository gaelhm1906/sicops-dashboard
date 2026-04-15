import React, { memo } from "react";

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-5 px-6 mt-auto" style={{ backgroundColor: "#691C32" }}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <span style={{ color: "rgba(255,255,255,0.8)" }}>
          © {year} Gobierno de la Ciudad de México · SOBSE — SICOPS
        </span>
        <span className="flex items-center gap-2" style={{ color: "#C9A66B" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#C9A66B" }} />
          Sistema Integral de Control de Obra Pública
        </span>
      </div>
    </footer>
  );
}

export default memo(Footer);
