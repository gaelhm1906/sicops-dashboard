import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Layout/Sidebar";
import Footer from "../../components/Layout/Footer";
import Button from "../../components/Shared/Button";
import { useAuth } from "../../context/AuthContext";
import {
  getPsToken,
  getPsUser,
  listarPendientes,
  buscarObras,
  clasificarContrato,
  vincularContrato,
  desvincularContrato,
  obtenerVinculados,
  marcarSupervisionInterna,
  guardarResidenteObra,
  obtenerObrasVinculadasDeContrato,
} from "../../api/psContratosApi";

const TIPOS = [
  { key: "OBRA", label: "Obra", desc: "Contrato principal de construcción — puede ser un paquete de varias obras", modo: "multi" },
  { key: "SUPERVISION", label: "Supervisión", desc: "Puede cubrir varias obras a la vez", modo: "multi" },
  { key: "SERVICIOS", label: "Servicios", desc: "Puede repartirse entre varias obras", modo: "multi" },
  { key: "ADQUISICIONES", label: "Adquisiciones", desc: "Se liga a una sola obra", modo: "single" },
];
const DIRECCIONES = ["A", "B", "C", "D"];

function money(n) {
  const v = parseFloat(n) || 0;
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function labelTipo(key) {
  return TIPOS.find((t) => t.key === key)?.label || key;
}

/* Mismo criterio que utils/misPendientes.js: agrupar por programa para que
   un listado de decenas de contratos sea navegable, y para que se note de
   una vez si el programa de un contrato coincide con el de las obras. */
function agruparContratosPorPrograma(contratos) {
  const porPrograma = new Map();
  for (const c of contratos) {
    const clave = c.programa || "Sin programa";
    if (!porPrograma.has(clave)) porPrograma.set(clave, []);
    porPrograma.get(clave).push(c);
  }
  return Array.from(porPrograma.entries())
    .map(([programa, items]) => ({
      programa,
      items,
      total: items.reduce((s, c) => s + (parseFloat(c.importe_total) || 0), 0),
    }))
    .sort((a, b) => {
      if (a.programa === "Sin programa") return 1;
      if (b.programa === "Sin programa") return -1;
      return a.programa.localeCompare(b.programa);
    });
}

/* Se llega aquí ya autenticado por el login principal — si la sesión no
   es una cuenta de PS_SICOPS_FINAL, no tiene caso pedir credenciales de
   nuevo, solo explicar que este módulo no le corresponde. */
function SinAcceso() {
  return (
    <div className="max-w-md mx-auto mt-16 rounded-2xl p-6 text-center" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p className="text-sm font-bold mb-1" style={{ color: "var(--ink)" }}>Este módulo no está disponible para tu cuenta</p>
      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        La clasificación de contratos es para las cuentas de Director de Concursos y Contratos / Director de Obras Públicas por Dirección General.
      </p>
    </div>
  );
}

/* Etiqueta chica reutilizada para cada contrato dentro de una familia
   (supervisión/servicios/adquisiciones) — mismo look que las etiquetas de
   tipo en la bandeja de clasificación. `onDesvincular` es opcional: cuando
   se pasa, aparece una "×" para corregir un error de vinculación sin tener
   que pedirle a alguien que lo arregle directo en BD. */
function ContratoChip({ contrato, color, onDesvincular, quitando }) {
  return (
    <div className="rounded-lg px-3 py-2 relative" style={{ background: "var(--surface-2)", border: "1px solid var(--border-soft)" }}>
      {onDesvincular && (
        <button
          type="button"
          onClick={onDesvincular}
          disabled={quitando}
          title="Desvincular esta obra (corregir error)"
          className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
          style={{ color: "var(--ink-faint)", background: "var(--surface)", opacity: quitando ? 0.4 : 1 }}
        >
          {quitando ? "…" : "×"}
        </button>
      )}
      <p className="text-[11px] font-bold pr-4" style={{ color }}>{contrato.numeroContrato}</p>
      <p className="text-xs truncate" style={{ color: "var(--ink)" }}>{contrato.contratista}</p>
      <p className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{money(contrato.importeTotal)}</p>
    </div>
  );
}

/* Residente de Obra: dato conocido por Contratos antes incluso de que
   exista una cuenta real de esa persona en el sistema — se captura como
   texto libre por obra, para vincularlo más adelante con el seguimiento.
   Mismo patrón visual que el toggle de Supervisión Interna: un estado
   "leer" (chip con el nombre o invitación a agregarlo) y uno "editar". */
function ResidenteObraEditor({ obra, onGuardar, guardando }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(obra.residenteObra || "");

  useEffect(() => {
    setValor(obra.residenteObra || "");
  }, [obra.residenteObra]);

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="flex items-center gap-1.5"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Residente de obra:</span>
        <span className="text-xs font-semibold" style={{ color: obra.residenteObra ? "var(--ink)" : "var(--guinda)" }}>
          {obra.residenteObra || "+ agregar"}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Nombre del Residente de Obra"
        className="text-xs px-2 py-1 rounded-lg"
        style={{ border: "1px solid var(--border)", width: 220 }}
      />
      <button
        type="button"
        onClick={async () => { await onGuardar(valor); setEditando(false); }}
        disabled={guardando}
        className="text-[10px] font-bold px-2 py-1 rounded-lg"
        style={{ background: "var(--guinda)", color: "#fff", opacity: guardando ? 0.6 : 1 }}
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => { setValor(obra.residenteObra || ""); setEditando(false); }}
        className="text-[10px] font-bold"
        style={{ color: "var(--ink-faint)" }}
      >
        Cancelar
      </button>
    </div>
  );
}

/* "Etapa 2" — no solo que un contrato quede ligado a su obra, sino ver la
   familia completa: contrato de obra + con qué supervisión/servicios/
   adquisiciones está conectado, y el monto total combinado. */
function VistaVinculados() {
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [quitando, setQuitando] = useState(null); // `${obraId}-${contratoId}` en curso
  const [marcandoInterna, setMarcandoInterna] = useState(null); // obraId en curso
  const [guardandoResidente, setGuardandoResidente] = useState(null); // obraId en curso

  const cargar = useCallback(() => {
    setCargando(true);
    obtenerVinculados()
      .then((d) => setObras(d.obras))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDesvincular = async (obraId, contrato) => {
    if (!window.confirm(`¿Quitar el vínculo del contrato ${contrato.numeroContrato}? El contrato regresa a "Por clasificar" para volver a vincularlo.`)) return;
    const key = `${obraId}-${contrato.id}`;
    setQuitando(key);
    setMensaje("");
    try {
      await desvincularContrato(contrato.id, obraId);
      setMensaje("✓ Vínculo eliminado — el contrato ya está de vuelta en \"Por clasificar\".");
      cargar();
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setQuitando(null);
    }
  };

  const handleSupervisionInterna = async (obraId, marcarComoInterna) => {
    if (marcarComoInterna && !window.confirm("¿Marcar esta obra como Supervisión Interna? Se usa cuando no hay (ni habrá) un contrato de supervisión externa — la supervisa personal de SOBSE.")) return;
    setMarcandoInterna(obraId);
    setMensaje("");
    try {
      await marcarSupervisionInterna(obraId, marcarComoInterna);
      setMensaje(marcarComoInterna ? "✓ Marcada como Supervisión Interna." : "✓ Se quitó la marca de Supervisión Interna.");
      cargar();
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setMarcandoInterna(null);
    }
  };

  const handleGuardarResidente = async (obraId, nombre) => {
    setGuardandoResidente(obraId);
    setMensaje("");
    try {
      await guardarResidenteObra(obraId, nombre);
      setMensaje(nombre?.trim() ? "✓ Residente de Obra guardado." : "✓ Residente de Obra eliminado.");
      cargar();
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setGuardandoResidente(null);
    }
  };

  if (cargando && obras.length === 0) return <p className="text-sm text-center py-10" style={{ color: "var(--ink-faint)" }}>Cargando vinculaciones…</p>;
  if (error) return <p className="text-sm text-center py-10" style={{ color: "var(--rojo, #B3261E)" }}>{error}</p>;

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: "var(--ink-faint)" }}>
        Un contrato de Obra/Supervisión/Servicios puede cubrir varias obras — para agregarle otra a uno que ya tiene, vuelve a "Por clasificar" y selecciónalo de nuevo: sigue apareciendo ahí con lo que ya tiene marcado.
      </p>
      {mensaje && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: mensaje.startsWith("Error") ? "var(--rojo-soft, #FBEAE8)" : "var(--verde-soft, #E3F1EC)",
            color: mensaje.startsWith("Error") ? "var(--rojo)" : "var(--verde)",
          }}
        >
          {mensaje}
        </div>
      )}
      {obras.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--ink-faint)" }}>
          Todavía no hay ningún contrato de obra clasificado — empieza en "Por clasificar".
        </p>
      ) : (
        <div className="space-y-4">
          {obras.map((o) => (
            <div key={o.obraId} className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{o.nombreObra}</p>
                <p className="text-sm font-extrabold" style={{ color: "var(--guinda)" }}>{money(o.montoTotal)} total</p>
              </div>
              <div className="mb-3">
                <ResidenteObraEditor
                  obra={o}
                  guardando={guardandoResidente === o.obraId}
                  onGuardar={(nombre) => handleGuardarResidente(o.obraId, nombre)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--verde, #006341)" }}>
                    Obra {o.contratoObra ? "" : "— sin vincular"}
                  </p>
                  {o.contratoObra ? (
                    <ContratoChip contrato={o.contratoObra} color="var(--verde, #006341)" onDesvincular={() => handleDesvincular(o.obraId, o.contratoObra)} quitando={quitando === `${o.obraId}-${o.contratoObra.id}`} />
                  ) : (
                    <p className="text-xs" style={{ color: "var(--ink-faint)" }}>— (llegó por otro tipo de contrato)</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--naranja, #B5680A)" }}>
                    Supervisión {o.supervisionInterna ? "" : o.supervisiones.length === 0 ? "— sin vincular" : `(${o.supervisiones.length})`}
                  </p>
                  {o.supervisionInterna ? (
                    <div className="rounded-lg px-3 py-2 flex items-center justify-between gap-2" style={{ background: "var(--verde-soft, #E3F1EC)", border: "1px solid var(--border-soft)" }}>
                      <span className="text-xs font-bold" style={{ color: "var(--verde)" }}>✓ Supervisión Interna</span>
                      <button
                        type="button"
                        onClick={() => handleSupervisionInterna(o.obraId, false)}
                        disabled={marcandoInterna === o.obraId}
                        className="text-[10px] font-bold shrink-0"
                        style={{ color: "var(--ink-faint)", opacity: marcandoInterna === o.obraId ? 0.5 : 1 }}
                      >
                        quitar
                      </button>
                    </div>
                  ) : o.supervisiones.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSupervisionInterna(o.obraId, true)}
                      disabled={marcandoInterna === o.obraId}
                      className="w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg"
                      style={{ border: "1px dashed var(--border)", color: "var(--ink-faint)", opacity: marcandoInterna === o.obraId ? 0.5 : 1 }}
                    >
                      {marcandoInterna === o.obraId ? "Marcando…" : "+ Marcar Supervisión Interna"}
                    </button>
                  )
                    : o.supervisiones.map((c) => (
                        <ContratoChip key={c.id} contrato={c} color="var(--naranja, #B5680A)" onDesvincular={() => handleDesvincular(o.obraId, c)} quitando={quitando === `${o.obraId}-${c.id}`} />
                      ))}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--azul, #1D4E89)" }}>
                    Servicios {o.servicios.length === 0 ? "— sin vincular" : `(${o.servicios.length})`}
                  </p>
                  {o.servicios.length === 0
                    ? <p className="text-xs" style={{ color: "var(--ink-faint)" }}>—</p>
                    : o.servicios.map((c) => (
                        <ContratoChip key={c.id} contrato={c} color="var(--azul, #1D4E89)" onDesvincular={() => handleDesvincular(o.obraId, c)} quitando={quitando === `${o.obraId}-${c.id}`} />
                      ))}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--rojo, #B3261E)" }}>
                    Adquisiciones {o.adquisiciones.length === 0 ? "— sin vincular" : `(${o.adquisiciones.length})`}
                  </p>
                  {o.adquisiciones.length === 0
                    ? <p className="text-xs" style={{ color: "var(--ink-faint)" }}>—</p>
                    : o.adquisiciones.map((c) => (
                        <ContratoChip key={c.id} contrato={c} color="var(--rojo, #B3261E)" onDesvincular={() => handleDesvincular(o.obraId, c)} quitando={quitando === `${o.obraId}-${c.id}`} />
                      ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContratosPS() {
  const { logout: logoutPrincipal } = useAuth();
  const navigate = useNavigate();
  const [user] = useState(getPsUser());
  const [vista, setVista] = useState("clasificar"); // "clasificar" | "vinculados"
  const [contratos, setContratos] = useState([]);
  const [pendientesReales, setPendientesReales] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  /* Paso 1 (clasificar) y Paso 2 (vincular) son dos acciones guardadas por
     separado en BD, cada una con su propia entrada de auditoría —
     `tipoSeleccionado` es solo la elección en pantalla del Paso 1 antes de
     guardar; el tipo ya persistido vive en `contratoActual.tipo_contrato`. */
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [editandoTipo, setEditandoTipo] = useState(false);
  const [busquedaObra, setBusquedaObra] = useState("");
  const [obras, setObras] = useState([]);
  const [obraIds, setObraIds] = useState([]);
  // Obras que el contrato YA tenía vinculadas antes de abrir esta pantalla
  // (multi-tipo reabierto para agregar más, ver obtenerObrasVinculadasDeContrato)
  // — se muestran marcadas y bloqueadas: quitar un vínculo existente se
  // sigue haciendo solo desde "Vinculaciones" (la "×"), nunca desmarcando
  // aquí, para no dar a entender que se quitó algo que en realidad el
  // botón "Confirmar" nunca hubiera desvinculado.
  const [obraIdsPreexistentes, setObraIdsPreexistentes] = useState([]);
  const [dirInterna, setDirInterna] = useState(null);
  const [obraDirConocida, setObraDirConocida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [programasColapsados, setProgramasColapsados] = useState(() => new Set());
  const [verTodosProgramas, setVerTodosProgramas] = useState(false);

  const cargarPendientes = useCallback(async () => {
    if (!getPsToken()) return;
    setCargando(true);
    try {
      const data = await listarPendientes();
      setContratos(data.contratos);
      setPendientesReales(data.pendientes ?? data.contratos.filter((c) => !c.tipo_contrato).length);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (user) cargarPendientes();
  }, [user, cargarPendientes]);

  // La búsqueda de obras solo aplica en Paso 2 (tipo ya guardado en BD y no
  // se está editando el tipo ahora mismo).
  useEffect(() => {
    const contrato = contratos.find((c) => c.id === seleccionado);
    const tipoGuardado = contrato?.tipo_contrato || null;
    if (!tipoGuardado || editandoTipo) {
      setObras([]);
      return;
    }
    const programaId = !verTodosProgramas ? contrato?.programa_id : null;
    buscarObras(busquedaObra, programaId).then((d) => setObras(d.obras)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `contratos` cambia en cada carga; solo importa `seleccionado`
  }, [seleccionado, editandoTipo, busquedaObra, verTodosProgramas, contratos]);

  const gruposPrograma = useMemo(() => agruparContratosPorPrograma(contratos), [contratos]);

  if (!user || user.rol !== "DIRECTOR_CONCURSOS_CONTRATOS") {
    return <SinAcceso />;
  }

  // Algunas DG (ej. DGPEST) no organizan su trabajo en direcciones internas
  // A/B/C/D como DGCOP — para esas no tiene caso pedir que se elija una al
  // vincular (ver authController.js). `!== false` para que sesiones ya
  // guardadas en localStorage de antes de este cambio (sin este campo en
  // el token) sigan pidiéndola igual que hasta ahora, no cambien de golpe.
  const usaDireccionInterna = user.usaDireccionInterna !== false;

  const contratoActual = contratos.find((c) => c.id === seleccionado);
  const tipoGuardado = contratoActual?.tipo_contrato || null;
  const mostrandoPaso1 = !!contratoActual && (!tipoGuardado || editandoTipo);
  const tipoEfectivo = mostrandoPaso1 ? tipoSeleccionado : tipoGuardado;
  const modo = tipoEfectivo ? TIPOS.find((t) => t.key === tipoEfectivo)?.modo : null;

  const toggleColapsoPrograma = (programa) => {
    setProgramasColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(programa)) next.delete(programa);
      else next.add(programa);
      return next;
    });
  };

  // Aviso no bloqueante: el programa del contrato seleccionado no coincide
  // con el de alguna de las obras marcadas — puede ser legítimo, pero se
  // avisa porque es justo el riesgo de captura cruzada que se quiere evitar.
  const obrasConProgramaDistinto = obras.filter(
    (o) => obraIds.includes(o.id) && contratoActual?.programa_id != null && o.programa_id != null && o.programa_id !== contratoActual.programa_id
  );

  const seleccionarContrato = (c) => {
    setSeleccionado(c.id);
    setTipoSeleccionado(null);
    setEditandoTipo(false);
    setObraIds([]);
    setObraIdsPreexistentes([]);
    setDirInterna(null);
    setObraDirConocida(null);
    setMensaje("");
    setVerTodosProgramas(false);
    // Multi-tipo (Obra/Supervisión/Servicios) reabierto con obras que ya
    // tenía — se precargan marcadas para poder agregarle más sin repetir
    // la búsqueda de las que ya estaban.
    if (c.tipo_contrato && c.obras_vinculadas > 0) {
      obtenerObrasVinculadasDeContrato(c.id)
        .then((d) => { setObraIds(d.obraIds); setObraIdsPreexistentes(d.obraIds); })
        .catch(() => {});
    }
  };

  const iniciarEdicionTipo = () => {
    setTipoSeleccionado(tipoGuardado);
    setEditandoTipo(true);
    setObraIds([]);
    setObraIdsPreexistentes([]);
    setDirInterna(null);
    setObraDirConocida(null);
  };

  const cancelarEdicionTipo = () => {
    setEditandoTipo(false);
    setTipoSeleccionado(null);
  };

  const toggleObra = (obra) => {
    if (obraIdsPreexistentes.includes(obra.id)) return; // ya vinculada — se quita solo desde "Vinculaciones"
    if (modo === "single") {
      const yaEsta = obraIds.includes(obra.id);
      setObraIds(yaEsta ? [] : [obra.id]);
      setObraDirConocida(yaEsta ? null : obra.direccion_interna);
      setDirInterna(null);
    } else {
      setObraIds((prev) => (prev.includes(obra.id) ? prev.filter((x) => x !== obra.id) : [...prev, obra.id]));
    }
  };

  // Paso 1 — guarda SOLO el tipo, de inmediato, sin pedir obra todavía.
  const guardarClasificacion = async () => {
    if (!tipoSeleccionado) return;
    setGuardando(true);
    setMensaje("");
    try {
      const resultado = await clasificarContrato(seleccionado, tipoSeleccionado);
      setMensaje(
        resultado.vinculoLimpiado
          ? "⚠ Tipo actualizado. El vínculo anterior se quitó — vincula de nuevo con el tipo correcto."
          : "✓ Tipo guardado. Ahora vincula la obra (Paso 2)."
      );
      setEditandoTipo(false);
      await cargarPendientes();
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const obraIdsNuevas = obraIds.filter((id) => !obraIdsPreexistentes.includes(id));
  const puedeConfirmarVinculo =
    !mostrandoPaso1 && tipoGuardado && obraIds.length > 0 &&
    // Reabierto con obras que ya tenía: solo tiene caso confirmar si se
    // marcó AL MENOS una nueva — si no, no hay nada que agregar.
    (obraIdsPreexistentes.length === 0 || obraIdsNuevas.length > 0) &&
    !(usaDireccionInterna && modo === "single" && !obraDirConocida && !dirInterna);

  // Paso 2 — vincula a obra(s); requiere que el tipo ya esté guardado.
  const confirmarVinculo = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      const resultado = await vincularContrato(seleccionado, { obraIds, direccionInterna: dirInterna });
      setMensaje(
        resultado.programaMismatch
          ? "✓ Contrato vinculado (con programa distinto al de la obra — quedó registrado)."
          : "✓ Contrato vinculado."
      );
      setSeleccionado(null);
      setObraIds([]);
      setObraIdsPreexistentes([]);
      await cargarPendientes();
    } catch (err) {
      setMensaje("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F8F5F2" }}>
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <h1 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>Clasificación y vinculación de contratos</h1>
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>La captura sigue en el módulo de Contratos — aquí solo se clasifica y se enlaza a la obra, en dos pasos que se guardan por separado</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>{user.nombre}</p>
            <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{user.rol === "DIRECTOR_CONCURSOS_CONTRATOS" ? "Director de Concursos y Contratos" : user.rol} · {user.dgClave}</p>
          </div>
          <button
            onClick={() => { logoutPrincipal(); navigate("/login", { replace: true }); }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
          >
            Salir
          </button>
        </div>
      </div>

      {mensaje && (
        <div
          className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: mensaje.startsWith("Error") ? "var(--rojo-soft, #FBEAE8)" : mensaje.startsWith("⚠") ? "var(--naranja-soft, #FBEEDC)" : "var(--verde-soft, #E3F1EC)",
            color: mensaje.startsWith("Error") ? "var(--rojo)" : mensaje.startsWith("⚠") ? "var(--naranja, #B5680A)" : "var(--verde)",
          }}
        >
          {mensaje}
        </div>
      )}

      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <button
          onClick={() => setVista("clasificar")}
          className="text-xs font-bold px-3.5 py-1.5 rounded-lg"
          style={{ background: vista === "clasificar" ? "var(--surface)" : "transparent", color: vista === "clasificar" ? "var(--guinda)" : "var(--ink-soft)" }}
        >
          Por clasificar
        </button>
        <button
          onClick={() => setVista("vinculados")}
          className="text-xs font-bold px-3.5 py-1.5 rounded-lg"
          style={{ background: vista === "vinculados" ? "var(--surface)" : "transparent", color: vista === "vinculados" ? "var(--guinda)" : "var(--ink-soft)" }}
        >
          Vinculaciones
        </button>
      </div>

      {vista === "vinculados" ? (
        <VistaVinculados />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 items-start">
        {/* lista */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <h2 className="text-sm font-bold" style={{ color: "var(--ink)" }}>Contratos de {user.dgClave}</h2>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {pendientesReales} pendientes{contratos.length > pendientesReales ? ` · ${contratos.length - pendientesReales} ya vinculados, listos para agregar más` : ""}
            </span>
          </div>
          {cargando ? (
            <p className="text-center text-sm py-10" style={{ color: "var(--ink-faint)" }}>Cargando…</p>
          ) : contratos.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "var(--ink-faint)" }}>No hay contratos pendientes de clasificar 🎉</p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {gruposPrograma.map((grupo) => {
                const colapsado = programasColapsados.has(grupo.programa);
                return (
                  <div key={grupo.programa}>
                    <button
                      type="button"
                      onClick={() => toggleColapsoPrograma(grupo.programa)}
                      className="w-full text-left px-4 py-2 flex items-center gap-2 sticky top-0 z-10"
                      style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border-soft)" }}
                    >
                      <svg
                        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: colapsado ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 150ms ease-out" }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      <p className="text-[11px] font-bold uppercase tracking-widest flex-1 truncate" style={{ color: "var(--ink-soft)" }}>
                        {grupo.programa}
                      </p>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--ink-faint)" }}>{grupo.items.length}</span>
                      <span className="text-xs font-bold w-28 text-right" style={{ color: "var(--ink)" }}>{money(grupo.total)}</span>
                    </button>
                    {!colapsado && grupo.items.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => seleccionarContrato(c)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3"
                        style={{
                          borderBottom: "1px solid var(--border-soft)",
                          background: seleccionado === c.id ? "var(--oro-soft, #E8DCC8)" : "transparent",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                            N.º <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{c.numero_contrato}</span> · {c.contratista}
                          </p>
                          <p className="text-sm font-semibold mt-0.5 line-clamp-2" style={{ color: "var(--ink)" }}>{c.objeto_contrato}</p>
                        </div>
                        {c.tipo_contrato ? (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={c.obras_vinculadas > 0
                              ? { background: "var(--verde-soft, #E3F1EC)", color: "var(--verde)" }
                              : { background: "var(--oro-soft, #E8DCC8)", color: "var(--oro-dark, #8C6B41)" }}
                          >
                            {labelTipo(c.tipo_contrato)} · {c.obras_vinculadas > 0 ? `${c.obras_vinculadas} obra(s) · agregar más` : "falta vincular"}
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "var(--surface-2)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}
                          >
                            Sin clasificar
                          </span>
                        )}
                        <p className="text-sm font-bold shrink-0 w-32 text-right" style={{ color: "var(--ink)" }}>{money(c.importe_total)}</p>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* detalle */}
        <div className="rounded-2xl p-4 sticky top-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          {!contratoActual ? (
            <p className="text-center text-sm py-14" style={{ color: "var(--ink-faint)" }}>
              Selecciona un contrato de la lista<br />para clasificarlo y enlazarlo.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{contratoActual.objeto_contrato}</p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  {contratoActual.numero_contrato} · {contratoActual.contratista} · {money(contratoActual.importe_total)}
                </p>
                <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--oro-dark, #8C6B41)" }}>
                  Programa: {contratoActual.programa || "Sin programa"}
                </p>
              </div>

              {mostrandoPaso1 ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>
                    Paso 1 · Tipo de contrato · sugerido: {contratoActual.sugerido}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTipoSeleccionado(t.key)}
                        className="text-left p-2.5 rounded-lg"
                        style={{
                          border: tipoSeleccionado === t.key ? "1.5px solid var(--guinda)" : "1.5px solid var(--border)",
                          background: tipoSeleccionado === t.key ? "var(--oro-soft, #E8DCC8)" : "var(--surface)",
                        }}
                      >
                        <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>{t.label}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{t.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {editandoTipo && (
                      <button
                        type="button"
                        onClick={cancelarEdicionTipo}
                        className="text-xs font-bold px-3 py-2 rounded-lg"
                        style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                      >
                        Cancelar
                      </button>
                    )}
                    <Button onClick={guardarClasificacion} disabled={!tipoSeleccionado || guardando} className="flex-1">
                      {guardando ? "Guardando…" : "Guardar clasificación"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--verde, #006341)" }}>
                      ✓ Paso 1 hecho · Tipo: {labelTipo(tipoGuardado)}
                    </p>
                    <button
                      type="button"
                      onClick={iniciarEdicionTipo}
                      className="text-[10px] font-bold shrink-0"
                      style={{ color: "var(--guinda)" }}
                    >
                      Cambiar tipo
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-2 mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                      Paso 2 · Vincular a obra {modo === "multi" ? "(una o varias)" : ""}
                      {obraIdsPreexistentes.length > 0 ? ` · ya tiene ${obraIdsPreexistentes.length}` : ""}
                    </p>
                    {contratoActual.programa_id != null && (
                      <button
                        type="button"
                        onClick={() => setVerTodosProgramas((v) => !v)}
                        className="text-[10px] font-bold shrink-0"
                        style={{ color: "var(--guinda)" }}
                      >
                        {verTodosProgramas ? "Ver solo el mismo programa" : "Ver obras de otros programas"}
                      </button>
                    )}
                  </div>
                  {contratoActual.programa_id != null && !verTodosProgramas && (
                    <p className="text-[11px] mb-2" style={{ color: "var(--ink-faint)" }}>
                      Mostrando solo obras del programa "{contratoActual.programa}".
                    </p>
                  )}
                  <input
                    value={busquedaObra}
                    onChange={(e) => setBusquedaObra(e.target.value)}
                    placeholder="Buscar obra por nombre o clave…"
                    className="w-full px-3 py-2 text-xs rounded-lg mb-2"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg mb-2" style={{ border: "1px solid var(--border-soft)" }}>
                    {obras.map((o) => {
                      const distinto = contratoActual?.programa_id != null && o.programa_id != null && o.programa_id !== contratoActual.programa_id;
                      const yaVinculada = obraIdsPreexistentes.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 px-2.5 py-2 text-xs"
                          style={{ borderBottom: "1px solid var(--border-soft)", background: obraIds.includes(o.id) ? "var(--oro-soft, #E8DCC8)" : "transparent", cursor: yaVinculada ? "default" : "pointer", opacity: yaVinculada ? 0.7 : 1 }}
                        >
                          <input type="checkbox" checked={obraIds.includes(o.id)} disabled={yaVinculada} onChange={() => toggleObra(o)} style={{ accentColor: "var(--guinda)" }} />
                          <span className="font-semibold flex-1 min-w-0 truncate">{o.nombre_obra}</span>
                          {yaVinculada && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--verde-soft, #E3F1EC)", color: "var(--verde)" }}>
                              ya vinculada
                            </span>
                          )}
                          {!yaVinculada && distinto && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--naranja-soft, #FBEEDC)", color: "var(--naranja, #B5680A)" }}>
                              {o.programa || "sin programa"}
                            </span>
                          )}
                        </label>
                      );
                    })}
                    {obras.length === 0 && (
                      <p className="text-center text-[11px] py-4" style={{ color: "var(--ink-faint)" }}>
                        Sin resultados{contratoActual.programa_id != null && !verTodosProgramas ? " en este programa — prueba \"Ver obras de otros programas\"." : "."}
                      </p>
                    )}
                  </div>

                  {usaDireccionInterna && modo === "single" && obraIds.length === 1 && (
                    obraDirConocida ? (
                      <div className="text-xs font-semibold px-3 py-2 rounded-lg mb-2" style={{ background: "var(--verde-soft, #E3F1EC)", color: "var(--verde)" }}>
                        ✓ Esta obra ya pertenece a la Dirección interna {obraDirConocida}.
                      </div>
                    ) : (
                      <div className="rounded-lg p-3 mb-2" style={{ background: "var(--naranja-soft, #FBEEDC)", border: "1px solid var(--naranja, #B5680A)" }}>
                        <p className="text-[11px] font-bold mb-2" style={{ color: "var(--naranja, #B5680A)" }}>
                          Esta obra aún no tiene Dirección interna — elige una
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {DIRECCIONES.map((d) => (
                            <button
                              key={d}
                              onClick={() => setDirInterna(d)}
                              className="py-1.5 rounded-md text-sm font-bold"
                              style={{
                                border: "1px solid var(--border)",
                                background: dirInterna === d ? "var(--guinda)" : "var(--surface)",
                                color: dirInterna === d ? "#fff" : "var(--ink-soft)",
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  )}

                  {obrasConProgramaDistinto.length > 0 && (
                    <div className="rounded-lg p-3 mb-2" style={{ background: "var(--naranja-soft, #FBEEDC)", border: "1px solid var(--naranja, #B5680A)" }}>
                      <p className="text-[11px] font-bold" style={{ color: "var(--naranja, #B5680A)" }}>
                        ⚠ El programa de este contrato ("{contratoActual.programa || "Sin programa"}") no coincide con
                        {obrasConProgramaDistinto.length === 1 ? " el de la obra elegida" : " el de una o más obras elegidas"}
                        {" "}("{obrasConProgramaDistinto.map((o) => o.programa || "sin programa").join(", ")}"). Puedes continuar si es correcto, pero revisa antes de confirmar.
                      </p>
                    </div>
                  )}

                  <Button onClick={confirmarVinculo} disabled={!puedeConfirmarVinculo || guardando} className="w-full">
                    {guardando
                      ? "Guardando…"
                      : obraIdsPreexistentes.length > 0
                        ? `Agregar ${obraIdsNuevas.length || ""} obra(s) más`
                        : "Confirmar vínculo"}
                  </Button>
                </div>
              )}
            </div>
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
