/**
 * utils/turnosTrabajo.js — REQ-10.
 * Ajuste de minuta (revisión de programa de obra): tres turnos de ocho
 * horas que cubren el día completo (se incorpora el turno regular/diurno
 * que faltaba), y se eliminan las validaciones de geolocalización y de
 * ventana horaria — basta con que el Director de Obra cargue el reporte
 * de cumplimiento de horarios de la empresa. Persistencia MOCK en
 * localStorage, namespaced por obra + día.
 */
import { esSesionReal } from "./seguimiento";
import { getTurnosServidor, postTurnoServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "turnos_trabajo::";

export const TURNO = {
  MATUTINO: "matutino",
  VESPERTINO: "vespertino",
  NOCTURNO: "nocturno",
};

export const TURNO_INFO = {
  [TURNO.MATUTINO]: { label: "Matutino", rango: "06:00–14:00" },
  [TURNO.VESPERTINO]: { label: "Vespertino", rango: "14:00–22:00" },
  [TURNO.NOCTURNO]: { label: "Nocturno", rango: "22:00–06:00" },
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function clave(obraKey) {
  return `${PREFIX}${obraKey}::${hoyISO()}`;
}

export function getTurnosHoy(obraKey) {
  try {
    const raw = localStorage.getItem(clave(obraKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function registrarTurno(obraKey, { turno, usuario, reporteNombre }, obraId) {
  const turnos = getTurnosHoy(obraKey);
  const nuevo = {
    id: `turno-${Date.now()}`,
    turno,
    usuario: usuario || "sistema",
    reporteNombre: reporteNombre || null,
    hora: new Date().toISOString(),
  };
  const next = [nuevo, ...turnos];
  try {
    localStorage.setItem(clave(obraKey), JSON.stringify(next));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal() && obraId) {
    postTurnoServidor(obraId, { turno, reporteNombre }).catch(() => {});
  }
  return next;
}

/* Sesión PS real: trae los turnos de hoy ya registrados en el servidor
   (por si otro dispositivo/sesión ya capturó alguno) y los escribe en
   localStorage antes de que la pantalla los lea. No hace nada para el
   resto de sesiones. */
export async function hidratarTurnosDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  try {
    const { turnos } = await getTurnosServidor(obraId);
    if (turnos?.length) {
      const locales = getTurnosHoy(obraKey);
      const idsLocales = new Set(locales.map((t) => t.usuario + t.turno + t.hora));
      const delServidor = turnos.map((t) => ({
        id: `srv-${t.id}`, turno: t.turno, usuario: t.usuario || "sistema", reporteNombre: t.reporte_nombre, hora: t.creado_en,
      }));
      // combina sin duplicar lo que ya se había sincronizado desde este mismo navegador
      const combinados = [...delServidor, ...locales.filter((l) => !delServidor.some((s) => s.hora === l.hora && s.turno === l.turno))];
      localStorage.setItem(clave(obraKey), JSON.stringify(combinados));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}
