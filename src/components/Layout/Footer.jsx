import React, { memo } from "react";

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-5 px-6 mt-auto" style={{ backgroundColor: "#691C32" }}>
      <div className="max-w-7xl mx-auto flex items-center justify-center text-xs">
        <span style={{ color: "rgba(255,255,255,0.8)" }}>
          © {year} Gobierno de la Ciudad de México · PLATAFORMA SOBSE
        </span>
      </div>
    </footer>
  );
}

export default memo(Footer);
