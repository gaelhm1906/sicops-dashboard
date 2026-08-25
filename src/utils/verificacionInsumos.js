/**
 * utils/verificacionInsumos.js — REQ-11.
 * Verificación de compra de insumos y entregas extraordinarias (ej.
 * elevadores, estructuras metálicas, montacargas — la minuta da estos
 * como ejemplos, no como catálogo cerrado, así que el insumo es texto
 * libre). Cada insumo captura costo total, porcentaje de pago y factura.
 * Ajuste de reunión con el Secretario (12 de agosto, sesión Cablebús,
 * caso citado: compra de elevadores de las estaciones): "debe rastrearse
 * responsable de compra, proveedor, factura y pago" — factura y pago
 * (% pagado) ya existían, se agregan `proveedor` y `responsableCompra`.
 * Persistencia MOCK en localStorage, namespaced por obra.
 */
import { esSesionReal } from "./seguimiento";
import { getInsumosServidor, putInsumosServidor } from "../api/psCapturaOperativaApi";

const PREFIX = "verificacion_insumos::";

const obraIdsConocidos = new Map();

export function getInsumos(obraKey) {
  try {
    const raw = localStorage.getItem(PREFIX + obraKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardar(obraKey, insumos) {
  try {
    localStorage.setItem(PREFIX + obraKey, JSON.stringify(insumos));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  if (esSesionReal()) {
    const obraId = obraIdsConocidos.get(obraKey);
    if (obraId) putInsumosServidor(obraId, insumos).catch(() => {});
  }
  return insumos;
}

/* Sesión PS real: trae los insumos ya registrados en el servidor y
   registra el obraId para que guardar() sincronice de vuelta. No hace
   nada para el resto de sesiones. */
export async function hidratarInsumosDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  obraIdsConocidos.set(obraKey, obraId);
  try {
    const { insumos } = await getInsumosServidor(obraId);
    if (insumos?.length) {
      localStorage.setItem(PREFIX + obraKey, JSON.stringify(insumos.map((i) => ({
        id: `srv-${i.id}`, nombre: i.nombre, proveedor: i.proveedor || "", responsableCompra: i.responsable_compra || "",
        costoTotal: Number(i.costo_total) || 0, porcentajePago: Number(i.porcentaje_pago) || 0, facturaNombre: i.factura_nombre || null,
      }))));
    }
  } catch {
    // sin conexión: se queda con lo que ya hubiera en cache local
  }
}

export function agregarInsumo(obraKey, datos) {
  const insumos = getInsumos(obraKey);
  const nuevo = {
    id: `insumo-${Date.now()}`,
    nombre: datos.nombre.trim(),
    proveedor: (datos.proveedor || "").trim(),
    responsableCompra: (datos.responsableCompra || "").trim(),
    costoTotal: Number(datos.costoTotal) || 0,
    porcentajePago: Number(datos.porcentajePago) || 0,
    facturaNombre: datos.facturaNombre || null,
  };
  return guardar(obraKey, [nuevo, ...insumos]);
}

export function actualizarInsumo(obraKey, id, cambios) {
  return guardar(obraKey, getInsumos(obraKey).map((i) => (i.id === id ? { ...i, ...cambios } : i)));
}

export function eliminarInsumo(obraKey, id) {
  return guardar(obraKey, getInsumos(obraKey).filter((i) => i.id !== id));
}
