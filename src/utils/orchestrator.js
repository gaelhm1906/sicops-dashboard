/**
 * utils/orchestrator.js
 * Orquestador basado en reglas para preguntas en lenguaje natural.
 * Traduce preguntas → SQL simulado → ejecuta sobre datos reales → Respuesta.
 */

// ── Reglas: patrón regex → descriptor SQL → formateador ───────────
const REGLAS = [
  // ¿Cuántos senderos se construyeron?
  {
    patron:    /cu[aá]ntos?\s+senderos?\s+(se\s+)?construye?ro?n?/i,
    sql:       () => "SELECT COUNT(*) FROM obras WHERE programa LIKE '%Senderos%'",
    ejecutar:  (obras) =>
      obras.filter((o) => o.programa?.toLowerCase().includes("sendero")).length,
    formatear: (n) => `Se registran ${n} obra${n !== 1 ? "s" : ""} en el Programa de Senderos y Espacios Públicos.`,
    ejemplo:   "¿Cuántos senderos se construyeron?",
  },

  // ¿Cuántas obras se actualizaron?
  {
    patron:    /cu[aá]ntas?\s+obras?\s+(se\s+)?actuali[zs]a[ro]/i,
    sql:       () => "SELECT COUNT(*) FROM obras WHERE estado = 'actualizada'",
    ejecutar:  (obras) => obras.filter((o) => o.estado === "actualizada").length,
    formatear: (n) => `${n} obra${n !== 1 ? "s" : ""} ${n === 1 ? "está" : "están"} en estado "actualizada".`,
    ejemplo:   "¿Cuántas obras se actualizaron?",
  },

  // ¿Cuántas obras no se actualizaron / están pendientes?
  {
    patron:    /cu[aá]ntas?\s+obras?\s+(no\s+(se\s+)?(actualiza|tienen)|est[aá]n?\s+pendiente)/i,
    sql:       () => "SELECT COUNT(*) FROM obras WHERE estado = 'pendiente'",
    ejecutar:  (obras) => obras.filter((o) => o.estado === "pendiente").length,
    formatear: (n) => `${n} obra${n !== 1 ? "s" : ""} ${n === 1 ? "está" : "están"} pendiente${n !== 1 ? "s" : ""} de actualización.`,
    ejemplo:   "¿Cuántas obras no se actualizaron?",
  },

  // ¿Cuántas obras están en progreso?
  {
    patron:    /cu[aá]ntas?\s+obras?\s+(est[aá]n?\s+en\s+progreso|en\s+curso)/i,
    sql:       () => "SELECT COUNT(*) FROM obras WHERE estado = 'en_progreso'",
    ejecutar:  (obras) => obras.filter((o) => o.estado === "en_progreso").length,
    formatear: (n) => `${n} obra${n !== 1 ? "s" : ""} ${n === 1 ? "está" : "están"} en progreso.`,
    ejemplo:   "¿Cuántas obras están en progreso?",
  },

  // ¿Cuál es el promedio de avance?
  {
    patron:    /cu[aá]l\s+es\s+el\s+(promedio|avance\s+promedio)/i,
    sql:       () => "SELECT AVG(porcentaje) FROM obras",
    ejecutar:  (obras) => {
      if (!obras.length) return 0;
      return obras.reduce((s, o) => s + (o.porcentaje ?? 0), 0) / obras.length;
    },
    formatear: (avg) => `El avance promedio de todas las obras es ${avg.toFixed(1)}%.`,
    ejemplo:   "¿Cuál es el promedio de avance?",
  },

  // ¿Qué programa tiene mayor avance?
  {
    patron:    /qu[eé]\s+programa\s+(tiene|con)\s+(mayor|m[aá]s)\s+avance/i,
    sql:       () => "SELECT programa, AVG(porcentaje) AS avg FROM obras GROUP BY programa ORDER BY avg DESC LIMIT 1",
    ejecutar:  (obras) => {
      const agrupado = {};
      for (const o of obras) {
        if (!agrupado[o.programa]) agrupado[o.programa] = [];
        agrupado[o.programa].push(o.porcentaje ?? 0);
      }
      let mejor = null, mejorProm = -1;
      for (const [prog, vals] of Object.entries(agrupado)) {
        const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (prom > mejorProm) { mejorProm = prom; mejor = prog; }
      }
      return mejor ? { programa: mejor, avg: mejorProm } : null;
    },
    formatear: (row) =>
      row
        ? `"${row.programa}" tiene el mayor avance promedio con ${row.avg.toFixed(1)}%.`
        : "No se encontraron obras registradas.",
    ejemplo:   "¿Qué programa tiene mayor avance?",
  },

  // ¿Qué programa tiene menor avance?
  {
    patron:    /qu[eé]\s+programa\s+(tiene|con)\s+(menor|menos)\s+avance/i,
    sql:       () => "SELECT programa, AVG(porcentaje) AS avg FROM obras GROUP BY programa ORDER BY avg ASC LIMIT 1",
    ejecutar:  (obras) => {
      const agrupado = {};
      for (const o of obras) {
        if (!agrupado[o.programa]) agrupado[o.programa] = [];
        agrupado[o.programa].push(o.porcentaje ?? 0);
      }
      let peor = null, peorProm = Infinity;
      for (const [prog, vals] of Object.entries(agrupado)) {
        const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (prom < peorProm) { peorProm = prom; peor = prog; }
      }
      return peor ? { programa: peor, avg: peorProm } : null;
    },
    formatear: (row) =>
      row
        ? `"${row.programa}" tiene el menor avance promedio con ${row.avg.toFixed(1)}%.`
        : "No se encontraron obras registradas.",
    ejemplo:   "¿Qué programa tiene menor avance?",
  },

  // ¿Cuántas obras hay en total?
  {
    patron:    /cu[aá]ntas?\s+obras?\s+(hay|existen|est[aá]n?\s+registradas?)/i,
    sql:       () => "SELECT COUNT(*) FROM obras",
    ejecutar:  (obras) => obras.length,
    formatear: (n) => `Hay ${n} obra${n !== 1 ? "s" : ""} registrada${n !== 1 ? "s" : ""} en el sistema.`,
    ejemplo:   "¿Cuántas obras hay en total?",
  },

  // ¿Cuántas obras llegaron al 100%?
  {
    patron:    /cu[aá]ntas?\s+obras?\s+(llegaron|est[aá]n?)\s+(al\s+)?100(%|por\s+ciento)?/i,
    sql:       () => "SELECT COUNT(*) FROM obras WHERE porcentaje = 100",
    ejecutar:  (obras) => obras.filter((o) => o.porcentaje === 100).length,
    formatear: (n) => `${n} obra${n !== 1 ? "s" : ""} ${n === 1 ? "llegó" : "llegaron"} al 100% de avance.`,
    ejemplo:   "¿Cuántas obras llegaron al 100%?",
  },
];

// ── Lista de ejemplos para mostrar en la UI ────────────────────────
export const EJEMPLOS_CONSULTA = REGLAS.map((r) => r.ejemplo);

// ── Función principal ──────────────────────────────────────────────
/**
 * @param {string} pregunta   Texto libre del usuario
 * @param {Array}  obras      Array de obras normalizadas (campo `porcentaje`, `estado`, etc.)
 * @returns {{ respuesta, confianza, fuente, sql, sugerencias }}
 */
export function procesarConsulta(pregunta, obras = []) {
  if (!pregunta || !pregunta.trim()) {
    return {
      respuesta:   "Escribe una pregunta para comenzar.",
      confianza:   0,
      fuente:      null,
      sql:         null,
      sugerencias: EJEMPLOS_CONSULTA.slice(0, 3),
    };
  }

  for (const regla of REGLAS) {
    if (regla.patron.test(pregunta)) {
      const sql       = regla.sql(pregunta);
      const resultado = regla.ejecutar(obras);
      return {
        respuesta:   regla.formatear(resultado),
        confianza:   0.95,
        fuente:      "base de datos",
        sql,
        sugerencias: [],
      };
    }
  }

  // Sin coincidencia
  return {
    respuesta:   "No reconocí esa pregunta. Intenta con alguno de estos ejemplos:",
    confianza:   0,
    fuente:      null,
    sql:         null,
    sugerencias: EJEMPLOS_CONSULTA,
  };
}
