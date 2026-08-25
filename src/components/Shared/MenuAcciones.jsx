import React, { useEffect, useRef, useState } from "react";

/** Menú "⋮ Más" — agrupa acciones secundarias poco frecuentes sobre una obra */
export default function MenuAcciones({ items, light = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Más acciones"
        aria-expanded={open}
        className="transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.93]"
        style={
          light
            ? { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer", flexShrink: 0 }
            : { width: "26px", height: "26px", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#6b7280", fontWeight: 700, cursor: "pointer", flexShrink: 0 }
        }
      >
        ⋮
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-10 rounded-xl overflow-hidden animate-fade-in"
          style={{ backgroundColor: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb", minWidth: "180px" }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-gray-50"
              style={{ color: item.danger ? "#b91c1c" : "#374151" }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
