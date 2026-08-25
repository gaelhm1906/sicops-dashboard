/**
 * pages/GestionObras/RegistroAuditoria.jsx
 * Visor del registro de auditoría de obras_auditoria.
 * Muestra quién, cuándo, qué operación y desde dónde.
 */
import React, { useState, useCallback, useEffect } from "react";
import { geoestadisticaAPI } from "../../utils/api";

const OPERACION_CFG = {
  ALTA:                        { bg: "#f0fdf4", text: "#15803d", border: "#86efac",  label: "Alta"               },
  MODIFICACION:                { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe",  label: "Modificación"       },
  BAJA_LOGICA:                 { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca",  label: "Baja lógica"        },
  REACTIVACION:                { bg: "#f0fdf4", text: "#15803d", border: "#86efac",  label: "Reactivación"       },
  CAMBIO_TIPO_GEOMETRICO:      { bg: "#fef3c7", text: "#92400e", border: "#fde68a",  label: "Cambio geométrico"  },
  CORRECCION_CLAVE_UNICA:      { bg: "#f5f3ff", text: "#7c3aed", border: "#c4b5fd",  label: "Corrección clave"   },
  MODIFICACION_GEOMETRIA:      { bg: "#eff6ff", text: "#0369a1", border: "#bae6fd",  label: "Mod. geometría"     },
};

const ORIGEN_CFG = {
  SICOPS:  { label: "SICOPS",  color: "#2563eb" },
  QGIS:    { label: "QGIS",    color: "#7c3aed" },
  API:     { label: "API",     color: "#0891b2" },
  SQL:     { label: "SQL",     color: "#92400e" },
  TRIGGER: { label: "TRIGGER", color: "#6b7280" },
  OTRO:    { label: "OTRO",    color: "#94a3b8" },
};

function fmtFecha(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const T = {
  text:    "#1e293b",
  textSoft:"#64748b",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
  divider: "#e2e8f0",
};

const fieldStyle = {
  height: "2.1rem", fontSize: "0.8rem",
  backgroundColor: T.inputBg, borderRadius: "0.5rem",
  border: `1px solid ${T.inputBorder}`, color: T.text,
  paddingLeft: "0.5rem", paddingRight: "0.5rem", boxSizing: "border-box",
};

export default function RegistroAuditoria({ clave, onClose }) {
  const [registros, setRegistros] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [page,      setPage]      = useState(0);
  const [filtros,   setFiltros]   = useState({
    clave_unica: clave || "",
    operacion:   "",
    usuario:     "",
    origen:      "",
    desde:       "",
    hasta:       "",
  });
  const PER_PAGE = 30;

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await geoestadisticaAPI.getAuditoria({
        ...filtros,
        limit:  PER_PAGE,
        offset: page * PER_PAGE,
      });
      setRegistros(r.data || []);
      setTotal(r.total || 0);
    } catch (e) {
      setError(e.message || "Error al cargar auditoría.");
    } finally {
      setLoading(false);
    }
  }, [filtros, page]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleFiltro = (field, val) => {
    setFiltros((p) => ({ ...p, [field]: val }));
    setPage(0);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(0,0,0,0.50)", backdropFilter: "blur(2px)" }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 51 }}>
        <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)" }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(219,234,254,0.65)" }}>Gestión de Obras</p>
              <h2 className="mt-1 text-lg font-bold text-white">
                Registro de Auditoría {clave ? `— ${clave}` : "(Global)"}
              </h2>
            </div>
            <button type="button" onClick={onClose}
              style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "50%", cursor: "pointer", fontWeight: 700 }}>✕</button>
          </div>

          {/* Filtros */}
          <div className="shrink-0 px-5 py-3 flex flex-wrap gap-2 items-center"
            style={{ borderBottom: `1px solid ${T.divider}`, backgroundColor: "#f8fafc" }}>
            {!clave && (
              <input type="text" placeholder="Clave única…" value={filtros.clave_unica}
                onChange={(e) => handleFiltro("clave_unica", e.target.value)}
                style={{ ...fieldStyle, width: 200 }} />
            )}
            <select value={filtros.operacion} onChange={(e) => handleFiltro("operacion", e.target.value)}
              style={{ ...fieldStyle, width: 180 }}>
              <option value="">Todas las operaciones</option>
              {Object.entries(OPERACION_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filtros.origen} onChange={(e) => handleFiltro("origen", e.target.value)}
              style={{ ...fieldStyle, width: 120 }}>
              <option value="">Todos los orígenes</option>
              {Object.keys(ORIGEN_CFG).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input type="text" placeholder="Usuario…" value={filtros.usuario}
              onChange={(e) => handleFiltro("usuario", e.target.value)}
              style={{ ...fieldStyle, width: 160 }} />
            <input type="date" value={filtros.desde}
              onChange={(e) => handleFiltro("desde", e.target.value)}
              style={{ ...fieldStyle, width: 140 }} />
            <input type="date" value={filtros.hasta}
              onChange={(e) => handleFiltro("hasta", e.target.value)}
              style={{ ...fieldStyle, width: 140 }} />
            <span className="text-xs" style={{ color: T.textSoft }}>{total} registros</span>
          </div>

          {/* Tabla */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#2563eb", borderTopColor: "transparent" }} />
              </div>
            ) : error ? (
              <div className="m-4 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                {error}
              </div>
            ) : registros.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: T.textSoft }}>
                No hay registros de auditoría con los filtros actuales.
              </div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0 }}>
                    {["Fecha","Operación","Clave Única","Usuario","Origen","Tabla","Motivo"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-bold uppercase tracking-wider"
                        style={{ color: "#64748b" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => {
                    const opCfg  = OPERACION_CFG[r.operacion] || { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", label: r.operacion };
                    const orCfg  = ORIGEN_CFG[r.origen]       || { label: r.origen, color: "#94a3b8" };
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: T.textSoft }}>
                          {fmtFecha(r.fecha)}
                        </td>
                        <td className="px-3 py-2">
                          <span style={{ background: opCfg.bg, color: opCfg.text,
                            border: `1px solid ${opCfg.border}`, padding: "2px 7px",
                            borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {opCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: "#1e293b",
                          maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.clave_unica || "—"}
                        </td>
                        <td className="px-3 py-2" style={{ color: T.textSoft }}>
                          {r.usuario || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-bold" style={{ color: orCfg.color }}>{orCfg.label}</span>
                        </td>
                        <td className="px-3 py-2" style={{ color: T.textSoft }}>{r.tabla || "—"}</td>
                        <td className="px-3 py-2" style={{ color: T.textSoft, maxWidth: 200,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={r.motivo || ""}>
                          {r.motivo || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${T.divider}`, backgroundColor: "#fff" }}>
              <span className="text-xs" style={{ color: T.textSoft }}>
                {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} de {total}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0} className="px-3 py-1 text-xs font-semibold rounded-lg"
                  style={{ backgroundColor: page === 0 ? "#f1f5f9" : "#2563eb",
                    color: page === 0 ? "#94a3b8" : "#fff", border: "none",
                    cursor: page === 0 ? "default" : "pointer" }}>
                  ← Anterior
                </button>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1} className="px-3 py-1 text-xs font-semibold rounded-lg"
                  style={{ backgroundColor: page >= totalPages - 1 ? "#f1f5f9" : "#2563eb",
                    color: page >= totalPages - 1 ? "#94a3b8" : "#fff", border: "none",
                    cursor: page >= totalPages - 1 ? "default" : "pointer" }}>
                  Siguiente →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
