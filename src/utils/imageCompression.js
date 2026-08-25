/**
 * utils/imageCompression.js
 * Comprime una foto en el navegador ANTES de subirla — mismo criterio ya
 * probado en el proyecto hermano "Conservación Vial"
 * (services/imageCompression.ts): las fotos de campo llegan directo de la
 * cámara del celular (2-8 MB) y no hay razón para mandarlas así, satura la
 * conexión de campo sin ninguna ganancia (nadie necesita 12 megapixeles
 * para una foto de evidencia). Reduce a un JPEG de lado máximo 1400px y
 * calidad 0.72 — en la práctica queda en unos cientos de KB.
 *
 * Video NO se comprime aquí: no existe una forma barata de re-codificar
 * video en el navegador (canvas solo sirve para imágenes) y el celular ya
 * lo entrega razonablemente comprimido (H.264/HEVC). En vez de comprimir,
 * `validarVideo` topa el tamaño antes de intentar subirlo.
 */
const LADO_MAX = 1400;
const CALIDAD = 0.72;

/** Devuelve un File JPEG ya comprimido, listo para mandar en un FormData.
 *  Si el archivo no es una imagen válida, se rechaza — quien llama decide
 *  si sube el original tal cual o avisa al usuario. */
export function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No se pudo procesar la imagen en este navegador.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("No se pudo comprimir la imagen.")); return; }
          const nombre = file.name.replace(/\.[a-zA-Z0-9]+$/, "") + ".jpg";
          resolve(new File([blob], nombre, { type: "image/jpeg" }));
        },
        "image/jpeg",
        CALIDAD
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El archivo seleccionado no es una imagen válida."));
    };
    img.src = url;
  });
}

const VIDEO_MAX_BYTES = 80 * 1024 * 1024; // mismo tope que el backend, ver utils/uploadsEvidencia.js

/** No comprime — solo valida que el archivo no exceda el tope que el
 *  backend de todas formas va a aplicar, para avisar ANTES de subir en vez
 *  de que el usuario espere una carga larga que termine rechazada. */
export function validarVideo(file) {
  if (file.size > VIDEO_MAX_BYTES) {
    return { ok: false, motivo: `El video pesa ${(file.size / 1024 / 1024).toFixed(1)}MB — el máximo permitido es ${VIDEO_MAX_BYTES / 1024 / 1024}MB.` };
  }
  return { ok: true };
}
