import React, { useEffect, useRef, useState, useCallback } from "react";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";
import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../utils/api";

function getToken() {
  return localStorage.getItem("token");
}

// ── Colores oficiales SIG-SOBSE ───────────────────────────────────
function colorPorAvance(avance) {
  if (avance === null || avance === undefined) return "#9e9e9e";
  const n = Number(avance);
  if (isNaN(n)) return "#9e9e9e";
  if (n > 70)  return "#4caf50";  // verde
  if (n >= 30) return "#ff9800";  // naranja
  return "#f44336";               // rojo
}

function colorPorEstatus(estatus, avance) {
  if (String(estatus || "").toUpperCase() === "ENTREGADO") return "#2196f3"; // azul
  return colorPorAvance(avance);
}

function buildStyle(feature) {
  const { estatus, avance_real } = feature.properties;
  const color = colorPorEstatus(estatus, avance_real);
  return { color, weight: 2, fillColor: color, fillOpacity: 0.55 };
}

function etiquetaEstatus(estatus, avance) {
  if (String(estatus || "").toUpperCase() === "ENTREGADO") return "ENTREGADO";
  const n = Number(avance);
  if (avance === null || avance === undefined || isNaN(n)) return "SIN INICIAR";
  if (n >= 100) return "TERMINADO";
  if (n > 0)   return "EN PROCESO";
  return "SIN INICIAR";
}

export default function MapView() {
  const { user } = useAuth();
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const geoLayerRef   = useRef(null);
  const layerByIdRef  = useRef({});
  const onClickRef    = useRef(null);

  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Panel lateral
  const [selectedObra, setSelectedObra] = useState(null);
  const [nuevoAvance,  setNuevoAvance]  = useState("");
  const [updating,     setUpdating]     = useState(false);
  const [updateMsg,    setUpdateMsg]    = useState(null);
  const [historial,    setHistorial]    = useState([]);
  const [loadingHist,  setLoadingHist]  = useState(false);

  const isAdmin = user?.rol === "ADMIN";
  const dg      = isAdmin ? null : (user?.dg || null);

  // ── Cargar GeoJSON ─────────────────────────────────────────────
  const cargarGeoJson = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const qs    = dg ? `?dg=${encodeURIComponent(dg)}` : "";
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp  = await fetch(`${BASE_URL}/geojson/obras${qs}`, {
        headers,
      });
      const data = await resp.json();
      if (!resp.ok)      throw new Error(data.message || `HTTP ${resp.status}`);
      if (!data.features) throw new Error("Respuesta sin features GeoJSON");

      layerByIdRef.current = {};
      if (geoLayerRef.current) {
        geoLayerRef.current.clearLayers();
        geoLayerRef.current.addData(data);
      }
      setTotal(data.features.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dg]);

  // ── Cargar historial ───────────────────────────────────────────
  const cargarHistorial = useCallback(async (id_obra) => {
    setLoadingHist(true);
    setHistorial([]);
    try {
      const token = getToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp  = await fetch(
        `${BASE_URL}/historial/${encodeURIComponent(id_obra)}`,
        { headers }
      );
      const data = await resp.json();
      if (data.success) setHistorial(data.data || []);
    } catch { /* historial opcional */ }
    setLoadingHist(false);
  }, []);

  // ── Abrir panel al click ───────────────────────────────────────
  const handleFeatureClick = useCallback((props) => {
    setSelectedObra({ ...props });
    setNuevoAvance(
      props.avance_real !== null && props.avance_real !== undefined
        ? String(props.avance_real)
        : ""
    );
    setUpdateMsg(null);
    cargarHistorial(props.id_obra);
  }, [cargarHistorial]);

  // ── Actualizar layer sin recargar todo ────────────────────────
  const actualizarLayer = useCallback((id_obra, avanceNuevo, estatusNuevo) => {
    const layer = layerByIdRef.current[id_obra];
    if (!layer) return;
    const color = colorPorEstatus(estatusNuevo, avanceNuevo);
    layer.feature.properties.avance_real = avanceNuevo;
    layer.feature.properties.estatus     = estatusNuevo;
    layer.feature.properties.color       = color;
    if (layer.setStyle) {
      const tipo = layer.feature.geometry?.type || "";
      layer.setStyle(
        tipo === "Point"
          ? { fillColor: color, color: "#fff", weight: 1.5, fillOpacity: 0.88 }
          : { color, weight: 2, fillColor: color, fillOpacity: 0.55 }
      );
    }
  }, []);

  // ── Enviar actualización ───────────────────────────────────────
  const handleActualizar = useCallback(async () => {
    if (!selectedObra) return;
    const avance = Number(nuevoAvance);
    if (isNaN(avance) || avance < 0 || avance > 100) {
      setUpdateMsg({ ok: false, text: "El avance debe ser un número entre 0 y 100" });
      return;
    }
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const estatusDerived =
        avance >= 100 ? "TERMINADO" : avance > 0 ? "EN PROCESO" : "SIN INICIAR";

      const resp = await fetch("/actualizacion_sigsobse/api/update_data.php", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          archivo:     selectedObra.tabla || "",
          nombre_obra: selectedObra.nombre,
          avance,
          estatus:     estatusDerived,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Error al actualizar");

      const colorNuevo = colorPorEstatus(estatusDerived, avance);

      // Actualizar panel (optimista)
      setSelectedObra(prev => ({
        ...prev,
        avance_real: avance,
        estatus:     estatusDerived,
        color:       colorNuevo,
      }));
      setUpdateMsg({ ok: true, text: `✓ Avance actualizado a ${avance}%` });

      // Actualizar layer sin recargar todo el mapa
      actualizarLayer(selectedObra.id_obra, avance, estatusDerived);
    } catch (err) {
      setUpdateMsg({ ok: false, text: err.message });
    } finally {
      setUpdating(false);
    }
  }, [selectedObra, nuevoAvance, actualizarLayer]);

  // Ref siempre apunta al último click handler
  useEffect(() => { onClickRef.current = handleFeatureClick; }, [handleFeatureClick]);

  // ── Inicializar Leaflet (una sola vez) ─────────────────────────
  useEffect(() => {
    // Guard: evita "Map container is already initialized"
    if (mapRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Belt-and-suspenders: limpiar cualquier instancia anterior
    if (el._leaflet_id) {
      // El contenedor ya fue usado — no reinicializar
      return;
    }

    import("leaflet").then((Lmod) => {
      const L = Lmod.default;

      if (!document.getElementById("leaflet-css")) {
        const link  = document.createElement("link");
        link.id     = "leaflet-css";
        link.rel    = "stylesheet";
        link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Segunda comprobación dentro del callback async
      if (mapRef.current || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center:      [19.43, -99.13],
        zoom:        11,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom:     19,
      }).addTo(map);

      const geoLayer = L.geoJSON(null, {
        style: buildStyle,

        pointToLayer: (feature, latlng) => {
          const { estatus, avance_real } = feature.properties;
          return L.circleMarker(latlng, {
            radius:      9,
            fillColor:   colorPorEstatus(estatus, avance_real),
            color:       "#fff",
            weight:      1.5,
            fillOpacity: 0.88,
          });
        },

        onEachFeature: (feature, layer) => {
          const id = feature.properties.id_obra;
          layerByIdRef.current[id] = layer;
          layer.on("click", () => {
            if (onClickRef.current) {
              onClickRef.current({ ...feature.properties });
            }
          });
        },
      }).addTo(map);

      mapRef.current      = map;
      geoLayerRef.current = geoLayer;

      cargarGeoJson();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current       = null;
        geoLayerRef.current  = null;
        layerByIdRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Re-cargar GeoJSON cuando cambia el dg (login de distinto usuario)
  useEffect(() => {
    if (mapRef.current) cargarGeoJson();
  }, [cargarGeoJson]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#F7F3EE" }}>
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Barra superior */}
          <div style={{
            padding: "10px 20px", background: "#fff",
            borderBottom: "1px solid #D4C4B0",
            display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          }}>
            <div>
              <h1 style={{ fontWeight: 700, color: "#691C32", fontSize: 17, margin: 0 }}>
                Centro de Actualización SIG-SOBSE 2025
              </h1>
              {dg && (
                <span style={{ fontSize: 11, color: "#888", marginTop: 2, display: "block" }}>
                  Dirección General: {dg}
                </span>
              )}
            </div>

            {loading ? (
              <span style={{ fontSize: 12, color: "#888" }}>Cargando…</span>
            ) : (
              <span style={{ fontSize: 12, color: "#666" }}>
                {total} obra(s) con geometría
              </span>
            )}

            <button
              onClick={cargarGeoJson}
              disabled={loading}
              style={{
                marginLeft: "auto", padding: "5px 14px",
                background: loading ? "#ccc" : "#691C32",
                color: "#fff", border: "none", borderRadius: 5,
                fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Recargar
            </button>
          </div>

          {error && (
            <div style={{ padding: "8px 20px", background: "#fef2f2", color: "#d50000", fontSize: 13, flexShrink: 0 }}>
              Error: {error}
            </div>
          )}

          {/* Leyenda */}
          <div style={{
            padding: "6px 20px", background: "#fff",
            borderBottom: "1px solid #eee",
            display: "flex", gap: 16, alignItems: "center",
            fontSize: 12, color: "#555", flexShrink: 0,
          }}>
            <b>Leyenda:</b>
            {[
              { color: "#f44336", label: "Sin iniciar (< 30%)" },
              { color: "#ff9800", label: "En proceso (30–70%)" },
              { color: "#4caf50", label: "Avanzado (> 70%)" },
              { color: "#2196f3", label: "Entregado" },
              { color: "#9e9e9e", label: "Sin dato" },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  display: "inline-block", width: 11, height: 11,
                  borderRadius: "50%", background: color, flexShrink: 0,
                }} />
                {label}
              </span>
            ))}
          </div>

          {/* Área mapa + panel lateral */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Mapa Leaflet */}
            <div ref={containerRef} style={{ flex: 1, minHeight: 300 }} />

            {/* Panel lateral */}
            {selectedObra && (
              <div style={{
                width: 320, background: "#fff", flexShrink: 0,
                borderLeft: "1px solid #D4C4B0",
                overflowY: "auto", padding: 20, fontSize: 13,
              }}>
                {/* Cabecera */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#2C2C2C", lineHeight: 1.4, flex: 1 }}>
                    {selectedObra.nombre || "Sin nombre"}
                  </h2>
                  <button
                    onClick={() => setSelectedObra(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 20, padding: "0 0 0 8px", lineHeight: 1 }}
                    aria-label="Cerrar panel"
                  >
                    ✕
                  </button>
                </div>

                {/* Datos */}
                <div style={{ marginBottom: 14, lineHeight: 1.9, color: "#444" }}>
                  <div><b style={{ color: "#691C32" }}>DG:</b> {selectedObra.direccion_general || "—"}</div>
                  <div><b style={{ color: "#691C32" }}>Programa:</b> {selectedObra.programa || "—"}</div>
                  <div><b style={{ color: "#691C32" }}>Alcaldía:</b> {selectedObra.alcaldia || "—"}</div>
                  <div>
                    <b style={{ color: "#691C32" }}>Estatus:</b>{" "}
                    <span style={{ color: colorPorEstatus(selectedObra.estatus, selectedObra.avance_real), fontWeight: 600 }}>
                      {etiquetaEstatus(selectedObra.estatus, selectedObra.avance_real)}
                    </span>
                  </div>
                  <div>
                    <b style={{ color: "#691C32" }}>Avance:</b>{" "}
                    <span style={{ color: colorPorEstatus(selectedObra.estatus, selectedObra.avance_real), fontWeight: 700, fontSize: 16 }}>
                      {selectedObra.avance_real !== null && selectedObra.avance_real !== undefined
                        ? `${selectedObra.avance_real}%`
                        : "Sin dato"}
                    </span>
                  </div>
                </div>

                {/* Barra de progreso */}
                {selectedObra.avance_real !== null && selectedObra.avance_real !== undefined && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, Number(selectedObra.avance_real))}%`,
                        background: colorPorEstatus(selectedObra.estatus, selectedObra.avance_real),
                        transition: "width 0.4s ease",
                        borderRadius: 4,
                      }} />
                    </div>
                  </div>
                )}

                <hr style={{ margin: "0 0 14px", borderColor: "#eee" }} />

                {/* Formulario de actualización */}
                <label style={{ fontWeight: 600, display: "block", marginBottom: 8, color: "#2C2C2C" }}>
                  Actualizar avance
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={nuevoAvance}
                    onChange={(e) => { setNuevoAvance(e.target.value); setUpdateMsg(null); }}
                    style={{
                      width: 80, padding: "6px 8px",
                      border: "1px solid #ccc", borderRadius: 4,
                      fontSize: 14,
                    }}
                    placeholder="0-100"
                  />
                  <span style={{ color: "#555", fontSize: 14 }}>%</span>
                </div>
                <button
                  onClick={handleActualizar}
                  disabled={updating}
                  style={{
                    width: "100%", padding: "9px 0",
                    background: updating ? "#ccc" : "#691C32",
                    color: "#fff", border: "none", borderRadius: 6,
                    fontSize: 13, cursor: updating ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {updating ? "Guardando…" : "Actualizar avance"}
                </button>

                {updateMsg && (
                  <div style={{
                    marginTop: 8, fontSize: 12, fontWeight: 500,
                    color: updateMsg.ok ? "#2e7d32" : "#d50000",
                  }}>
                    {updateMsg.text}
                  </div>
                )}

                {/* Historial */}
                <hr style={{ margin: "18px 0 12px", borderColor: "#eee" }} />
                <div style={{ fontWeight: 600, marginBottom: 8, color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Historial de avances
                </div>

                {loadingHist ? (
                  <div style={{ color: "#aaa", fontSize: 12 }}>Cargando historial…</div>
                ) : historial.length === 0 ? (
                  <div style={{ color: "#bbb", fontSize: 12 }}>Sin registros de historial.</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {historial.map((h, i) => (
                      <div key={i} style={{
                        padding: "7px 0",
                        borderBottom: i < historial.length - 1 ? "1px solid #f3f3f3" : "none",
                        fontSize: 12,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: colorPorAvance(h.avance), fontWeight: 700, fontSize: 14 }}>
                            {h.avance !== null ? `${h.avance}%` : "—"}
                          </span>
                          <span style={{ color: "#999", fontSize: 11 }}>
                            {h.fecha
                              ? new Date(h.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </span>
                        </div>
                        <div style={{ color: "#888", marginTop: 2 }}>{h.responsable || "sistema"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
