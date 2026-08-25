import React, { useEffect, useState } from "react";

/**
 * Número que cuenta ascendente al aparecer, en vez de saltar directo al
 * valor final — refuerza la sensación de dato calculándose en vivo.
 * Se desactiva si el usuario prefiere menos movimiento.
 */
export default function AnimatedNumber({ value, suffix = "", duration = 800 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let raf;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}{suffix}</>;
}
