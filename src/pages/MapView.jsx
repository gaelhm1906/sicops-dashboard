import React, { useEffect, useRef, useState, useCallback } from "react";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";

// Determinar base URL compatible con Render y localhost
const BASE_URL = (() => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3001/api";
  }
  return "/api"; // mismo dominio en Render
})();

function getToken() {
  return localStorage.getItem("token");
}

// Color por avance (verde / naranja / rojo / gris)
function getColor(avance) {
  if (avance === null || avance === undefined) return "#9e9e9e";
  const n = Number(avance);
  if (n >= 100) return "#00c853";
  if (n > 0) return "#ff9800";
  return "#d50000";
}

// Estilo de polígono / línea
function buildStyle(feature) {
  const color = getColor(feature.properties.avance_real);
  return { color, weight: 2, fillColor: color, fillOpacity: 0.5 };
}

export default function MapView() {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const geoLayerRef     = useRef(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Cargar GeoJSON desde /api/geojson/obras ───────────────────────
  const cargarGeoJson = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const resp  = await fetch(`${BASE_URL}/geojson/obras`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
      if (!data.features) throw new Error("Respuesta sin features GeoJSON");

      if (geoLayerRef.current) {
        geoLayerRef.current.clearLayers();      // evitar duplicación
        geoLayerRef.current.addData(data);
      }

      setTotal(data.features.length);
    } catch (err) {
      setError(err.message);
      console.error("[MapView] Error cargando GeoJSON:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Actualizar avance desde popup ────────────────────────────────
  const actualizarAvance = useCallback(async (id_obra, avance_real, tabla, popupId) => {
    const msg = document.getElementById(`${popupId}-msg`);
    const btn = document.getElementById(`${popupId}-btn`);

    try {
      const token = getToken();
      const resp = await fetch(`${BASE_URL}/obras/actualizar-avance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_obra, avance_real, tabla }),
      });
      const data = await resp.json();

      if (!data.success) throw new Error(data.message || "Error al actualizar");

      if (msg) { msg.style.color = "#006341"; msg.textContent = `✓ Actualizado a ${avance_real}%`; }

      // Cerrar popup y recargar mapa después de 1 segundo
      setTimeout(() => {
        if (mapRef.current) mapRef.current.closePopup();
        cargarGeoJson();
      }, 900);
    } catch (err) {
      if (msg) { msg.style.color = "#d50000"; msg.textContent = err.message; }
      if (btn) { btn.disabled = false; btn.textContent = "Actualizar"; }
    }
  }, [cargarGeoJson]);

  // ── Inicializar Leaflet (solo una vez) ───────────────────────────
  useEffect(() => {
    if (mapRef.current) return; // ya inicializado

    // Importar Leaflet dinámicamente (compatible con CRA)
    import("leaflet").then((Lmod) => {
      const L = Lmod.default;

      // Importar CSS de Leaflet
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id    = "leaflet-css";
        link.rel   = "stylesheet";
        link.href  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Crear mapa centrado en CDMX
      const map = L.map(containerRef.current, {
        center: [19.43, -99.13],
        zoom: 11,
        zoomControl: true,
      });

      // Capa base OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Capa GeoJSON con estilos y popups
      const geoLayer = L.geoJSON(null, {
        style: buildStyle,

        // Puntos → circleMarker
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 9,
            fillColor: getColor(feature.properties.avance_real),
            color: "#fff",
            weight: 1.5,
            fillOpacity: 0.88,
          });
        },

        // Popup con formulario de actualización
        onEachFeature: (feature, layer) => {
          const p      = feature.properties;
          const avance = p.avance_real !== null && p.avance_real !== undefined
            ? p.avance_real
            : "";
          const pid    = `pop-${p.id}-${p.tabla}`;

          const html = `
            <div style="font-family:'Segoe UI',sans-serif;font-size:13px;min-width:230px">
              <p style="font-size:14px;font-weight:700;margin:0 0 4px;color:#2C2C2C">
                ${p.nombre || "Sin nombre"}
              </p>
              <p style="margin:0 0 2px;color:#555">
                <b>DG:</b> ${p.direccion_general || "—"}
              </p>
              <p style="margin:0 0 2px;color:#555">
                <b>Programa:</b> ${p.programa || "—"}
              </p>
              <p style="margin:0 0 2px;color:#555">
                <b>Avance actual:</b>
                <span style="color:${getColor(p.avance_real)};font-weight:700">
                  ${avance !== "" ? avance + "%" : "Sin dato"}
                </span>
              </p>
              <p style="margin:0 0 10px;color:#555">
                <b>Estatus:</b> ${p.estatus || "—"}
              </p>
              <hr style="margin:0 0 10px;border-color:#eee"/>
              <label style="font-weight:600;display:block;margin-bottom:4px">
                Nuevo avance:
              </label>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <input
                  id="${pid}-input"
                  type="number" min="0" max="100"
                  value="${avance}"
                  style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px"
                />
                <span>%</span>
              </div>
              <button
                id="${pid}-btn"
                style="width:100%;padding:6px 0;background:#691C32;color:#fff;border:none;
                       border-radius:5px;font-size:13px;cursor:pointer;font-weight:600"
              >
                Actualizar
              </button>
              <div id="${pid}-msg" style="margin-top:6px;font-size:12px;min-height:16px"></div>
            </div>
          `;

          layer.bindPopup(html, { maxWidth: 280 });

          layer.on("popupopen", () => {
            const btn = document.getElementById(`${pid}-btn`);
            const inp = document.getElementById(`${pid}-input`);
            if (!btn || !inp) return;

            btn.onclick = () => {
              const val = Number(inp.value);
              if (Number.isNaN(val) || val < 0 || val > 100) {
                const m = document.getElementById(`${pid}-msg`);
                if (m) { m.style.color = "#d50000"; m.textContent = "Valor inválido (0–100)"; }
                return;
              }
              btn.disabled    = true;
              btn.textContent = "Guardando...";
              actualizarAvance(p.id, val, p.tabla, pid);
            };
          });
        },
      }).addTo(map);

      mapRef.current     = map;
      geoLayerRef.current = geoLayer;

      cargarGeoJson();
    });

    // Cleanup al desmontar
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current      = null;
        geoLayerRef.current = null;
      }
    };
  }, [cargarGeoJson, actualizarAvance]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#F7F3EE" }}>
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Barra superior */}
          <div
            style={{
              padding: "10px 20px",
              background: "#fff",
              borderBottom: "1px solid #D4C4B0",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <h1 style={{ fontWeight: 700, color: "#691C32", fontSize: 17, margin: 0 }}>
              Mapa de Obras — SIG SOBSE
            </h1>

            {loading ? (
              <span style={{ fontSize: 12, color: "#888" }}>Cargando GeoJSON…</span>
            ) : (
              <span style={{ fontSize: 12, color: "#666" }}>
                {total} obra(s) con geometría
              </span>
            )}

            <button
              onClick={cargarGeoJson}
              disabled={loading}
              style={{
                marginLeft: "auto",
                padding: "5px 14px",
                background: loading ? "#ccc" : "#691C32",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                fontSize: 13,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Recargar
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "8px 20px", background: "#fef2f2", color: "#d50000", fontSize: 13, flexShrink: 0 }}>
              Error: {error}
            </div>
          )}

          {/* Leyenda */}
          <div
            style={{
              padding: "6px 20px",
              background: "#fff",
              borderBottom: "1px solid #eee",
              display: "flex",
              gap: 16,
              alignItems: "center",
              fontSize: 12,
              color: "#555",
              flexShrink: 0,
            }}
          >
            <b>Leyenda:</b>
            {[
              { color: "#d50000", label: "Sin iniciar (0%)" },
              { color: "#ff9800", label: "En proceso (1–99%)" },
              { color: "#00c853", label: "Terminado (100%)" },
              { color: "#9e9e9e", label: "Sin dato" },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                {label}
              </span>
            ))}
          </div>

          {/* Contenedor del mapa */}
          <div ref={containerRef} style={{ flex: 1, minHeight: 300 }} />
        </main>
      </div>
    </div>
  );
}
