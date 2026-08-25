import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * AutocompleteInput — campo de texto con dropdown de sugerencias.
 * El dropdown se renderiza via createPortal en document.body para evitar
 * ser recortado por overflow:hidden de contenedores padre (ej: modales).
 *
 * Props:
 *   value           {string}   Valor controlado
 *   onChange        {fn}       (value: string) => void
 *   placeholder     {string}
 *   getSuggestions  {fn}       async (q: string) => string[]  (servidor)
 *   staticList      {string[]} Lista estática para filtrar client-side
 *   allowFreeText   {bool}     true = acepta valor fuera de la lista (default true)
 *   debounceMs      {number}   (default 280)
 *   maxLength       {number}
 *   disabled        {bool}
 *   style           {object}   Estilos del <input>
 *   accentColor     {string}   Color del highlight activo (default "#166534")
 *   onBlur          {fn}       Callback al perder foco
 */
export default function AutocompleteInput({
  value = "",
  onChange,
  placeholder,
  getSuggestions,
  staticList,
  allowFreeText = true,
  debounceMs = 280,
  maxLength,
  disabled = false,
  style,
  accentColor = "#166534",
  onBlur,
  onConfirm,   /* llamado cuando el usuario selecciona explícitamente una sugerencia */
  className,
}) {
  const [open,        setOpen]        = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [loading,     setLoading]     = useState(false);
  const [dropPos,     setDropPos]     = useState({ top: 0, left: 0, width: 0 });

  const wrapperRef  = useRef(null);
  const debounceRef = useRef(null);
  const reqIdRef    = useRef(0);

  /* ── Recalcula posición del dropdown (coordenadas de viewport para position:fixed) ── */
  const updatePos = useCallback(() => {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
  }, []);

  /* ── Cuando se abre, calcular posición y suscribir a scroll/resize ── */
  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true); // capture: true atrapa scroll de modales
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  /* ── Cerrar al clic fuera del wrapper ── */
  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  /* ── Cleanup al desmontar ── */
  useEffect(() => () => { clearTimeout(debounceRef.current); }, []);

  const fetchSuggestions = useCallback((q) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current;

      if (getSuggestions) {
        setLoading(true);
        try {
          const results = await getSuggestions(q);
          if (myId !== reqIdRef.current) return; // respuesta obsoleta
          setSuggestions(Array.isArray(results) ? results : []);
          setOpen(true);
          setActiveIdx(-1);
        } catch {
          /* fallo de red — ignorar */
        } finally {
          if (myId === reqIdRef.current) setLoading(false);
        }
      } else if (staticList) {
        const qUp     = q.toUpperCase();
        const filtered = staticList.filter((s) => s.toUpperCase().includes(qUp));
        setSuggestions(filtered);
        setOpen(filtered.length > 0);
        setActiveIdx(-1);
      }
    }, debounceMs);
  }, [getSuggestions, staticList, debounceMs]);

  const handleChange = (e) => {
    const val = e.target.value.toUpperCase();
    onChange(val);
    if (val.length >= 1) {
      fetchSuggestions(val);
    } else {
      clearTimeout(debounceRef.current);
      setSuggestions([]);
      setOpen(false);
    }
  };

  const selectSuggestion = (s) => {
    onChange(s);
    onConfirm?.(s);   /* notificar selección explícita al padre */
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const handleBlur = (e) => {
    if (wrapperRef.current?.contains(e.relatedTarget)) return;
    setOpen(false);
    /* Si no permite texto libre, limpiar si el valor no coincide exactamente con ninguna opción */
    if (!allowFreeText && staticList && value) {
      const exactMatch = staticList.find((s) => s === value);
      if (!exactMatch) onChange("");
    }
    onBlur?.(e);
  };

  /* ── Dropdown renderizado via portal en document.body ── */
  const dropdownContent = open && (suggestions.length > 0 || loading) ? (
    <div
      style={{
        position:     "fixed",
        top:          dropPos.top,
        left:         dropPos.left,
        width:        dropPos.width,
        zIndex:       9999,
        background:   "#ffffff",
        border:       "1px solid rgba(22,101,52,0.22)",
        borderRadius: "0.5rem",
        boxShadow:    "0 8px 24px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.07)",
        maxHeight:    "196px",
        overflowY:    "auto",
      }}
    >
      {loading ? (
        <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: "0.75rem" }}>
          Buscando…
        </div>
      ) : (
        suggestions.map((s, i) => (
          <div
            key={s}
            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
            style={{
              padding:         "7px 12px",
              cursor:          "pointer",
              fontSize:        "0.8125rem",
              fontWeight:      i === activeIdx ? 600 : 400,
              backgroundColor: i === activeIdx ? "rgba(22,101,52,0.09)" : "transparent",
              color:           i === activeIdx ? accentColor : "#14351f",
              borderBottom:    i < suggestions.length - 1 ? "1px solid rgba(22,101,52,0.06)" : "none",
              whiteSpace:      "nowrap",
              overflow:        "hidden",
              textOverflow:    "ellipsis",
            }}
          >
            {s}
          </div>
        ))
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete="off"
        className={className}
        style={{ width: "100%", ...style }}
      />
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </div>
  );
}
