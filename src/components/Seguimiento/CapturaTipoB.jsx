import React, { useCallback, useEffect, useState } from "react";
import Button from "../Shared/Button";
import { ESTATUS_REGISTRO, esSesionReal } from "../../utils/seguimiento";
import { comprimirImagen, validarVideo } from "../../utils/imageCompression";
import {
  listarEvidenciaServidor, subirEvidenciaServidor, eliminarEvidenciaServidor, urlAbsolutaEvidencia,
} from "../../api/psEvidenciaApi";

/* Tipo B — carga de multimedia (reporte fotográfico 360°, video, memoria
   fotográfica: REQ-07/08/20). Hasta 2026-08-21 esto solo "recordaba" el
   nombre del archivo elegido — nunca se guardaba en ningún lado, ni
   localStorage ni servidor (ver evidencia_url en seguimiento_captura,
   llevaba un nombre de archivo, no una URL real). En sesión PS real con
   obra migrada, ahora sí sube de verdad: las fotos se comprimen en el
   navegador antes de subir (ver utils/imageCompression.js), el video se
   manda tal cual (topado de tamaño). Fuera de sesión PS real (resto de la
   app, en demo/localStorage) se conserva el comportamiento de antes —
   nunca sube nada, solo recuerda el nombre elegido. */
export default function CapturaTipoB({ registro, onGuardar, onCancelar, obra }) {
  const obraId = obra?.id;
  const reqId = registro?.reqId;
  const sesionReal = esSesionReal() && !!obraId && !!reqId;

  const [galeria, setGaleria] = useState([]);
  const [cargandoGaleria, setCargandoGaleria] = useState(sesionReal);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [eliminando, setEliminando] = useState(null); // id en curso

  // Modo local (sin sesión PS real, o la obra no está migrada) — mismo
  // comportamiento de siempre, solo recuerda nombres de archivo elegidos.
  const [archivosLocal, setArchivosLocal] = useState([]);

  useEffect(() => {
    if (!sesionReal) { setCargandoGaleria(false); return; }
    let cancelado = false;
    listarEvidenciaServidor(obraId, reqId)
      .then((d) => { if (!cancelado) setGaleria(d.archivos || []); })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCargandoGaleria(false); });
    return () => { cancelado = true; };
  }, [sesionReal, obraId, reqId]);

  const subirArchivosReales = useCallback(async (fileList) => {
    const archivos = Array.from(fileList || []);
    if (archivos.length === 0) return;
    setSubiendo(true);
    setErrorSubida("");
    try {
      const procesados = [];
      const problemas = [];
      for (const f of archivos) {
        if (f.type.startsWith("image/")) {
          try { procesados.push(await comprimirImagen(f)); } catch (err) { problemas.push(`${f.name}: ${err.message}`); }
        } else if (f.type.startsWith("video/")) {
          const v = validarVideo(f);
          if (v.ok) procesados.push(f); else problemas.push(`${f.name}: ${v.motivo}`);
        } else {
          problemas.push(`${f.name}: solo se aceptan fotos o video.`);
        }
      }
      if (procesados.length > 0) {
        const data = await subirEvidenciaServidor(obraId, reqId, procesados);
        setGaleria((prev) => [...(data.archivos || []), ...prev]);
        if (data.rechazados?.length) problemas.push(...data.rechazados.map((r) => `${r.nombre}: ${r.motivo}`));
      }
      if (problemas.length) setErrorSubida(problemas.join(" · "));
    } catch (err) {
      setErrorSubida(err.message);
    } finally {
      setSubiendo(false);
    }
  }, [obraId, reqId]);

  const agregarArchivosLocal = useCallback((fileList) => {
    const nuevos = Array.from(fileList || []);
    if (nuevos.length === 0) return;
    setArchivosLocal((prev) => [...prev, ...nuevos]);
  }, []);

  const handleArchivosElegidos = useCallback((fileList) => {
    if (sesionReal) subirArchivosReales(fileList);
    else agregarArchivosLocal(fileList);
  }, [sesionReal, subirArchivosReales, agregarArchivosLocal]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setArrastrando(false);
    handleArchivosElegidos(e.dataTransfer.files);
  }, [handleArchivosElegidos]);

  const quitarArchivoLocal = (idx) => setArchivosLocal((prev) => prev.filter((_, i) => i !== idx));

  const handleEliminarDeGaleria = async (archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.nombreOriginal}"? No se puede deshacer.`)) return;
    setEliminando(archivo.id);
    try {
      await eliminarEvidenciaServidor(archivo.id);
      setGaleria((prev) => prev.filter((a) => a.id !== archivo.id));
    } catch (err) {
      setErrorSubida(err.message);
    } finally {
      setEliminando(null);
    }
  };

  const guardar = () => {
    let nombreEvidencia;
    if (sesionReal) {
      nombreEvidencia = galeria.length > 0
        ? `${galeria.length} archivo(s) en galería (${galeria.filter((a) => a.tipo === "imagen").length} foto, ${galeria.filter((a) => a.tipo === "video").length} video)`
        : registro.evidenciaNombre;
    } else {
      nombreEvidencia = archivosLocal.length > 0
        ? archivosLocal.length === 1 ? archivosLocal[0].name : `${archivosLocal.length} archivos adjuntos`
        : registro.evidenciaNombre;
    }
    onGuardar({
      estatus: ESTATUS_REGISTRO.CUMPLIDO,
      fechaReal: new Date().toISOString().slice(0, 10),
      evidenciaNombre: nombreEvidencia,
    });
  };

  const hayAlgoGuardable = sesionReal
    ? galeria.length > 0 || !!registro.evidenciaNombre
    : archivosLocal.length > 0 || !!registro.evidenciaNombre;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={handleDrop}
        className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4 py-6 transition-colors"
        style={{
          borderColor: arrastrando ? "#691C32" : "#D4C4B0",
          backgroundColor: arrastrando ? "rgba(105,28,50,0.04)" : "#FAF8F5",
        }}
      >
        <span className="text-2xl mb-1">🎞️</span>
        <p className="text-sm font-medium" style={{ color: "#4b5563" }}>
          Arrastra fotos o video aquí
        </p>
        <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
          {sesionReal ? "se comprimen y suben al confirmar la selección" : "o selecciona un archivo"}
        </p>
        <label
          className="mt-3 inline-block px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
          style={{ backgroundColor: "#691C32", color: "#fff", opacity: subiendo ? 0.6 : 1 }}
        >
          {subiendo ? "Subiendo…" : "Elegir archivos"}
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => { handleArchivosElegidos(e.target.files); e.target.value = ""; }}
          />
        </label>
      </div>

      {errorSubida && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FBEAE8", color: "#B3261E" }}>⚠ {errorSubida}</p>
      )}

      {sesionReal ? (
        <>
          {cargandoGaleria ? (
            <p className="text-xs" style={{ color: "#9ca3af" }}>Cargando galería…</p>
          ) : galeria.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {galeria.map((a) => (
                <div key={a.id} className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: "1", backgroundColor: "#F1EBE3" }}>
                  {a.tipo === "imagen" ? (
                    <img
                      src={urlAbsolutaEvidencia(a.urlThumb || a.url)}
                      alt={a.nombreOriginal}
                      className="w-full h-full object-cover"
                      onClick={() => window.open(urlAbsolutaEvidencia(a.url), "_blank")}
                      style={{ cursor: "pointer" }}
                    />
                  ) : (
                    <video src={urlAbsolutaEvidencia(a.url)} className="w-full h-full object-cover" controls />
                  )}
                  <button
                    type="button"
                    onClick={() => handleEliminarDeGaleria(a)}
                    disabled={eliminando === a.id}
                    title="Eliminar"
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold leading-none"
                    style={{ color: "#B3261E", backgroundColor: "#fff", opacity: eliminando === a.id ? 0.5 : 0.92 }}
                  >
                    {eliminando === a.id ? "…" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          ) : registro.evidenciaNombre ? (
            <p className="text-xs" style={{ color: "#6b7280" }}>📎 Última evidencia: {registro.evidenciaNombre}</p>
          ) : null}
        </>
      ) : (
        <>
          {archivosLocal.length === 0 && registro.evidenciaNombre && (
            <p className="text-xs" style={{ color: "#6b7280" }}>📎 Última evidencia: {registro.evidenciaNombre}</p>
          )}
          {archivosLocal.length > 0 && (
            <ul className="space-y-1">
              {archivosLocal.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#F8F5F2" }}
                >
                  <span className="truncate" style={{ color: "#374151" }}>📎 {f.name}</span>
                  <button type="button" onClick={() => quitarArchivoLocal(i)} className="ml-2 font-bold" style={{ color: "#b91c1c" }}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button size="sm" onClick={guardar} disabled={!hayAlgoGuardable || subiendo}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
