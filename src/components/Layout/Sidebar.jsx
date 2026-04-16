import React, { memo } from "react";
import { NavLink } from "react-router-dom";

const LINKS = [
  {
    to:    "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to:    "/obras",
    label: "Listado Obras",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to:    "/mapa",
    label: "Mapa SIG",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    to:    "/historico",
    label: "Histórico",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

function Sidebar() {
  return (
    <aside
      className="hidden lg:flex flex-col min-h-screen bg-white py-6 px-3"
      style={{
        width: "272px",
        flexShrink: 0,
        borderRight: "1px solid #D4C4B0",
      }}
    >
      <nav className="space-y-1 flex-1">
        {LINKS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-l-4
               ${isActive
                 ? "border-l-[#691C32] bg-[rgba(105,28,50,0.10)] font-semibold pl-3 pr-3"
                 : "border-l-transparent pl-3 pr-3 hover:bg-[rgba(105,28,50,0.06)]"}`
            }
            style={({ isActive }) => ({
              color: isActive ? "#691C32" : "#2C2C2C",
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? "#691C32" : "#666666" }}>
                  {icon}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        className="mt-auto px-3 py-3 rounded-lg"
        style={{
          backgroundColor: "rgba(105,28,50,0.04)",
          border: "1px solid rgba(105,28,50,0.10)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#691C32" }}>
          Sistema
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#666666" }}>SICOPS v1.0.0</p>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
