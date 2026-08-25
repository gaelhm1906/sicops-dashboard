/**
 * api/psEvidenciaApi.js
 * Cliente para la galería real de evidencia (fotos/video) de un
 * requerimiento — ver backend/utils/uploadsEvidencia.js. No reutiliza
 * `psFetch` de psContratosApi.js porque ese fuerza `Content-Type: application/json`
 * y hace `JSON.stringify` del body; una subida de archivos necesita
 * `FormData` con su propio boundary (el navegador lo arma solo si NO se
 * fija `Content-Type` a mano).
 */
import { PS_BASE_URL, getPsToken } from "./psContratosApi";

async function leerRespuesta(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Error ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function listarEvidenciaServidor(obraId, reqId) {
  const res = await fetch(`${PS_BASE_URL}/api/evidencia/${obraId}/${reqId}`, {
    headers: { Authorization: `Bearer ${getPsToken()}` },
  });
  return leerRespuesta(res);
}

/** `archivos`: array de File (ya comprimidos si son imagen, ver utils/imageCompression.js) */
export async function subirEvidenciaServidor(obraId, reqId, archivos) {
  const formData = new FormData();
  archivos.forEach((f) => formData.append("archivos", f));
  const res = await fetch(`${PS_BASE_URL}/api/evidencia/${obraId}/${reqId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getPsToken()}` },
    body: formData,
  });
  return leerRespuesta(res);
}

export async function eliminarEvidenciaServidor(id) {
  const res = await fetch(`${PS_BASE_URL}/api/evidencia/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getPsToken()}` },
  });
  return leerRespuesta(res);
}

/** URL absoluta servible de un archivo — el backend devuelve rutas
 *  relativas (`/uploads/evidencia/...`), hay que anteponerles el origen
 *  real de la API (distinto del origen del frontend). */
export function urlAbsolutaEvidencia(rutaRelativa) {
  if (!rutaRelativa) return null;
  return `${PS_BASE_URL}${rutaRelativa}`;
}
