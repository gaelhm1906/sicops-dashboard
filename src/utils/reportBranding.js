/**
 * utils/reportBranding.js
 * Logo institucional SOBSE para reportes PDF.
 * Portado de Centro de Mando (reportBranding.ts).
 * Convierte el logo a base64 para evitar problemas CORS en ventanas de impresión.
 */

const LOGO_URL = "https://plataformasobse.info/web/assets/img/LOGO-NUEVO.png";

let logoCache = null;

export function getReportLogoSrc() {
  return LOGO_URL;
}

async function fileToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

async function tryFetchAsDataUrl(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return "";
    return fileToDataUrl(await res.blob());
  } catch {
    return "";
  }
}

/** Descarga el logo una vez y lo cachea como data URL base64. */
export async function getReportLogoDataUrl() {
  if (logoCache !== null) return logoCache;
  logoCache = await tryFetchAsDataUrl(LOGO_URL);
  return logoCache;
}
