/**
 * api/psDatosFinancierosApi.js
 * "Datos Contractuales Financieros" (deducciones específicas, sanciones,
 * retenciones) — los captura Supervisión Externa, sobre su propio
 * contrato, antes de entrar a su programa de obra. Ver
 * backend/controllers/datosFinancierosController.js.
 */
import { psFetch } from "./psContratosApi";

export async function obtenerDatosFinancierosServidor(contratoId) {
  return psFetch(`/api/datos-financieros/${contratoId}`);
}

export async function guardarDatosFinancierosServidor(contratoId, datos) {
  return psFetch(`/api/datos-financieros/${contratoId}`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
}
