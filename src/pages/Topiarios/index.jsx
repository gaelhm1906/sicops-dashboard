/**
 * pages/Topiarios/index.jsx
 * Herramienta operativa para registro de Topiarios CDMX.
 * Módulo independiente — no toca ninguna conexión existente del sistema.
 */
import React, { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE, getToken } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "../../components/Layout/Sidebar";

/* ── Animación fadeIn ── */
const FADEIN_STYLE = `
  @keyframes top-fade-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .top-fade { animation: top-fade-in 0.25s ease both; }
`;

const C = {
  guinda:     "#691C32",
  guindaDark: "#4F0E21",
  gold:       "#B8912A",
  goldSoft:   "#F5E8D1",
  bg:         "#F8F5F2",
  surface:    "#FFFFFF",
  border:     "rgba(201,166,107,0.22)",
};

/* ── Marcador (sin PNG externos) ── */
const MARKER_ICON = new L.DivIcon({
  html: `<div style="width:22px;height:22px;background:${C.guinda};border:3px solid white;border-radius:50%;box-shadow:0 2px 14px rgba(105,28,50,0.55);"></div>`,
  className: "",
  iconSize:   [22, 22],
  iconAnchor: [11, 11],
});

/* ── Click handler dentro del mapa ── */
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

/* ── Indicador de paso ── */
function StepDot({ num, active, done }) {
  const bg = (done || active) ? C.guinda : "rgba(105,28,50,0.12)";
  const fg = (done || active) ? "white"  : C.guinda;
  const labels = { 1: "Datos", 2: "Ubicación", 3: "Confirmar" };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 14,
        border: active && !done ? `2.5px solid ${C.guinda}` : "none",
        boxShadow: done || active ? `0 4px 14px rgba(105,28,50,0.28)` : "none",
        transition: "all 0.3s",
      }}>
        {done ? "✓" : num}
      </div>
      <span style={{
        fontSize: 10, fontWeight: active || done ? 700 : 400,
        color: active || done ? C.guinda : "rgba(105,28,50,0.45)",
        letterSpacing: "0.04em",
      }}>
        {labels[num]}
      </span>
    </div>
  );
}

/* ── Fila de resumen ── */
function Row({ label, value, large }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 7, alignItems: "flex-start" }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: "rgba(105,28,50,0.50)",
        textTransform: "uppercase", letterSpacing: "0.09em",
        minWidth: 88, paddingTop: large ? 2 : 0, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: large ? 15 : 13, fontWeight: large ? 700 : 400,
        color: large ? C.guindaDark : "#333", wordBreak: "break-word",
      }}>
        {value || "—"}
      </span>
    </div>
  );
}

/* ── Botón principal ── */
function PrimaryBtn({ children, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%", padding: "14px",
        background: (disabled || loading)
          ? "rgba(105,28,50,0.28)"
          : `linear-gradient(135deg,${C.guinda},${C.guindaDark})`,
        color: "white", border: "none", borderRadius: 12,
        fontWeight: 800, fontSize: 15,
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        boxShadow: (disabled || loading) ? "none" : "0 4px 18px rgba(105,28,50,0.35)",
        transition: "all 0.2s", letterSpacing: "0.03em",
      }}
    >
      {loading ? "Procesando..." : children}
    </button>
  );
}

/* ── Botón secundario ── */
function SecondaryBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: "13px",
        background: "rgba(105,28,50,0.09)",
        color: C.guinda, border: "none", borderRadius: 12,
        fontWeight: 700, fontSize: 14, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ── Valida y normaliza el campo Tipo ── */
function normalizeTipo(raw) {
  return raw
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "")
    .toUpperCase();
}

const CDMX_CENTER = [19.4326, -99.1332];

export default function Topiarios() {
  const { user } = useAuth();
  const [view, setView] = useState("wizard");
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({ tipo: "", modalidad: "INSTALACION" });
  const [loc,  setLoc]  = useState({ lat: null, lng: null, direccion: "", colonia: "", alcaldia: "" });

  const [geocoding,   setGeocoding]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(null);
  const [saveError,   setSaveError]   = useState("");

  const [registros,    setRegistros]    = useState([]);
  const [loadingList,  setLoadingList]  = useState(false);
  const [exportError,  setExportError]  = useState("");
  const [promotingId,  setPromotingId]  = useState(null);

  /* ── Nominatim reverse geocoding ── */
  const doGeocode = useCallback(async (lat, lng) => {
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res  = await fetch(url, {
        headers: {
          "Accept-Language": "es",
          "User-Agent": "SICOPS-Topiarios/1.0 (sicops2026@gmail.com)",
        },
      });
      const data = await res.json();
      const addr = data.address || {};
      setLoc({
        lat, lng,
        direccion: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        colonia:   addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || "",
        alcaldia:  addr.city_district || addr.county || addr.municipality || addr.city || "",
      });
    } catch {
      setLoc((prev) => ({ ...prev, lat, lng, direccion: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
    } finally {
      setGeocoding(false);
    }
  }, []);

  const handleMapClick = useCallback(({ lat, lng }) => doGeocode(lat, lng), [doGeocode]);

  /* ── Guardar registro ── */
  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/topiarios/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tipo:      form.tipo,
          modalidad: form.modalidad,
          lat:       loc.lat,
          lng:       loc.lng,
          geom:      { type: "Point", coordinates: [loc.lng, loc.lat] },
          direccion: loc.direccion,
          colonia:   loc.colonia,
          alcaldia:  loc.alcaldia,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setSaved(data.data);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Nueva captura ── */
  const handleNuevo = () => {
    setStep(1);
    setForm({ tipo: "", modalidad: "INSTALACION" });
    setLoc({ lat: null, lng: null, direccion: "", colonia: "", alcaldia: "" });
    setSaved(null);
    setSaveError("");
  };

  /* ── Cargar lista ── */
  const loadRegistros = useCallback(async () => {
    setLoadingList(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/topiarios`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setRegistros(Array.isArray(data.data) ? data.data : []);
    } catch {
      setRegistros([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (view === "list") loadRegistros();
  }, [view, loadRegistros]);

  /* ── Promover PROPUESTA → INSTALACION ── */
  const handlePromover = async (id) => {
    setExportError("");
    setPromotingId(id);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/topiarios/${id}/promover`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setRegistros((prev) => prev.map((r) => r.id === id ? data.data : r));
    } catch (e) {
      setExportError(e.message);
    } finally {
      setPromotingId(null);
    }
  };

  /* ── Exportar ── */
  const handleExport = async (format) => {
    setExportError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/topiarios/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = format === "excel"   ? "topiarios.xlsx"
                 : format === "geojson" ? "topiarios.geojson"
                 : "topiarios.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message);
    }
  };

  /* ── Cambiar de tab ── */
  const handleTabChange = (v) => {
    setView(v);
    if (v === "wizard") handleNuevo();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{FADEIN_STYLE}</style>
      <Sidebar />

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 64px" }}>

        {/* ── Encabezado ── */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 900, color: C.guindaDark,
            letterSpacing: "0.01em", margin: 0,
          }}>
            Registro de Topiarios
          </h1>
          <p style={{ fontSize: 13, color: "rgba(105,28,50,0.58)", marginTop: 5 }}>
            Herramienta operativa · Instalación CDMX
          </p>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { key: "wizard", label: "Nuevo Registro" },
            { key: "list",   label: "Ver Registros"  },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              style={{
                padding: "9px 20px", borderRadius: 10, border: "none",
                background: view === key ? C.guinda : "rgba(105,28,50,0.09)",
                color:      view === key ? "white"  : C.guinda,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                transition: "all 0.18s",
                boxShadow: view === key ? "0 3px 12px rgba(105,28,50,0.28)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════ WIZARD ══════════════ */}
        {view === "wizard" && (
          <div style={{
            background: C.surface, borderRadius: 22,
            padding: "30px 26px",
            boxShadow: "0 8px 36px rgba(105,28,50,0.11)",
            border: `1px solid ${C.border}`,
          }}>

            {/* ── Estado: GUARDADO ── */}
            {saved && (
              <div className="top-fade" style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{
                  width: 68, height: 68, borderRadius: "50%",
                  background: "linear-gradient(135deg,#22c55e,#15803d)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, fontWeight: 900, color: "white",
                  margin: "0 auto 20px",
                  boxShadow: "0 8px 28px rgba(34,197,94,0.38)",
                }}>
                  ✓
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#15803d", marginBottom: 6 }}>
                  Registro exitoso
                </h2>
                <p style={{ fontSize: 13, color: "#555", marginBottom: 22 }}>
                  ID generado: <strong style={{ color: C.guinda, fontSize: 14 }}>{saved.id}</strong>
                </p>
                <div style={{
                  background: "#f8f9fa", borderRadius: 14,
                  padding: "16px 18px", textAlign: "left",
                  marginBottom: 26, border: `1px solid rgba(0,0,0,0.06)`,
                }}>
                  <Row label="Tipo"      value={saved.tipo}      large />
                  <Row label="Modalidad" value={saved.modalidad} large />
                  {saved.alcaldia && <Row label="Alcaldía" value={saved.alcaldia} />}
                  {saved.colonia  && <Row label="Colonia"  value={saved.colonia}  />}
                  <Row label="Fecha" value={new Date(saved.fecha).toLocaleString("es-MX")} />
                </div>
                <PrimaryBtn onClick={handleNuevo}>Registrar otro topiario</PrimaryBtn>
              </div>
            )}

            {/* ── Wizard activo ── */}
            {!saved && (
              <>
                {/* Step dots */}
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 34,
                }}>
                  <StepDot num={1} active={step === 1} done={step > 1} />
                  <div style={{
                    width: 52, height: 2, margin: "0 6px",
                    background: step > 1 ? C.guinda : "rgba(105,28,50,0.13)",
                    borderRadius: 2, transition: "background 0.3s",
                  }} />
                  <StepDot num={2} active={step === 2} done={step > 2} />
                  <div style={{
                    width: 52, height: 2, margin: "0 6px",
                    background: step > 2 ? C.guinda : "rgba(105,28,50,0.13)",
                    borderRadius: 2, transition: "background 0.3s",
                  }} />
                  <StepDot num={3} active={step === 3} done={false} />
                </div>

                {/* ─────────── PASO 1 — DATOS ─────────── */}
                {step === 1 && (
                  <div className="top-fade">
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: C.guindaDark, marginBottom: 22 }}>
                      Datos del topiario
                    </h3>

                    {/* Tipo */}
                    <div style={{ marginBottom: 22 }}>
                      <label style={{
                        display: "block", fontSize: 11, fontWeight: 800,
                        color: C.guinda, marginBottom: 8,
                        textTransform: "uppercase", letterSpacing: "0.12em",
                      }}>
                        Tipo de topiario *
                      </label>
                      <input
                        type="text"
                        value={form.tipo}
                        onChange={(e) => setForm((p) => ({ ...p, tipo: normalizeTipo(e.target.value) }))}
                        placeholder="ej. BALON, AJOLOTE"
                        autoFocus
                        autoComplete="off"
                        style={{
                          width: "100%", padding: "13px 14px",
                          border: `1.5px solid ${form.tipo.trim() ? C.guinda : "rgba(105,28,50,0.20)"}`,
                          borderRadius: 11, fontSize: 15, outline: "none",
                          boxSizing: "border-box", transition: "border 0.2s",
                          fontFamily: "inherit", textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      />
                      <p style={{ fontSize: 12, color: "rgba(105,28,50,0.50)", marginTop: 6 }}>
                        Solo letras y espacios · se convierte automáticamente a mayúsculas
                      </p>
                    </div>

                    {/* Modalidad */}
                    <div style={{ marginBottom: 30 }}>
                      <label style={{
                        display: "block", fontSize: 11, fontWeight: 800,
                        color: C.guinda, marginBottom: 10,
                        textTransform: "uppercase", letterSpacing: "0.12em",
                      }}>
                        Modalidad *
                      </label>
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { key: "PROPUESTA",   label: "PROPUESTA"   },
                          { key: "INSTALACION", label: "INSTALACIÓN" },
                        ].map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, modalidad: key }))}
                            style={{
                              flex: 1, padding: "16px 10px", borderRadius: 13,
                              border: `2px solid ${form.modalidad === key ? C.guinda : "rgba(105,28,50,0.15)"}`,
                              background: form.modalidad === key
                                ? `linear-gradient(135deg,${C.guinda},${C.guindaDark})`
                                : "rgba(255,255,255,0.8)",
                              color: form.modalidad === key ? "white" : C.guindaDark,
                              fontWeight: 800, fontSize: 13,
                              cursor: "pointer", transition: "all 0.18s",
                              boxShadow: form.modalidad === key
                                ? "0 4px 18px rgba(105,28,50,0.32)" : "none",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <PrimaryBtn
                      disabled={!form.tipo.trim()}
                      onClick={() => setStep(2)}
                    >
                      Siguiente — Ubicación
                    </PrimaryBtn>
                  </div>
                )}

                {/* ─────────── PASO 2 — UBICACIÓN ─────────── */}
                {step === 2 && (
                  <div className="top-fade">
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: C.guindaDark, marginBottom: 6 }}>
                      Ubicación en el mapa
                    </h3>
                    <p style={{ fontSize: 13, color: "rgba(105,28,50,0.58)", marginBottom: 16 }}>
                      Toca o haz clic en el mapa para marcar la ubicación exacta.
                    </p>

                    {/* Mapa */}
                    <div style={{
                      borderRadius: 14, overflow: "hidden", marginBottom: 16,
                      border: `1.5px solid ${loc.lat ? C.guinda : C.border}`,
                      boxShadow: loc.lat ? "0 4px 20px rgba(105,28,50,0.18)" : "none",
                      transition: "border 0.3s, box-shadow 0.3s",
                    }}>
                      <MapContainer
                        center={CDMX_CENTER}
                        zoom={12}
                        style={{ height: 330, width: "100%" }}
                        zoomControl
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={handleMapClick} />
                        {loc.lat != null && (
                          <Marker position={[loc.lat, loc.lng]} icon={MARKER_ICON} />
                        )}
                      </MapContainer>
                    </div>

                    {/* Instrucción cuando no hay punto */}
                    {!loc.lat && !geocoding && (
                      <div style={{
                        textAlign: "center", padding: "10px 14px",
                        background: C.goldSoft, borderRadius: 10, marginBottom: 14,
                        fontSize: 13, color: C.gold, fontWeight: 600,
                        border: `1px solid rgba(184,145,42,0.28)`,
                      }}>
                        Selecciona un punto en el mapa para fijar la ubicación
                      </div>
                    )}

                    {/* Geocoding */}
                    {geocoding && (
                      <div style={{
                        padding: "10px 14px", background: "rgba(105,28,50,0.07)",
                        borderRadius: 10, marginBottom: 14,
                        fontSize: 13, color: C.guinda, fontWeight: 600,
                      }}>
                        Obteniendo dirección...
                      </div>
                    )}

                    {/* Resultado geocoding */}
                    {loc.lat != null && !geocoding && (
                      <div style={{
                        background: "#f8f9fa", borderRadius: 12,
                        padding: "14px 16px", marginBottom: 18,
                        border: `1px solid rgba(0,0,0,0.06)`,
                      }}>
                        <Row label="Coords"    value={`${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`} />
                        {loc.alcaldia  && <Row label="Alcaldía"  value={loc.alcaldia} />}
                        {loc.colonia   && <Row label="Colonia"   value={loc.colonia}  />}
                        {loc.direccion && (
                          <Row label="Dirección"
                            value={loc.direccion.length > 90
                              ? loc.direccion.slice(0, 90) + "…"
                              : loc.direccion}
                          />
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <SecondaryBtn onClick={() => setStep(1)}>Anterior</SecondaryBtn>
                      <div style={{ flex: 2 }}>
                        <PrimaryBtn
                          disabled={!loc.lat || geocoding}
                          onClick={() => setStep(3)}
                        >
                          Siguiente — Confirmar
                        </PrimaryBtn>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─────────── PASO 3 — CONFIRMAR ─────────── */}
                {step === 3 && (
                  <div className="top-fade">
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: C.guindaDark, marginBottom: 20 }}>
                      Validar y confirmar
                    </h3>

                    {/* Resumen */}
                    <div style={{
                      background: "#f8f9fa", borderRadius: 16,
                      padding: "18px 20px", marginBottom: 20,
                      border: `1px solid rgba(105,28,50,0.09)`,
                    }}>
                      <Row label="Tipo"      value={form.tipo}      large />
                      <Row label="Modalidad" value={form.modalidad} large />
                      <div style={{ height: 1, background: "rgba(105,28,50,0.08)", margin: "10px 0" }} />
                      <Row label="Coords"    value={`${loc.lat?.toFixed(6)}, ${loc.lng?.toFixed(6)}`} />
                      {loc.alcaldia  && <Row label="Alcaldía"  value={loc.alcaldia} />}
                      {loc.colonia   && <Row label="Colonia"   value={loc.colonia}  />}
                      {loc.direccion && (
                        <Row label="Dirección"
                          value={loc.direccion.length > 80
                            ? loc.direccion.slice(0, 80) + "…"
                            : loc.direccion}
                        />
                      )}
                      <div style={{ height: 1, background: "rgba(105,28,50,0.08)", margin: "10px 0" }} />
                      <Row label="Usuario" value={user?.username || user?.email || "—"} />
                      <Row label="Fecha"
                        value={new Date().toLocaleDateString("es-MX", {
                          day: "2-digit", month: "long", year: "numeric",
                        })}
                      />
                    </div>

                    {saveError && (
                      <div style={{
                        background: "#fff0f0", border: "1px solid #ffcccc",
                        borderRadius: 10, padding: "10px 14px",
                        fontSize: 13, color: "#c0392b", marginBottom: 16,
                      }}>
                        {saveError}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <SecondaryBtn onClick={() => setStep(2)} disabled={saving}>
                        Anterior
                      </SecondaryBtn>
                      <div style={{ flex: 2 }}>
                        <PrimaryBtn onClick={handleSave} loading={saving}>
                          CONFIRMAR REGISTRO
                        </PrimaryBtn>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════ LISTA DE REGISTROS ══════════════ */}
        {view === "list" && (
          <div className="top-fade">
            {/* Barra de acciones */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: 8, marginBottom: 20, flexWrap: "wrap",
            }}>
              <button
                onClick={() => handleExport("csv")}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: `1.5px solid ${C.gold}`,
                  background: C.goldSoft, color: C.guindaDark,
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                CSV
              </button>
              <button
                onClick={() => handleExport("excel")}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: `1.5px solid ${C.guinda}`,
                  background: C.guinda, color: "white",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Excel
              </button>
              <button
                onClick={() => handleExport("geojson")}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: `1.5px solid #1d6b3a`,
                  background: "#1d6b3a", color: "white",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                GeoJSON
              </button>
              <button
                onClick={loadRegistros}
                style={{
                  padding: "9px 16px", borderRadius: 10,
                  border: `1.5px solid rgba(105,28,50,0.16)`,
                  background: "white", color: C.guinda,
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                Actualizar
              </button>
              <span style={{
                marginLeft: "auto", fontSize: 13,
                color: "rgba(105,28,50,0.55)", fontWeight: 600,
              }}>
                {registros.length} registro{registros.length !== 1 ? "s" : ""}
              </span>
            </div>

            {exportError && (
              <div style={{
                background: "#fff0f0", border: "1px solid #ffcccc",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#c0392b", marginBottom: 14,
              }}>
                {exportError}
              </div>
            )}

            {loadingList && (
              <div style={{
                textAlign: "center", padding: "52px 0",
                color: "rgba(105,28,50,0.45)", fontSize: 15,
              }}>
                Cargando registros...
              </div>
            )}

            {!loadingList && registros.length === 0 && (
              <div style={{
                textAlign: "center", padding: "52px 0",
                color: "rgba(105,28,50,0.40)", fontSize: 15,
              }}>
                No hay registros aún.
              </div>
            )}

            {!loadingList && registros.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...registros].reverse().map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: C.surface, borderRadius: 16,
                      padding: "16px 18px",
                      border: `1px solid ${C.border}`,
                      boxShadow: "0 2px 10px rgba(105,28,50,0.07)",
                    }}
                  >
                    {/* Header de tarjeta */}
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        color: "rgba(105,28,50,0.45)",
                        letterSpacing: "0.12em",
                      }}>
                        {r.id}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        padding: "3px 11px", borderRadius: 20,
                        background: r.modalidad === "INSTALACION"
                          ? "rgba(105,28,50,0.09)"
                          : C.goldSoft,
                        color: r.modalidad === "INSTALACION"
                          ? C.guinda
                          : C.gold,
                        border: `1px solid ${r.modalidad === "INSTALACION"
                          ? "rgba(105,28,50,0.18)"
                          : "rgba(184,145,42,0.28)"}`,
                        letterSpacing: "0.06em",
                      }}>
                        {r.modalidad}
                      </span>
                    </div>

                    {/* Tipo */}
                    <p style={{
                      fontSize: 16, fontWeight: 800,
                      color: C.guindaDark, marginBottom: 6,
                    }}>
                      {r.tipo}
                    </p>

                    {/* Ubicación */}
                    {(r.alcaldia || r.colonia) && (
                      <p style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                        {[r.alcaldia, r.colonia].filter(Boolean).join(" · ")}
                      </p>
                    )}

                    {/* Meta */}
                    <p style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 4 }}>
                      {new Date(r.fecha).toLocaleDateString("es-MX", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                      {" · "}
                      {r.usuario}
                      {r.fecha_actualizacion && (
                        <span style={{ marginLeft: 6, color: "rgba(29,107,58,0.7)" }}>
                          · Actualizado {new Date(r.fecha_actualizacion).toLocaleDateString("es-MX", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                      )}
                    </p>

                    {/* Botón promover — solo si es PROPUESTA */}
                    {r.modalidad === "PROPUESTA" && (
                      <button
                        onClick={() => handlePromover(r.id)}
                        disabled={promotingId === r.id}
                        style={{
                          marginTop: 12,
                          padding: "8px 16px",
                          borderRadius: 9,
                          border: `1.5px solid ${C.guinda}`,
                          background: "white",
                          color: C.guinda,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: promotingId === r.id ? "not-allowed" : "pointer",
                          letterSpacing: "0.03em",
                          transition: "all 0.15s",
                          opacity: promotingId === r.id ? 0.6 : 1,
                        }}
                      >
                        {promotingId === r.id ? "Procesando..." : "Marcar como instalación"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
