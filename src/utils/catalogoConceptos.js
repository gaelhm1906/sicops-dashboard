/**
 * utils/catalogoConceptos.js — REQ-13.
 * Catálogo de conceptos desglosado por partida (con monto inicial y monto
 * modificado), más el PDF del catálogo completo, más estatus de
 * modificaciones sí/no y en qué partida(s). Persistencia MOCK en
 * localStorage, namespaced por obra.
 *
 * Ajuste de minuta (sesión de revisión #10): las partidas ya no son un
 * catálogo fijo compartido con Generadores de obra — cada área registra
 * las partidas propias de SU catálogo. `PARTIDAS_SUGERIDAS` solo sirve
 * para precargar la primera vez que se abre una obra sin partidas.
 */
import { PARTIDAS_GENERADORES } from "./generadoresObra";
import { esSesionReal } from "./seguimiento";
import { getCatalogoConceptosServidor, putPartidasServidor, putCatalogoConceptosServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "catalogo_conceptos::";
const PARTIDAS_PREFIX = "catalogo_conceptos_partidas::";

export const PARTIDAS_SUGERIDAS = PARTIDAS_GENERADORES;

const obraIdsConocidos = new Map();

export function getPartidas(obraKey) {
  try {
    const raw = localStorage.getItem(PARTIDAS_PREFIX + obraKey);
    return raw ? JSON.parse(raw) : [...PARTIDAS_SUGERIDAS];
  } catch {
    return [...PARTIDAS_SUGERIDAS];
  }
}

function guardarPartidas(obraKey, partidas) {
  try {
    localStorage.setItem(PARTIDAS_PREFIX + obraKey, JSON.stringify(partidas));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putPartidasServidor(obraId, partidas).catch(() => {});
  }
  return partidas;
}

export function agregarPartida(obraKey, nombre) {
  const limpio = (nombre || "").trim();
  const actuales = getPartidas(obraKey);
  if (!limpio || actuales.includes(limpio)) return actuales;
  return guardarPartidas(obraKey, [...actuales, limpio]);
}

export function eliminarPartida(obraKey, nombre) {
  const next = getPartidas(obraKey).filter((p) => p !== nombre);
  guardarPartidas(obraKey, next);

  /* limpiar montos y marcas huérfanas de la partida eliminada */
  const estado = getCatalogo(obraKey);
  const montosPorPartida = { ...estado.montosPorPartida };
  const montosModificadosPorPartida = { ...estado.montosModificadosPorPartida };
  delete montosPorPartida[nombre];
  delete montosModificadosPorPartida[nombre];
  guardarCatalogo(obraKey, {
    ...estado,
    montosPorPartida,
    montosModificadosPorPartida,
    partidasModificadas: estado.partidasModificadas.filter((p) => p !== nombre),
  });

  return next;
}

function estadoVacio(partidas) {
  return {
    montosPorPartida: Object.fromEntries(partidas.map((p) => [p, ""])),
    montosModificadosPorPartida: Object.fromEntries(partidas.map((p) => [p, ""])),
    pdfNombre: null,
    huboModificaciones: false,
    partidasModificadas: [],
    descripcionModificacion: "",
  };
}

export function getCatalogo(obraKey) {
  const partidas = getPartidas(obraKey);
  const vacio = estadoVacio(partidas);
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    const data = raw ? JSON.parse(raw) : null;
    return {
      ...vacio,
      ...data,
      montosPorPartida: { ...vacio.montosPorPartida, ...(data?.montosPorPartida || {}) },
      montosModificadosPorPartida: { ...vacio.montosModificadosPorPartida, ...(data?.montosModificadosPorPartida || {}) },
    };
  } catch {
    return vacio;
  }
}

export function guardarCatalogo(obraKey, estado) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(estado));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putCatalogoConceptosServidor(obraId, estado).catch(() => {});
  }
  return estado;
}

/* Sesión PS real: trae partidas + montos + metadatos ya guardados en el
   servidor y registra el obraId para que guardarPartidas()/
   guardarCatalogo() sincronicen de vuelta. No hace nada para el resto de
   sesiones. */
export async function hidratarCatalogoConceptosDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidos.set(obraKey, obraId);
  try {
    const d = await getCatalogoConceptosServidor(obraId);
    if (d.partidas?.length) {
      localStorage.setItem(PARTIDAS_PREFIX + obraKey, JSON.stringify(d.partidas));
      localStorage.setItem(PREFIX + obraKey, JSON.stringify({
        montosPorPartida: d.montosPorPartida,
        montosModificadosPorPartida: d.montosModificadosPorPartida,
        pdfNombre: d.pdfNombre,
        huboModificaciones: d.huboModificaciones,
        partidasModificadas: d.partidasModificadas,
        descripcionModificacion: d.descripcionModificacion,
      }));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

export function montoTotal(estado) {
  return Object.values(estado.montosPorPartida).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

export function montoModificadoTotal(estado) {
  return Object.values(estado.montosModificadosPorPartida).reduce((acc, v) => acc + (Number(v) || 0), 0);
}
