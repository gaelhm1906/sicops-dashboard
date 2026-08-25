/**
 * api/psSeguimientoApi.js
 * Cliente para el núcleo real de seguimiento (Etapa 1) de PS_SICOPS_FINAL —
 * ver backend/DISENO_BD_PS_SICOPS_FINAL.md sección 7. Comparte el mismo
 * `psFetch` (token, base URL) que psContratosApi.js.
 */
import { psFetch } from "./psContratosApi";

export async function listarCapturaObra(obraId) {
  return psFetch(`/api/seguimiento/obras/${obraId}/captura`);
}

export async function guardarCapturaObra(obraId, reqId, { estatus, fechaCompromiso, fechaReal, motivo, evidenciaUrl }) {
  return psFetch(`/api/seguimiento/obras/${obraId}/captura/${reqId}`, {
    method: "POST",
    body: JSON.stringify({ estatus, fechaCompromiso, fechaReal, motivo, evidenciaUrl }),
  });
}
