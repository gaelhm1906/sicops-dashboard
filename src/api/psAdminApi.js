/**
 * api/psAdminApi.js
 * Cliente para el módulo de administración de PS_SICOPS_FINAL — alta
 * masiva de obras desde GeoJSON. Solo accesible a cuentas con rol ADMIN
 * (el backend lo vuelve a validar, esto es solo la capa de transporte).
 */
import { psFetch } from "./psContratosApi";

export async function listarDgs() {
  return psFetch("/api/admin/dgs");
}

export async function listarProgramasDg(dgId, todos = false) {
  const params = new URLSearchParams();
  if (dgId) params.set("dgId", dgId);
  if (todos) params.set("todos", "1");
  return psFetch(`/api/admin/programas?${params.toString()}`);
}

export async function listarCatalogosObra() {
  return psFetch("/api/admin/catalogos-obra");
}

export async function previsualizarGeoJSON(geojson, dgId, programaId) {
  return psFetch("/api/admin/obras/previsualizar", {
    method: "POST",
    body: JSON.stringify({ geojson, dgId, programaId }),
  });
}

export async function confirmarImportacion(payload) {
  return psFetch("/api/admin/obras/confirmar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
