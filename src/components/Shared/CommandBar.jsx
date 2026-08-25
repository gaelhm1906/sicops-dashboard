import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useObras } from "../../context/ObraContext";
import { useAuth } from "../../context/AuthContext";
import { esVistaEjecutiva } from "../../utils/roles";
import { getObraKey } from "../../utils/seguimiento";
import { getRequerimientosPorRol } from "../../data/seguimientoCatalogo";

const MAX_POR_GRUPO = 5;

const ACCIONES_BASE = [
  { id: "dashboard", label: "Ir a Inicio", path: "/dashboard" },
  { id: "obras", label: "Ir a Mis Pendientes", labelAdmin: "Ir al Directorio de Obras", path: "/obras" },
  { id: "visitas", label: "Ver Visitas", path: "/visitas" },
  { id: "mapa", label: "Ver Mapa", path: "/mapa" },
  { id: "historico", label: "Ver Histórico", path: "/historico" },
];

const ACCIONES_ADMIN = [
  { id: "cobertura", label: "Cobertura de Alcances", path: "/admin/cobertura" },
  { id: "gestion", label: "Gestión de Obras", path: "/gestion-obras" },
  { id: "estado", label: "Estado Operativo", path: "/admin/estado" },
  { id: "inteligencia", label: "Inteligencia Operativa", path: "/admin/inteligencia" },
];

/**
 * Barra de comandos global (⌘K / Ctrl+K) — Design System v2: acceso
 * universal a obras, programas, requerimientos y navegación, sin tener
 * que recorrer el árbol de menús. Vive montada una sola vez, arriba del
 * Outlet protegido, para estar disponible en cualquier pantalla.
 */
export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obrasRaw } = useObras();
  const isAdmin = esVistaEjecutiva(user?.rol);
  const rol = user?.rol || "";

  useEffect(() => {
    const onKeyDown = (e) => {
      const isK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const requerimientos = useMemo(
    () => (isAdmin ? [] : getRequerimientosPorRol(rol)),
    [isAdmin, rol]
  );

  const close = useCallback(() => setOpen(false), []);

  const grupos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const resultado = [];

    if (q) {
      const obrasMatch = (obrasRaw || [])
        .filter((o) =>
          [o.nombre_obra, o.nombre, o.clave_unica, o.programa]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q))
        )
        .slice(0, MAX_POR_GRUPO)
        .map((o) => ({
          id: `obra::${getObraKey(o)}`,
          titulo: o.nombre_obra || o.nombre,
          sub: o.programa || o.clave_unica || "Obra",
          onSelect: () => navigate("/obras", { state: { obraKey: getObraKey(o) } }),
        }));
      if (obrasMatch.length) resultado.push({ label: "Obras", items: obrasMatch });

      const programas = [...new Set((obrasRaw || []).map((o) => o.programa).filter(Boolean))]
        .filter((p) => p.toLowerCase().includes(q))
        .slice(0, MAX_POR_GRUPO)
        .map((p) => ({
          id: `programa::${p}`,
          titulo: p,
          sub: "Programa",
          onSelect: () => navigate("/obras", { state: { programaActivo: p } }),
        }));
      if (programas.length) resultado.push({ label: "Programas", items: programas });

      if (requerimientos.length) {
        const reqs = requerimientos
          .filter((r) => r.nombre.toLowerCase().includes(q))
          .slice(0, MAX_POR_GRUPO)
          .map((r) => ({
            id: `req::${r.id}`,
            titulo: r.nombre,
            sub: r.categoria,
            onSelect: () => navigate("/obras", { state: { buscarTarea: r.nombre } }),
          }));
        if (reqs.length) resultado.push({ label: "Requerimientos", items: reqs });
      }
    }

    const acciones = [...ACCIONES_BASE, ...(isAdmin ? ACCIONES_ADMIN : [])]
      .map((a) => ({ ...a, label: isAdmin && a.labelAdmin ? a.labelAdmin : a.label }))
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({
        id: `accion::${a.id}`,
        titulo: a.label,
        sub: "Ir a",
        onSelect: () => navigate(a.path),
      }));
    if (acciones.length) resultado.push({ label: "Acciones rápidas", items: acciones });

    return resultado;
  }, [query, obrasRaw, requerimientos, isAdmin, navigate]);

  const flatItems = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);

  const handleSelect = useCallback((item) => {
    item.onSelect();
    close();
  }, [close]);

  const onKeyDownInput = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) handleSelect(item);
    }
  }, [flatItems, activeIndex, handleSelect]);

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/30 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Barra de comandos"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-command-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDownInput}
            placeholder="Buscar obras, programas, requerimientos o ir a..."
            className="flex-1 text-sm bg-transparent focus:outline-none"
            style={{ color: "var(--ink)" }}
          />
          <kbd
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}
          >
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
              {query.trim() ? "Sin resultados." : "Sin acciones disponibles."}
            </p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.label} className="mb-1">
                <p className="px-4 pt-1.5 pb-1 text-[10px] uppercase tracking-widest font-black" style={{ color: "#8C6B41" }}>
                  {grupo.label}
                </p>
                {grupo.items.map((item) => {
                  runningIndex += 1;
                  const activo = runningIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left"
                      style={{ backgroundColor: activo ? "var(--surface-2)" : "transparent" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{item.titulo}</p>
                        {item.sub && <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{item.sub}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2" style={{ borderTop: "1px solid var(--border-soft)", backgroundColor: "var(--surface-2)" }}>
          <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>↑↓ navegar</span>
          <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>↵ elegir</span>
        </div>
      </div>
    </div>
  );
}
