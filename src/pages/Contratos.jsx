import React, { useMemo, useState } from "react";
import Sidebar from "../components/Layout/Sidebar";
import Footer from "../components/Layout/Footer";
import Button from "../components/Shared/Button";
import { useAuth } from "../context/AuthContext";
import { useObras } from "../context/ObraContext";
import { getObraKey } from "../utils/seguimiento";
import { ROLES_RESPONSABLE } from "../data/seguimientoCatalogo";
import { TABLAS_VALIDAS } from "../utils/api";
import {
  getContratos,
  crearContrato,
  guardarContrato,
  eliminarContrato,
  agregarDeduccion,
  eliminarDeduccion,
  agregarSancion,
  eliminarSancion,
  getObrasVinculadas,
  vincularObraContrato,
  desvincularObraContrato,
  puedeEditarContrato,
  puedeEditarFrentes,
  TIPO_CONTRATO_SUPERVISION,
  vincularContratoSupervision,
  desvincularContratoSupervision,
  getContratoSupervision,
  getContratosDeObraPorSupervision,
} from "../utils/contratos";

import { EJEMPLO_CONTRATO, DEDUCCIONES_EJEMPLO, SANCIONES_EJEMPLO } from "../data/ejemploContrato";

const ACCENTS = ["#1e293b", "#006341", "#691C32"];

function Campo({ label, children, opcional }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#8C6B41" }}>
        {label} {opcional && <span className="text-gray-400 font-normal normal-case">(opcional)</span>}
      </label>
      {children}
    </div>
  );
}

function inputClass() {
  return "w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[#691C32]/30 focus:border-[#691C32] disabled:opacity-60 disabled:cursor-not-allowed";
}
function inputStyle() {
  return { border: "1px solid #D4C4B0" };
}

function Seccion({ numero, titulo, accent, children, soloLectura }) {
  return (
    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${accent}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>{numero} /</span>
        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: accent }}>{titulo}</h3>
        {soloLectura && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-faint)" }}>
            Solo lectura
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

/* Lista de contratos — panel izquierdo */
function ListaContratos({ contratos, activoId, onSeleccionar, onNuevo, onAutollenar, puedeEditar }) {
  return (
    <div className="w-full lg:w-72 shrink-0 space-y-2">
      {puedeEditar && (
        <>
          <button
            type="button"
            onClick={onNuevo}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={{ backgroundColor: "var(--guinda)" }}
          >
            + Nuevo contrato
          </button>
          <button
            type="button"
            onClick={onAutollenar}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.98]"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px dashed var(--guinda)" }}
          >
            ⚡ Autollenar ejemplo
          </button>
        </>
      )}
      <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
        {contratos.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>Aún no hay contratos registrados.</p>
        )}
        {contratos.map((c) => {
          const nObras = getObrasVinculadas(c.id).length;
          const activo = c.id === activoId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSeleccionar(c.id)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl transition-colors"
              style={activo
                ? { backgroundColor: "var(--guinda)", color: "#fff" }
                : { backgroundColor: "#fff", color: "var(--ink)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold truncate">{c.numero_contrato || "Contrato sin número"}</p>
                {c.tipo_contrato === "supervision" && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                    style={activo ? { backgroundColor: "rgba(255,255,255,0.2)" } : { backgroundColor: "rgba(105,28,50,0.08)", color: "var(--guinda)" }}
                  >
                    Supervisión
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ opacity: 0.75 }}>{c.contratista || "Sin contratista"}</p>
              <p className="text-[11px] mt-1 font-semibold" style={{ opacity: 0.75 }}>{nObras} obra{nObras === 1 ? "" : "s"} vinculada{nObras === 1 ? "" : "s"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Buscador + toggle de vinculación de obras */
function VinculacionObras({ contratoId, obrasCatalogo }) {
  const [busqueda, setBusqueda] = useState("");
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza releer vínculos tras togglear
  const vinculadas = useMemo(() => new Set(getObrasVinculadas(contratoId)), [contratoId, version]);

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    return obrasCatalogo
      .filter((o) => [o.nombre_obra, o.nombre, o.clave_unica].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [busqueda, obrasCatalogo]);

  const obrasVinculadasInfo = useMemo(
    () => obrasCatalogo.filter((o) => vinculadas.has(getObraKey(o))),
    [obrasCatalogo, vinculadas]
  );

  const toggle = (obra) => {
    const key = getObraKey(obra);
    if (vinculadas.has(key)) desvincularObraContrato(contratoId, key);
    else vincularObraContrato(contratoId, key);
    setVersion((v) => v + 1);
  };

  return (
    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[1]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>V /</span>
        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[1] }}>Obras vinculadas a este contrato</h3>
      </div>

      <div className="space-y-2 mb-3">
        {obrasVinculadasInfo.length === 0 && (
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Aún no hay obras vinculadas — el resto de módulos no podrán tomar datos de este contrato hasta que vincules al menos una.</p>
        )}
        {obrasVinculadasInfo.map((o) => (
          <div key={getObraKey(o)} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(0,99,65,0.06)", border: "1px solid rgba(0,99,65,0.18)" }}>
            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{o.nombre_obra || o.nombre}</span>
            <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--ink-faint)" }}>{o.clave_unica}</span>
            <button type="button" onClick={() => toggle(o)} className="text-[11px] font-bold shrink-0" style={{ color: "var(--rojo)" }}>Quitar</button>
          </div>
        ))}
      </div>

      <Campo label="Buscar obra por nombre o clave">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe para buscar..." className={inputClass()} style={inputStyle()} />
      </Campo>
      {resultados.length > 0 && (
        <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
          {resultados.map((o) => {
            const key = getObraKey(o);
            const yaVinculada = vinculadas.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left"
                style={yaVinculada ? { backgroundColor: "rgba(0,99,65,0.06)", border: "1px solid rgba(0,99,65,0.18)" } : { border: "1px solid var(--border)" }}
              >
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{o.nombre_obra || o.nombre}</span>
                <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--ink-faint)" }}>{o.clave_unica}</span>
                <span className="text-[11px] font-bold shrink-0" style={{ color: yaVinculada ? "var(--rojo)" : "var(--verde)" }}>{yaVinculada ? "Quitar" : "Vincular"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Ajuste de fondo (área técnica, 11 de agosto): la supervisión externa
   ya no son campos sueltos dentro del contrato de obra — es OTRO
   contrato, independiente, con su propia carátula completa (su propio
   número, empresa, importe, fechas). Esta sección vincula el contrato
   de obra activo con un contrato de supervisión real (existente o
   nuevo) en vez de capturarlo como texto suelto. Una supervisión puede
   atender varias empresas de obra con un mismo contrato — por eso el
   picker ofrece "vincular uno existente" además de "crear nuevo". */
function SeccionSupervisionVinculada({ contratoActivo, contratos, editable, onVincular, onDesvincular, onCrearYVincular, onVerContrato }) {
  const [busqueda, setBusqueda] = useState("");

  /* Hook arriba de cualquier return condicional (reglas de hooks) —
     inofensivo calcularlo aunque este contrato sea de tipo supervisión,
     ese caso ni siquiera lo usa. */
  const candidatos = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    return contratos
      .filter((c) => c.tipo_contrato === TIPO_CONTRATO_SUPERVISION)
      .filter((c) => [c.numero_contrato, c.contratista].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [busqueda, contratos]);

  if (contratoActivo.tipo_contrato === TIPO_CONTRATO_SUPERVISION) {
    const obrasAtendidas = getContratosDeObraPorSupervision(contratoActivo.id);
    return (
      <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[0]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>07 /</span>
          <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[0] }}>Contratos de obra que atiende</h3>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(105,28,50,0.08)", color: "var(--guinda)" }}>
            Este es un contrato de supervisión
          </span>
        </div>
        {obrasAtendidas.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Ningún contrato de obra está vinculado a esta supervisión todavía — se vincula desde el contrato de obra, no desde aquí.</p>
        ) : (
          <div className="space-y-2">
            {obrasAtendidas.map((c) => (
              <button key={c.id} type="button" onClick={() => onVerContrato(c.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left" style={{ backgroundColor: "#F7F3EE" }}>
                <span className="text-sm flex-1 min-w-0 truncate font-semibold" style={{ color: "var(--ink)" }}>{c.numero_contrato || "Contrato sin número"}</span>
                <span className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{c.contratista || "Sin contratista"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const supervisionVinculada = getContratoSupervision(contratoActivo.id);

  return (
    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[0]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>07 /</span>
        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[0] }}>Contrato de supervisión vinculado</h3>
        {!editable && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-faint)" }}>
            Solo lectura
          </span>
        )}
      </div>

      {supervisionVinculada ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(0,99,65,0.06)", border: "1px solid rgba(0,99,65,0.18)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{supervisionVinculada.numero_contrato || "Contrato sin número"}</p>
            <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{supervisionVinculada.contratista || "Sin empresa"} · {supervisionVinculada.importe_total ? `$${Number(supervisionVinculada.importe_total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "sin importe"}</p>
          </div>
          <button type="button" onClick={() => onVerContrato(supervisionVinculada.id)} className="text-[11px] font-bold shrink-0" style={{ color: "var(--guinda)" }}>Ver / editar →</button>
          {editable && (
            <button type="button" onClick={onDesvincular} className="text-[11px] font-bold shrink-0" style={{ color: "var(--rojo)" }}>Desvincular</button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
            Aún no hay contrato de supervisión vinculado. El avance de obra que reporta Supervisión Externa pertenece a este contrato — la supervisión tiene su propio contrato, con su propio importe (normalmente 5-6% del monto de la obra).
          </p>
          {editable && (
            <>
              <button
                type="button"
                onClick={onCrearYVincular}
                className="text-xs font-bold px-3 py-2 rounded-lg mb-3"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--guinda)", border: "1px dashed var(--guinda)" }}
              >
                + Crear contrato de supervisión nuevo
              </button>
              <Campo label="O vincular un contrato de supervisión ya existente">
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por número de contrato o empresa..." className={inputClass()} style={inputStyle()} />
              </Campo>
              {candidatos.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {candidatos.map((c) => (
                    <button key={c.id} type="button" onClick={() => onVincular(c.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left" style={{ border: "1px solid var(--border)" }}>
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{c.numero_contrato || "Contrato sin número"}</span>
                      <span className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{c.contratista}</span>
                      <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--verde)" }}>Vincular</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Contratos() {
  const { user } = useAuth();
  const { obrasRaw, obras } = useObras();
  const obrasCatalogo = obrasRaw || obras || [];
  const rol = user?.rol;
  const editable = puedeEditarContrato(rol);
  const editableFrentes = editable || puedeEditarFrentes(rol);

  const [contratos, setContratos] = useState(() => getContratos());
  const [contratoActivoId, setContratoActivoId] = useState(() => getContratos()[0]?.id || null);
  const [deduccionNueva, setDeduccionNueva] = useState({ concepto: "", porcentaje: "" });
  const [sancionNueva, setSancionNueva] = useState({ concepto: "", porcentaje: "", diasPermitidos: "" });

  const contratoActivo = contratos.find((c) => c.id === contratoActivoId) || null;

  const nuevoContrato = () => {
    const creado = crearContrato(user?.email);
    setContratos(getContratos());
    setContratoActivoId(creado.id);
  };

  /* Botón de demo: llena un contrato nuevo con el ejemplo real
     compartido (SIRBASA/Iztapalapa), sin capturar nada a mano. */
  const autollenarEjemplo = () => {
    const creado = crearContrato(user?.email);
    guardarContrato(creado.id, { ...creado, ...EJEMPLO_CONTRATO }, user?.email);
    for (const d of DEDUCCIONES_EJEMPLO) agregarDeduccion(creado.id, user?.email, d);
    for (const s of SANCIONES_EJEMPLO) agregarSancion(creado.id, user?.email, s);
    setContratos(getContratos());
    setContratoActivoId(creado.id);
  };

  const set = (campo) => (e) => {
    if (!contratoActivo) return;
    const next = guardarContrato(contratoActivo.id, { ...contratoActivo, [campo]: e.target.value }, user?.email);
    setContratos((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  /* Crea un contrato de supervisión nuevo (independiente, tipo_contrato
     "supervision") y lo vincula de una vez al contrato de obra activo —
     luego se cambia a él para capturar su propia carátula. */
  const crearYVincularSupervision = () => {
    if (!contratoActivo) return;
    const creado = crearContrato(user?.email);
    guardarContrato(creado.id, { ...creado, tipo_contrato: TIPO_CONTRATO_SUPERVISION }, user?.email);
    vincularContratoSupervision(contratoActivo.id, creado.id, user?.email);
    setContratos(getContratos());
    setContratoActivoId(creado.id);
  };

  const vincularSupervisionExistente = (contratoSupervisionId) => {
    if (!contratoActivo) return;
    vincularContratoSupervision(contratoActivo.id, contratoSupervisionId, user?.email);
    setContratos(getContratos());
  };

  const desvincularSupervision = () => {
    if (!contratoActivo) return;
    desvincularContratoSupervision(contratoActivo.id, user?.email);
    setContratos(getContratos());
  };

  const borrarContrato = () => {
    if (!contratoActivo) return;
    eliminarContrato(contratoActivo.id);
    setContratos(getContratos());
    setContratoActivoId(null);
  };

  const agregarDeduccionNueva = () => {
    if (!contratoActivo || !deduccionNueva.concepto.trim()) return;
    const next = agregarDeduccion(contratoActivo.id, user?.email, deduccionNueva);
    setContratos((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    setDeduccionNueva({ concepto: "", porcentaje: "" });
  };
  const quitarDeduccion = (id) => {
    const next = eliminarDeduccion(contratoActivo.id, user?.email, id);
    setContratos((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  const agregarSancionNueva = () => {
    if (!contratoActivo || !sancionNueva.concepto.trim()) return;
    const next = agregarSancion(contratoActivo.id, user?.email, sancionNueva);
    setContratos((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    setSancionNueva({ concepto: "", porcentaje: "", diasPermitidos: "" });
  };
  const quitarSancion = (id) => {
    const next = eliminarSancion(contratoActivo.id, user?.email, id);
    setContratos((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  if (!editable && !puedeEditarFrentes(rol)) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 flex items-center justify-center">
              <p className="text-sm font-medium" style={{ color: "var(--rojo)" }}>
                Acceso restringido — Solo Director de Concursos y Contratos, Director de Obra y Administración.
              </p>
            </main>
            <Footer />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "#8C6B41" }}>Paso 1 y 2 del flujo</p>
              <h1 className="text-2xl font-black" style={{ color: "var(--guinda)" }}>Registro de Contratos</h1>
              <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                Captura el contrato una sola vez, aquí — luego vincúlalo a la obra o las obras que atiende. Desde ahí, Supervisión Externa y los demás módulos ya lo ven precargado.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <ListaContratos
                contratos={contratos}
                activoId={contratoActivoId}
                onSeleccionar={setContratoActivoId}
                onNuevo={nuevoContrato}
                onAutollenar={autollenarEjemplo}
                puedeEditar={editable}
              />

              <div className="flex-1 min-w-0">
                {!contratoActivo ? (
                  <div className="card bg-blueprint text-center py-14 px-6">
                    <p className="text-sm font-black" style={{ color: "var(--ink)" }}>Selecciona un contrato o crea uno nuevo.</p>
                  </div>
                ) : (
                  <>
                    <Seccion numero="01" titulo="Identificación del contrato" accent={ACCENTS[0]} soloLectura={!editable}>
                      <Campo label="Número de contrato">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.numero_contrato} onChange={set("numero_contrato")} />
                      </Campo>
                      <Campo label="Procedimiento">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.procedimiento} onChange={set("procedimiento")} />
                      </Campo>
                      <Campo label="Número de concurso" opcional>
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.numero_concurso} onChange={set("numero_concurso")} />
                      </Campo>
                      <Campo label="Fecha de contrato">
                        <input disabled={!editable} type="date" className={inputClass()} style={inputStyle()} value={contratoActivo.fecha_contrato} onChange={set("fecha_contrato")} />
                      </Campo>
                    </Seccion>

                    <Seccion numero="02" titulo="Dependencia y área" accent={ACCENTS[1]} soloLectura={!editable}>
                      <Campo label="Dependencia">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.dependencia} onChange={set("dependencia")} />
                      </Campo>
                      <Campo label="Dirección general">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.direccion_general} onChange={set("direccion_general")} />
                      </Campo>
                      <Campo label="Programa">
                        <select disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.programa} onChange={set("programa")}>
                          <option value="">Seleccione un programa</option>
                          {TABLAS_VALIDAS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </Campo>
                      <Campo label="Área responsable">
                        <select disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.area_responsable} onChange={set("area_responsable")}>
                          <option value="">Seleccione un área responsable</option>
                          {Object.entries(ROLES_RESPONSABLE).map(([code, label]) => (
                            <option key={code} value={code}>{label}</option>
                          ))}
                        </select>
                      </Campo>
                    </Seccion>

                    <Seccion numero="03" titulo="Datos financieros" accent={ACCENTS[2]} soloLectura={!editable}>
                      <Campo label="Importe sin IVA">
                        <input disabled={!editable} type="number" step="0.01" placeholder="$ 0.00" className={inputClass()} style={inputStyle()} value={contratoActivo.importe_sin_iva} onChange={set("importe_sin_iva")} />
                      </Campo>
                      <Campo label="IVA">
                        <input disabled={!editable} type="number" step="0.01" placeholder="$ 0.00" className={inputClass()} style={inputStyle()} value={contratoActivo.iva} onChange={set("iva")} />
                      </Campo>
                      <Campo label="Importe total">
                        <input disabled={!editable} type="number" step="0.01" placeholder="$ 0.00" className={inputClass()} style={inputStyle()} value={contratoActivo.importe_total} onChange={set("importe_total")} />
                      </Campo>
                      <Campo label="Anticipo">
                        <input disabled={!editable} type="number" step="0.01" placeholder="$ 0.00" className={inputClass()} style={inputStyle()} value={contratoActivo.anticipo} onChange={set("anticipo")} />
                      </Campo>
                      <Campo label="Tipo de ejercicio">
                        <select disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.tipo_ejercicio} onChange={set("tipo_ejercicio")}>
                          <option value="Anual">Anual</option>
                          <option value="Multianual">Multianual</option>
                        </select>
                      </Campo>
                    </Seccion>

                    <Seccion numero="04" titulo="Programación presupuestal" accent={ACCENTS[0]} soloLectura={!editable}>
                      <Campo label="Oficio de autorización">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.oficio_autorizacion} onChange={set("oficio_autorizacion")} />
                      </Campo>
                      <Campo label="Número de acuerdo">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.numero_acuerdo} onChange={set("numero_acuerdo")} />
                      </Campo>
                      <Campo label="Clave programática presupuestal">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.clave_programatica_presupuestal} onChange={set("clave_programatica_presupuestal")} />
                      </Campo>
                      <Campo label="Fondo de aportación">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.fondo_aportacion} onChange={set("fondo_aportacion")} />
                      </Campo>
                    </Seccion>

                    <Seccion numero="05" titulo="Ejecución" accent={ACCENTS[1]} soloLectura={!editable}>
                      <Campo label="Fecha de inicio">
                        <input disabled={!editable} type="date" className={inputClass()} style={inputStyle()} value={contratoActivo.fecha_inicio} onChange={set("fecha_inicio")} />
                      </Campo>
                      <Campo label="Fecha de término">
                        <input disabled={!editable} type="date" className={inputClass()} style={inputStyle()} value={contratoActivo.fecha_termino} onChange={set("fecha_termino")} />
                      </Campo>
                      <Campo label="Días naturales">
                        <input disabled={!editable} type="number" min="1" placeholder="Ej. 60" className={inputClass()} style={inputStyle()} value={contratoActivo.dias_naturales} onChange={set("dias_naturales")} />
                      </Campo>
                      <Campo label="Plazo de ejecución" opcional>
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} placeholder="Ej. 180 días naturales" value={contratoActivo.plazo_ejecucion} onChange={set("plazo_ejecucion")} />
                      </Campo>
                      <Campo label="Cortes">
                        <input disabled className={inputClass()} style={inputStyle()} value="Lunes a domingo" readOnly />
                      </Campo>
                    </Seccion>

                    <Seccion numero="06" titulo="Contratista" accent={ACCENTS[2]} soloLectura={!editable}>
                      <Campo label="Contratista">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.contratista} onChange={set("contratista")} />
                      </Campo>
                      <Campo label="Representante legal">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.representante_legal} onChange={set("representante_legal")} />
                      </Campo>
                      <Campo label="RFC">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.rfc} onChange={set("rfc")} />
                      </Campo>
                      <Campo label="Domicilio fiscal">
                        <input disabled={!editable} className={inputClass()} style={inputStyle()} value={contratoActivo.domicilio_fiscal} onChange={set("domicilio_fiscal")} />
                      </Campo>
                    </Seccion>

                    <SeccionSupervisionVinculada
                      contratoActivo={contratoActivo}
                      contratos={contratos}
                      editable={editable}
                      onVincular={vincularSupervisionExistente}
                      onDesvincular={desvincularSupervision}
                      onCrearYVincular={crearYVincularSupervision}
                      onVerContrato={setContratoActivoId}
                    />

                    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[1]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>08 /</span>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[1] }}>Frentes de trabajo</h3>
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--ink-faint)" }}>
                          Captura: Director de Obra
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Campo label="Número de frentes que atiende el contrato">
                          <input disabled={!editableFrentes} type="number" min="0" placeholder="Ej. 3" className={inputClass()} style={inputStyle()} value={contratoActivo.numero_frentes} onChange={set("numero_frentes")} />
                        </Campo>
                        <Campo label="Alcance por frente" opcional>
                          <input disabled={!editableFrentes} placeholder="Ej. 25 km por frente" className={inputClass()} style={inputStyle()} value={contratoActivo.alcance_frentes} onChange={set("alcance_frentes")} />
                        </Campo>
                      </div>
                    </div>

                    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[2]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>09 /</span>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[2] }}>Deducciones específicas</h3>
                      </div>
                      <div className="space-y-2 mb-3">
                        {contratoActivo.deducciones.length === 0 && (
                          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin deducciones registradas (ej. supervisión 2%, operación 1.5%).</p>
                        )}
                        {contratoActivo.deducciones.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#F7F3EE" }}>
                            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{d.concepto}</span>
                            <span className="text-sm font-bold shrink-0" style={{ color: "var(--guinda)" }}>{d.porcentaje}%</span>
                            {editable && (
                              <button type="button" onClick={() => quitarDeduccion(d.id)} className="p-1 shrink-0" style={{ color: "var(--rojo)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {editable && (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Campo label="Concepto">
                              <input className={inputClass()} style={inputStyle()} placeholder="Ej. Supervisión" value={deduccionNueva.concepto} onChange={(e) => setDeduccionNueva((d) => ({ ...d, concepto: e.target.value }))} />
                            </Campo>
                          </div>
                          <div className="w-28">
                            <Campo label="%">
                              <input type="number" step="0.01" className={inputClass()} style={inputStyle()} value={deduccionNueva.porcentaje} onChange={(e) => setDeduccionNueva((d) => ({ ...d, porcentaje: e.target.value }))} />
                            </Campo>
                          </div>
                          <Button size="sm" onClick={agregarDeduccionNueva}>+ Agregar</Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[0]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>10 /</span>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[0] }}>Sanciones</h3>
                      </div>
                      <div className="space-y-2 mb-3">
                        {contratoActivo.sanciones.length === 0 && (
                          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Sin sanciones registradas (ej. entrega extemporánea de estimación).</p>
                        )}
                        {contratoActivo.sanciones.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#F7F3EE" }}>
                            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{s.concepto}</span>
                            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{s.diasPermitidos} días permitidos</span>
                            <span className="text-sm font-bold shrink-0" style={{ color: "var(--guinda)" }}>{s.porcentaje}%</span>
                            {editable && (
                              <button type="button" onClick={() => quitarSancion(s.id)} className="p-1 shrink-0" style={{ color: "var(--rojo)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {editable && (
                        <div className="flex items-end gap-2 flex-wrap">
                          <div className="flex-1 min-w-[140px]">
                            <Campo label="Concepto">
                              <input className={inputClass()} style={inputStyle()} placeholder="Ej. Entrega extemporánea" value={sancionNueva.concepto} onChange={(e) => setSancionNueva((s) => ({ ...s, concepto: e.target.value }))} />
                            </Campo>
                          </div>
                          <div className="w-28">
                            <Campo label="Días permitidos">
                              <input type="number" className={inputClass()} style={inputStyle()} value={sancionNueva.diasPermitidos} onChange={(e) => setSancionNueva((s) => ({ ...s, diasPermitidos: e.target.value }))} />
                            </Campo>
                          </div>
                          <div className="w-24">
                            <Campo label="%">
                              <input type="number" step="0.01" className={inputClass()} style={inputStyle()} value={sancionNueva.porcentaje} onChange={(e) => setSancionNueva((s) => ({ ...s, porcentaje: e.target.value }))} />
                            </Campo>
                          </div>
                          <Button size="sm" onClick={agregarSancionNueva}>+ Agregar</Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[1]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>11 /</span>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[1] }}>Retenciones por atraso</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Campo label="Porcentaje contractual">
                          <input disabled={!editable} type="number" step="0.01" placeholder="Ej. 5" className={inputClass()} style={inputStyle()} value={contratoActivo.retencion_porcentaje} onChange={set("retencion_porcentaje")} />
                        </Campo>
                      </div>
                    </div>

                    <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: `4px solid ${ACCENTS[2]}`, boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>12 /</span>
                        <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: ACCENTS[2] }}>Objeto del contrato</h3>
                      </div>
                      <Campo label="Objeto del contrato">
                        <textarea disabled={!editable} rows={3} placeholder="Describa detalladamente el objeto del contrato..." className={`${inputClass()} resize-none`} style={inputStyle()} value={contratoActivo.objeto_contrato} onChange={set("objeto_contrato")} />
                      </Campo>
                    </div>

                    <VinculacionObras contratoId={contratoActivo.id} obrasCatalogo={obrasCatalogo} />

                    {contratoActivo.observaciones.length > 0 && (
                      <div className="rounded-2xl p-5 mb-3 bg-white" style={{ borderLeft: "4px solid #92400e", boxShadow: "0 1px 4px rgba(76,57,35,0.06)" }}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-sm font-mono font-bold" style={{ color: "#BC955C" }}>13 /</span>
                          <h3 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: "#92400e" }}>Observaciones de Supervisión Externa</h3>
                        </div>
                        <div className="space-y-2">
                          {contratoActivo.observaciones.map((o) => (
                            <div key={o.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                              <p className="text-sm" style={{ color: "var(--ink)" }}>{o.texto}</p>
                              <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>{o.autor}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editable && (
                      <div className="flex justify-end pt-1">
                        <button type="button" onClick={borrarContrato} className="text-xs font-bold" style={{ color: "var(--rojo)" }}>Eliminar este contrato</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
