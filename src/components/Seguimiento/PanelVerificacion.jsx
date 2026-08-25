import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { formatearFechaHora } from "../../utils/formatters";
import { getVerificacion, marcarVerificado, quitarVerificacion, puedeVerificar, ROLES_VALIDADOR_DEFAULT } from "../../utils/verificacion";

/* Ajuste de minuta (sesión de revisión #3/#4) — bloque reutilizable de
   "Verificado": distinto de la entrega, confirma que alguien más ya
   revisó la información. Se oculta por completo si el requerimiento no
   está verificado y el usuario actual no tiene permiso para validarlo,
   para no ensuciar la pantalla de quien solo captura. */
export default function PanelVerificacion({ obraKey, reqId, rolesPermitidos = ROLES_VALIDADOR_DEFAULT }) {
  const { user } = useAuth();
  const [verificacion, setVerificacion] = useState(() => getVerificacion(obraKey, reqId));
  const [notas, setNotas] = useState("");
  const puede = puedeVerificar(user?.rol, rolesPermitidos);

  if (!verificacion && !puede) return null;

  const verificar = () => {
    setVerificacion(marcarVerificado(obraKey, reqId, { verificadoPor: user?.nombre || user?.usuario || user?.email, notas }));
    setNotas("");
  };

  const quitar = () => {
    quitarVerificacion(obraKey, reqId);
    setVerificacion(null);
  };

  return (
    <div
      className="rounded-xl px-4 py-3 space-y-2"
      style={{
        border: `1.5px solid ${verificacion ? "var(--verde)" : "var(--border)"}`,
        backgroundColor: verificacion ? "rgba(0,99,65,0.05)" : "var(--surface-2)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: verificacion ? "var(--verde)" : "#8C6B41" }}>
          {verificacion ? "✓ Verificado" : "Validación pendiente"}
        </p>
        {verificacion && puede && (
          <button type="button" onClick={quitar} className="text-[11px] font-bold" style={{ color: "var(--rojo)" }}>
            Quitar
          </button>
        )}
      </div>

      {verificacion ? (
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Por {verificacion.verificadoPor} · {formatearFechaHora(verificacion.fecha)}
          {verificacion.notas && <><br />{verificacion.notas}</>}
        </p>
      ) : puede ? (
        <>
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
            Distinto de la entrega: confirma que ya revisaste esta información antes de darla por válida.
          </p>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Notas de validación (opcional)"
            className="w-full px-3 py-2 text-xs rounded-lg resize-none"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={verificar}
            className="w-full py-2 rounded-lg text-xs font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={{ backgroundColor: "var(--verde)" }}
          >
            Marcar como verificado
          </button>
        </>
      ) : null}
    </div>
  );
}
