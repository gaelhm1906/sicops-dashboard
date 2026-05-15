import React, { useState, useEffect, useCallback } from "react";
import { alcancesAPI } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

const ALCANCES_MODAL_THEME = {
  headerBg: "linear-gradient(135deg, #0f5132 0%, #166534 56%, #2f7d57 100%)",
  shellBg: "linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%)",
  shellBorder: "1px solid rgba(27, 94, 58, 0.12)",
  divider: "#deece3",
  softBg: "#f5fbf7",
  softBgStrong: "#eef7f1",
  rowBg: "#f8fcf9",
  rowBorder: "#d7e7dd",
  accent: "#166534",
  accentStrong: "#0f5132",
  accentSoft: "#d8ede0",
  text: "#173826",
  textSoft: "#5b7667",
  inputBg: "#f7fcf8",
  inputBorder: "#bfd8c7",
};

const SELECT_OPTIONS = {
  accion: [
    { value: "", label: "Accion" },
    { value: "temporal_a", label: "Temporal A" },
    { value: "temporal_b", label: "Temporal B" },
    { value: "temporal_c", label: "Temporal C" },
  ],
  concepto: [
    { value: "", label: "Concepto" },
    { value: "temporal_a", label: "Temporal A" },
    { value: "temporal_b", label: "Temporal B" },
    { value: "temporal_c", label: "Temporal C" },
  ],
  cantidad: [
    { value: "", label: "Cantidad" },
    { value: "temporal_a", label: "Temporal A" },
    { value: "temporal_b", label: "Temporal B" },
    { value: "temporal_c", label: "Temporal C" },
  ],
  unidad: [
    { value: "", label: "Unidad" },
    { value: "temporal_a", label: "Temporal A" },
    { value: "temporal_b", label: "Temporal B" },
    { value: "temporal_c", label: "Temporal C" },
  ],
};

function createDraftRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accion: "",
    concepto: "",
    cantidad: "",
    unidad: "",
  };
}

function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function isRowEmpty(row) {
  return !row.accion && !row.concepto && !row.cantidad && !row.unidad;
}

function isRowComplete(row) {
  return !!row.accion && !!row.concepto && !!row.cantidad && !!row.unidad;
}

function serializeRows(rows) {
  return rows
    .map((row, index) => {
      const accion = getOptionLabel(SELECT_OPTIONS.accion, row.accion);
      const concepto = getOptionLabel(SELECT_OPTIONS.concepto, row.concepto);
      const cantidad = getOptionLabel(SELECT_OPTIONS.cantidad, row.cantidad);
      const unidad = getOptionLabel(SELECT_OPTIONS.unidad, row.unidad);
      return `${index + 1}. Accion: ${accion} | Concepto: ${concepto} | Cantidad: ${cantidad} | Unidad: ${unidad}`;
    })
    .join("\n");
}

function CompactSelect({ value, onChange, options, ariaLabel }) {
  return (
    <select
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className="w-full min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006341]"
      style={{
        border: `1px solid ${ALCANCES_MODAL_THEME.inputBorder}`,
        backgroundColor: ALCANCES_MODAL_THEME.inputBg,
        color: value ? ALCANCES_MODAL_THEME.text : ALCANCES_MODAL_THEME.textSoft,
      }}
    >
      {options.map((option) => (
        <option key={option.value || option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function ModalAlcances({ open, obra, onClose }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([createDraftRow()]);
  const [alcances, setAlcances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const cargarAlcances = useCallback(async () => {
    if (!obra) return;
    setLoading(true);
    try {
      const res = await alcancesAPI.getByObra(obra.id_obra || obra.id, obra.tabla || "");
      setAlcances(res.data || []);
    } catch {
      setAlcances([]);
    } finally {
      setLoading(false);
    }
  }, [obra]);

  useEffect(() => {
    if (!open) return;
    setRows([createDraftRow()]);
    setError(null);
    setSuccess(false);
    cargarAlcances();
  }, [open, cargarAlcances]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleRowChange = useCallback((rowId, field, value) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
    setError(null);
    setSuccess(false);
  }, []);

  const addRow = useCallback(() => {
    setRows((current) => [...current, createDraftRow()]);
    setError(null);
    setSuccess(false);
  }, []);

  const removeRow = useCallback((rowId) => {
    setRows((current) => {
      if (current.length === 1) return [createDraftRow()];
      return current.filter((row) => row.id !== rowId);
    });
    setError(null);
    setSuccess(false);
  }, []);

  const guardar = useCallback(async () => {
    const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));
    if (nonEmptyRows.length === 0) {
      setError("Agrega al menos un alcance antes de guardar.");
      return;
    }

    const hasIncompleteRows = nonEmptyRows.some((row) => !isRowComplete(row));
    if (hasIncompleteRows) {
      setError("Completa los cuatro campos de cada alcance antes de guardar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await alcancesAPI.crear(
        obra.id_obra || obra.id,
        obra.tabla || "",
        serializeRows(nonEmptyRows),
        user?.email || user?.usuario || "sistema"
      );
      setSuccess(true);
      setRows([createDraftRow()]);
      await cargarAlcances();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Error al registrar el alcance");
    } finally {
      setSaving(false);
    }
  }, [rows, obra, user, cargarAlcances]);

  if (!open) return null;

  const obraNombre = obra?.nombre_obra || obra?.nombre || "Obra";
  const obraMeta = [obra?.programa, obra?.dg || obra?.direccion_general].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{ backgroundColor: "rgba(0,0,0,0.50)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: "980px", maxHeight: "88vh", background: ALCANCES_MODAL_THEME.shellBg, border: ALCANCES_MODAL_THEME.shellBorder }}
      >
        <div
          className="px-5 sm:px-6 py-4 shrink-0"
          style={{ background: ALCANCES_MODAL_THEME.headerBg }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.68)" }}
              >
                Modulo de Alcances
              </p>
              <h2 className="mt-0.5 text-base sm:text-lg font-bold text-white truncate">{obraNombre}</h2>
              {obraMeta && (
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {obraMeta}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full w-9 h-9 text-lg font-bold"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.20)",
              }}
              aria-label="Cerrar"
            >
              x
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 sm:px-6 py-4 border-b" style={{ borderColor: ALCANCES_MODAL_THEME.divider }}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: ALCANCES_MODAL_THEME.text }}>
                  Captura rapida de alcances
                </p>
                <p className="text-xs mt-1" style={{ color: ALCANCES_MODAL_THEME.textSoft }}>
                  Estructura inicial con catalogos temporales. La logica operativa actual permanece intacta.
                </p>
              </div>
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full self-start"
                style={{ backgroundColor: ALCANCES_MODAL_THEME.accentSoft, color: ALCANCES_MODAL_THEME.accentStrong, border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}` }}
              >
                {rows.length} fila{rows.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="rounded-2xl p-3"
                  style={{ backgroundColor: ALCANCES_MODAL_THEME.rowBg, border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ALCANCES_MODAL_THEME.textSoft }}>
                      Alcance {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: rows.length === 1 ? "#edf4ef" : "#e8f3ec",
                        color: rows.length === 1 ? "#93a69a" : ALCANCES_MODAL_THEME.accentStrong,
                        border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}`,
                        cursor: rows.length === 1 ? "not-allowed" : "pointer",
                      }}
                      disabled={rows.length === 1}
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1.15fr_0.8fr_0.8fr] gap-2">
                    <CompactSelect
                      value={row.accion}
                      onChange={(event) => handleRowChange(row.id, "accion", event.target.value)}
                      options={SELECT_OPTIONS.accion}
                      ariaLabel={`Accion del alcance ${index + 1}`}
                    />
                    <CompactSelect
                      value={row.concepto}
                      onChange={(event) => handleRowChange(row.id, "concepto", event.target.value)}
                      options={SELECT_OPTIONS.concepto}
                      ariaLabel={`Concepto del alcance ${index + 1}`}
                    />
                    <CompactSelect
                      value={row.cantidad}
                      onChange={(event) => handleRowChange(row.id, "cantidad", event.target.value)}
                      options={SELECT_OPTIONS.cantidad}
                      ariaLabel={`Cantidad del alcance ${index + 1}`}
                    />
                    <CompactSelect
                      value={row.unidad}
                      onChange={(event) => handleRowChange(row.id, "unidad", event.target.value)}
                      options={SELECT_OPTIONS.unidad}
                      ariaLabel={`Unidad del alcance ${index + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                type="button"
                onClick={addRow}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl self-start"
                style={{
                  backgroundColor: "#ffffff",
                  color: ALCANCES_MODAL_THEME.accent,
                  border: `1px dashed ${ALCANCES_MODAL_THEME.inputBorder}`,
                  boxShadow: "0 6px 14px rgba(15,81,50,0.06)",
                }}
              >
                + Agregar alcance
              </button>

              <div className="text-xs min-h-[20px] sm:text-right" style={{ color: ALCANCES_MODAL_THEME.textSoft }}>
                {error && <span style={{ color: "#dc2626" }}>{error}</span>}
                {success && <span style={{ color: ALCANCES_MODAL_THEME.accent, fontWeight: 600 }}>Alcances registrados correctamente</span>}
                {!error && !success && (
                  <span>Completa los 4 campos de cada fila antes de guardar.</span>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: ALCANCES_MODAL_THEME.textSoft }}
              >
                Historial de alcances
              </p>
              <span className="text-xs" style={{ color: ALCANCES_MODAL_THEME.textSoft }}>
                {alcances.length} registro{alcances.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: ALCANCES_MODAL_THEME.accent, borderTopColor: "transparent" }}
                />
              </div>
            ) : alcances.length === 0 ? (
              <div
                className="text-center py-8 rounded-2xl"
                style={{ backgroundColor: ALCANCES_MODAL_THEME.softBg, border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}` }}
              >
                <p className="text-sm font-medium" style={{ color: ALCANCES_MODAL_THEME.textSoft }}>
                  Sin alcances registrados
                </p>
                <p className="text-xs mt-1" style={{ color: "#89a092" }}>
                  Lo que guardes en esta captura aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alcances.map((alcance, index) => (
                  <div
                    key={index}
                    className="rounded-2xl p-3"
                    style={{ backgroundColor: ALCANCES_MODAL_THEME.softBgStrong, border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}` }}
                  >
                    <p className="text-sm whitespace-pre-line" style={{ color: ALCANCES_MODAL_THEME.text }}>
                      {alcance.texto || alcance.descripcion || alcance.alcance || String(alcance)}
                    </p>
                    <div
                      className="flex items-center gap-3 mt-2 text-xs flex-wrap"
                      style={{ color: ALCANCES_MODAL_THEME.textSoft }}
                    >
                      {alcance.usuario && <span>{alcance.usuario}</span>}
                      {alcance.created_at && (
                        <span>
                          {new Date(alcance.created_at).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="px-5 sm:px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0"
          style={{ borderColor: ALCANCES_MODAL_THEME.divider }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: "#edf4ef", color: ALCANCES_MODAL_THEME.text, border: `1px solid ${ALCANCES_MODAL_THEME.rowBorder}` }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl"
            style={{
              backgroundColor: saving ? "#c9d6ce" : ALCANCES_MODAL_THEME.accent,
              color: "#ffffff",
              border: "1px solid rgba(15,81,50,0.14)",
              cursor: saving ? "wait" : "pointer",
              boxShadow: saving ? "none" : "0 10px 18px rgba(15,81,50,0.14)",
            }}
          >
            {saving ? "Guardando..." : "Guardar alcances"}
          </button>
        </div>
      </div>
    </div>
  );
}
