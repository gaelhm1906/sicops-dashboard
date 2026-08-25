import React, { useEffect, useState } from "react";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Button from "../components/Shared/Button";
import { useAuth } from "../context/AuthContext";
import { listarDgs, listarProgramasDg, listarCatalogosObra, previsualizarGeoJSON, confirmarImportacion } from "../api/psAdminApi";

const ESTATUSES = ["SIN INICIAR", "EN PROCESO", "SUSPENDIDO", "TERMINADO", "ENTREGADO", "INAUGURADA", "CANCELADA"];
const DIRECCIONES = ["A", "B", "C", "D"];

/* Solo cuentas ADMIN de PS_SICOPS_FINAL — dar de alta obras reales es una
   operación delicada, se restringe a administración del sistema. */
function SinAcceso() {
  return (
    <div className="max-w-md mx-auto mt-16 rounded-2xl p-6 text-center" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Este módulo no está disponible para tu cuenta</p>
      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>La alta masiva de obras es solo para cuentas de administración.</p>
    </div>
  );
}

function leerArchivoComoJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error("El archivo no es un GeoJSON válido."));
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
}

export default function AdminImportarObras() {
  const { user } = useAuth();

  const [dgs, setDgs] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [verTodosProgramas, setVerTodosProgramas] = useState(false);
  const [ejesDisponibles, setEjesDisponibles] = useState([]);
  const [bloquesDisponibles, setBloquesDisponibles] = useState([]);
  const [origenesDisponibles, setOrigenesDisponibles] = useState([]);
  const [modalidadesDisponibles, setModalidadesDisponibles] = useState([]);
  const [dgId, setDgId] = useState("");
  const [programaId, setProgramaId] = useState("");
  const [avisoProgramaOtraDg, setAvisoProgramaOtraDg] = useState(null);
  const [anio, setAnio] = useState(2026);
  const [estatus, setEstatus] = useState("SIN INICIAR");
  const [direccionInterna, setDireccionInterna] = useState("");
  const [claveEje, setClaveEje] = useState("");
  const [nombreEje, setNombreEje] = useState("");
  const [bloqueMundial, setBloqueMundial] = useState("");
  const [origenCompromiso, setOrigenCompromiso] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [responsableDgLote, setResponsableDgLote] = useState("");

  const [nombreArchivo, setNombreArchivo] = useState("");
  const [geojsonCrudo, setGeojsonCrudo] = useState(null);
  const [filas, setFilas] = useState(null); // null = todavía no se previsualizó
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (user?.rol !== "ADMIN") return;
    listarDgs().then((d) => setDgs(d.dgs)).catch((err) => setMensaje("Error: " + err.message));
    listarCatalogosObra().then((d) => {
      setEjesDisponibles(d.ejes);
      setBloquesDisponibles(d.bloquesMundiales);
      setOrigenesDisponibles(d.origenesCompromiso);
      setModalidadesDisponibles(d.modalidades);
    }).catch(() => {});
  }, [user]);

  // Un programa puede haber cambiado de DG de un año a otro — por default
  // se filtra por la DG elegida (lo normal), pero "ver todos" lo relaja.
  useEffect(() => {
    if (!dgId && !verTodosProgramas) { setProgramas([]); setProgramaId(""); return; }
    listarProgramasDg(dgId, verTodosProgramas).then((d) => setProgramas(d.programas)).catch((err) => setMensaje("Error: " + err.message));
  }, [dgId, verTodosProgramas]);

  if (user?.rol !== "ADMIN") return <SinAcceso />;

  const puedePrevisualizar = dgId && programaId && geojsonCrudo;

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMensaje("");
    setFilas(null);
    setResultado(null);
    try {
      const data = await leerArchivoComoJSON(file);
      if (!data?.features?.length) throw new Error("El archivo no tiene features.");
      setGeojsonCrudo(data);
      setNombreArchivo(file.name);
    } catch (err) {
      setMensaje("Error: " + err.message);
      setGeojsonCrudo(null);
      setNombreArchivo("");
    }
  };

  const handlePrevisualizar = async () => {
    setCargandoPreview(true);
    setMensaje("");
    setResultado(null);
    try {
      const data = await previsualizarGeoJSON(geojsonCrudo, dgId, programaId);
      setFilas(data.filas);
      setAvisoProgramaOtraDg(data.programaDeOtraDg || null);
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setCargandoPreview(false);
    }
  };

  const actualizarFila = (index, cambios) => {
    setFilas((prev) => prev.map((f) => (f.index === index ? { ...f, ...cambios } : f)));
  };

  // Responsable DG y Supervisión Interna suelen ser iguales para todo el
  // lote (un mismo programa) — calle y URL de Google Maps NO, cada obra
  // tiene su propia dirección, no tiene caso ofrecer "aplicar a todas" ahí.
  const aplicarResponsableATodas = () => {
    if (!responsableDgLote.trim()) return;
    setFilas((prev) => prev.map((f) => ({ ...f, responsableDg: responsableDgLote.trim() })));
  };

  // Calle, URL de Google Maps y responsable DG los captura idealmente el
  // área responsable — durante pruebas se permite dejarlos vacíos y
  // completarlos después, así que esto ya no bloquea la confirmación,
  // solo se muestra como aviso.
  const filasIncompletas = filas ? filas.filter((f) => !f.calle?.trim() || !f.urlGoogleMaps?.trim() || !f.responsableDg?.trim()) : [];

  const handleConfirmar = async () => {
    const advertenciaIncompletas = filasIncompletas.length > 0
      ? `\n\n${filasIncompletas.length} obra(s) quedarán sin calle, URL de Google Maps o responsable DG — se pueden completar después.`
      : "";
    if (!window.confirm(`¿Crear ${filas.length} obra(s) reales en ${dgs.find((d) => d.id === Number(dgId))?.clave || "esta DG"}? Esta acción escribe en producción.${advertenciaIncompletas}`)) return;
    setConfirmando(true);
    setMensaje("");
    try {
      const data = await confirmarImportacion({
        dgId: Number(dgId),
        programaId: Number(programaId),
        anio: Number(anio),
        estatus,
        direccionInterna: direccionInterna || null,
        claveEje: claveEje || null,
        nombreEje: nombreEje || null,
        bloqueMundial: bloqueMundial ? Number(bloqueMundial) : null,
        origenCompromiso: origenCompromiso || null,
        modalidad: modalidad || null,
        obras: filas.map((f) => ({
          nombre: f.nombre, geometry: f.geometry, alcaldia: f.alcaldia, colonia: f.colonia, sector: f.sector, claveUnica: f.claveUnica,
          calle: f.calle, urlGoogleMaps: f.urlGoogleMaps, responsableDg: f.responsableDg, supervisionInterna: f.supervisionInterna,
        })),
      });
      setResultado(data);
      setFilas(null);
      setGeojsonCrudo(null);
      setNombreArchivo("");
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setConfirmando(false);
    }
  };

  const totalAdvertencias = filas ? filas.filter((f) => f.advertencias.length > 0).length : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full">
            <div className="mb-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h1 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>Importar obras desde GeoJSON</h1>
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Sube el GeoJSON de las obras nuevas — geometría y nombre se toman del archivo; alcaldía, colonia y sector se resuelven automáticamente contra las capas de referencia.
              </p>
            </div>

            {mensaje && (
              <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--rojo-soft, #FBEAE8)", color: "var(--rojo)" }}>
                {mensaje}
              </div>
            )}

            {resultado && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--verde-soft, #E3F1EC)", color: "var(--verde)" }}>
                ✓ {resultado.message}
              </div>
            )}

            <div className="rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>1 · Datos del lote</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Dirección General</label>
                  <select value={dgId} onChange={(e) => setDgId(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <option value="">Elegir…</option>
                    {dgs.map((d) => <option key={d.id} value={d.id}>{d.clave}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>Programa</label>
                    <button
                      type="button"
                      onClick={() => setVerTodosProgramas((v) => !v)}
                      className="text-[10px] font-bold"
                      style={{ color: "var(--guinda)" }}
                    >
                      {verTodosProgramas ? "Ver solo de esta DG" : "Ver todos (otras DG)"}
                    </button>
                  </div>
                  <select value={programaId} onChange={(e) => setProgramaId(e.target.value)} disabled={!dgId && !verTodosProgramas} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <option value="">Elegir…</option>
                    {programas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}{verTodosProgramas ? ` (${p.dgClave || p.dg_id})` : ""}</option>
                    ))}
                  </select>
                  {avisoProgramaOtraDg && (
                    <p className="text-[10px] font-semibold mt-1" style={{ color: "var(--naranja, #B5680A)" }}>
                      ⚠ Este programa está catalogado bajo {avisoProgramaOtraDg} — se usará igual para esta DG.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Año</label>
                  <input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Estatus inicial</label>
                  <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    {ESTATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Dirección interna (opcional)</label>
                  <select value={direccionInterna} onChange={(e) => setDireccionInterna(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <option value="">— sin asignar —</option>
                    {DIRECCIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Clave de eje (opcional)</label>
                  <input
                    value={claveEje}
                    onChange={(e) => {
                      setClaveEje(e.target.value);
                      const match = ejesDisponibles.find((x) => x.clave_eje === e.target.value);
                      if (match) setNombreEje(match.nombre_eje || "");
                    }}
                    list="lista-claves-eje"
                    placeholder="ej. GRANDES_OBRAS"
                    className="w-full px-2.5 py-2 text-xs rounded-lg"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <datalist id="lista-claves-eje">
                    {ejesDisponibles.map((e) => <option key={e.clave_eje} value={e.clave_eje} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Nombre de eje (opcional)</label>
                  <input value={nombreEje} onChange={(e) => setNombreEje(e.target.value)} list="lista-nombres-eje" className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                  <datalist id="lista-nombres-eje">
                    {[...new Set(ejesDisponibles.map((e) => e.nombre_eje).filter(Boolean))].map((n) => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Bloque mundial (opcional)</label>
                  <input type="number" value={bloqueMundial} onChange={(e) => setBloqueMundial(e.target.value)} list="lista-bloques" className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                  <datalist id="lista-bloques">
                    {bloquesDisponibles.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Origen del compromiso (opcional)</label>
                  <input value={origenCompromiso} onChange={(e) => setOrigenCompromiso(e.target.value)} list="lista-origenes" className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                  <datalist id="lista-origenes">
                    {origenesDisponibles.map((o) => <option key={o} value={o} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Modalidad (opcional)</label>
                  <input value={modalidad} onChange={(e) => setModalidad(e.target.value)} list="lista-modalidades" className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                  <datalist id="lista-modalidades">
                    {modalidadesDisponibles.map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>Responsable DG (para todas — opcional)</label>
                  <div className="flex gap-1.5">
                    <input value={responsableDgLote} onChange={(e) => setResponsableDgLote(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)" }} />
                    <button type="button" onClick={aplicarResponsableATodas} disabled={!filas || !responsableDgLote.trim()} className="text-[10px] font-bold px-2 rounded-lg shrink-0" style={{ border: "1px solid var(--border)", color: "var(--guinda)" }}>
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[10px] mt-3" style={{ color: "var(--ink-faint)" }}>
                Calle, URL de Google Maps y Responsable DG se capturan por obra en la tabla de revisión (paso 3) — lo normal es que los complete el área responsable; si aún no se tienen, se puede importar sin ellos y completarlos después.
              </p>
            </div>

            <div className="rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>2 · Archivo GeoJSON</p>
              <div className="flex items-center gap-3">
                <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleArchivo} className="text-xs" />
                {nombreArchivo && <span className="text-xs font-semibold" style={{ color: "var(--verde)" }}>✓ {nombreArchivo} ({geojsonCrudo?.features?.length} features)</span>}
              </div>
              <div className="mt-3">
                <Button onClick={handlePrevisualizar} disabled={!puedePrevisualizar || cargandoPreview} className="w-fit">
                  {cargandoPreview ? "Analizando…" : "Previsualizar"}
                </Button>
              </div>
            </div>

            {filas && (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                <div className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>3 · Revisar antes de confirmar ({filas.length} obras)</p>
                  <div className="flex items-center gap-2">
                    {totalAdvertencias > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--naranja-soft, #FBEEDC)", color: "var(--naranja, #B5680A)" }}>
                        {totalAdvertencias} con advertencia
                      </span>
                    )}
                    {filasIncompletas.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--rojo-soft, #FBEAE8)", color: "var(--rojo)" }} title="Se pueden completar después">
                        {filasIncompletas.length} sin calle/URL/responsable
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
                      <tr>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Nombre</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Geometría</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Alcaldía</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Colonia</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Sector</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Clave única</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Calle</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>URL Google Maps</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Responsable DG</th>
                        <th className="text-left px-3 py-2 font-bold" style={{ color: "var(--ink-faint)" }}>Superv. interna</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => {
                        const incompleta = !f.calle?.trim() || !f.urlGoogleMaps?.trim() || !f.responsableDg?.trim();
                        return (
                        <tr key={f.index} style={{ borderTop: "1px solid var(--border-soft)", background: incompleta ? "var(--surface-2, #F3EFEA)" : f.advertencias.length > 0 ? "var(--naranja-soft, #FBEEDC)" : "transparent" }}>
                          <td className="px-3 py-2">
                            <input value={f.nombre} onChange={(e) => actualizarFila(f.index, { nombre: e.target.value })} className="w-full px-1.5 py-1 rounded" style={{ border: "1px solid var(--border-soft)", background: "var(--surface)" }} />
                            {f.advertencias.length > 0 && (
                              <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--naranja, #B5680A)" }}>⚠ {f.advertencias.join(" · ")}</p>
                            )}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--ink-soft)" }}>{f.tipoGeometria || "—"}</td>
                          <td className="px-3 py-2" style={{ color: f.alcaldia ? "var(--ink)" : "var(--rojo)" }}>{f.alcaldia || "sin resolver"}</td>
                          <td className="px-3 py-2" style={{ color: "var(--ink)" }}>{f.colonia || "—"}</td>
                          <td className="px-3 py-2" style={{ color: "var(--ink)" }}>{f.sector || "—"}</td>
                          <td className="px-3 py-2">
                            <input value={f.claveUnica} onChange={(e) => actualizarFila(f.index, { claveUnica: e.target.value })} className="w-full px-1.5 py-1 rounded font-mono" style={{ border: "1px solid var(--border-soft)", background: "var(--surface)", fontSize: "10px" }} />
                          </td>
                          <td className="px-3 py-2">
                            <input value={f.calle} onChange={(e) => actualizarFila(f.index, { calle: e.target.value })} placeholder="pendiente — se puede dejar vacío" className="w-full px-1.5 py-1 rounded" style={{ border: "1px solid var(--border-soft)", background: "var(--surface)" }} />
                          </td>
                          <td className="px-3 py-2">
                            <input value={f.urlGoogleMaps} onChange={(e) => actualizarFila(f.index, { urlGoogleMaps: e.target.value })} placeholder="pendiente — se puede dejar vacío" className="w-full px-1.5 py-1 rounded" style={{ border: "1px solid var(--border-soft)", background: "var(--surface)" }} />
                          </td>
                          <td className="px-3 py-2">
                            <input value={f.responsableDg} onChange={(e) => actualizarFila(f.index, { responsableDg: e.target.value })} placeholder="pendiente — se puede dejar vacío" className="w-full px-1.5 py-1 rounded" style={{ border: "1px solid var(--border-soft)", background: "var(--surface)" }} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={!!f.supervisionInterna} onChange={(e) => actualizarFila(f.index, { supervisionInterna: e.target.checked })} style={{ accentColor: "var(--guinda)" }} />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <Button onClick={handleConfirmar} disabled={confirmando} className="w-fit">
                    {confirmando ? "Guardando…" : `Confirmar importación de ${filas.length} obra(s)`}
                  </Button>
                  {filasIncompletas.length > 0 && (
                    <p className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--ink-faint)" }}>
                      {filasIncompletas.length} obra(s) se crearán sin calle, URL de Google Maps o responsable DG — se pueden completar después.
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
