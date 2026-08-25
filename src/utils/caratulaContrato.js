/**
 * utils/caratulaContrato.js
 * Resolver de compatibilidad OBRA → CONTRATO. Ajuste de flujo: la
 * carátula ya no se captura "pegada" a una obra — vive en el registro
 * independiente de contratos (utils/contratos.js, "paso 1") y se
 * VINCULA a la obra por separado ("paso 2"). Este archivo existe para
 * que todo lo que ya lee `getCaratulaContrato(obraKey)` (avance físico,
 * avance financiero, el informe de Supervisión Externa) siga
 * funcionando sin cambios: resuelve la obra a su contrato vinculado y
 * regresa esos datos, en modo solo lectura.
 *
 * Para EDITAR un contrato, usar utils/contratos.js directamente desde
 * la página de Contratos (Director de Concursos y Contratos) — no
 * desde aquí.
 */
import {
  CONTRATO_VACIO, getContrato, getContratosDeObra, getContratoSupervision, agregarObservacionContrato,
  guardarContrato, vincularObraContrato, vincularContratoSupervision,
  TIPO_CONTRATO_OBRA, TIPO_CONTRATO_SUPERVISION,
} from "./contratos";
import { esSesionReal } from "./seguimiento";
import { obtenerVinculados } from "../api/psContratosApi";

export const CARATULA_VACIA = CONTRATO_VACIO;

/** Contrato vinculado a esta obra (el primero, si hay más de uno — ver getContratosDeObra). */
export function getContratoIdDeObra(obraKey) {
  return getContratosDeObra(obraKey)[0] || null;
}

export function getCaratulaContrato(obraKey) {
  const contratoId = getContratoIdDeObra(obraKey);
  if (!contratoId) return { ...CONTRATO_VACIO };
  return getContrato(contratoId) || { ...CONTRATO_VACIO };
}

/* Ajuste de fondo (área técnica, 11 de agosto): la supervisión externa
   NO es una vista distinta del mismo contrato — es OTRO contrato,
   independiente, vinculado al de obra. Este resolver entrega esa
   carátula por separado; si aún no se vinculó ninguna, regresa la
   carátula vacía (el llamador decide cómo mostrarlo — "sin vincular",
   no un error). */
export function getCaratulaSupervisionDeObra(obraKey) {
  const contratoObraId = getContratoIdDeObra(obraKey);
  if (!contratoObraId) return { ...CONTRATO_VACIO };
  return getContratoSupervision(contratoObraId) || { ...CONTRATO_VACIO };
}

/** Observación/corrección de Supervisión Externa — se guarda en el contrato vinculado. */
export function agregarObservacionCaratula(obraKey, texto, autor) {
  const contratoId = getContratoIdDeObra(obraKey);
  if (!contratoId) return { ...CONTRATO_VACIO };
  return agregarObservacionContrato(contratoId, texto, autor) || { ...CONTRATO_VACIO };
}

/* Id local determinista para el contrato real del servidor — así
   hidratar dos veces el mismo contrato actualiza el mismo registro en
   vez de duplicarlo (guardarContrato sobreescribe por id). */
function idLocalDeContratoServidor(contratoIdServidor) {
  return `srv-${contratoIdServidor}`;
}

/** Inversa de idLocalDeContratoServidor — recupera el id numérico real del
 *  contrato en ps_sicops_final a partir del id local (`srv-<id>`) que usan
 *  utils/contratos.js y sus consumidores (CapturaAvanceFisico/Financiero).
 *  `null` si el id local no vino de una hidratación real (contrato
 *  capturado a mano en el modelo viejo, o sesión demo) — quien llama debe
 *  tratarlo como "sin contrato real conocido", no como error. */
export function contratoIdRealDesdeLocal(idLocal) {
  if (typeof idLocal !== "string" || !idLocal.startsWith("srv-")) return null;
  const n = Number(idLocal.slice(4));
  return Number.isFinite(n) ? n : null;
}

function aFormatoLocal(c, tipoContrato) {
  const fecha = (v) => (v ? String(v).slice(0, 10) : "");
  return {
    tipo_contrato: tipoContrato,
    numero_contrato: c.numeroContrato || "",
    procedimiento: c.procedimiento || "",
    numero_concurso: c.numeroConcurso || "",
    fecha_contrato: fecha(c.fechaContrato),
    contratista: c.contratista || "",
    representante_legal: c.representanteLegal || "",
    rfc: c.rfc || "",
    domicilio_fiscal: c.domicilioFiscal || "",
    objeto_contrato: c.objetoContrato || "",
    importe_sin_iva: c.importeSinIva ?? "",
    iva: c.iva ?? "",
    importe_total: c.importeTotal ?? "",
    anticipo: c.anticipo ?? "",
    tipo_ejercicio: c.tipoEjercicio || "Anual",
    oficio_autorizacion: c.oficioAutorizacion || "",
    numero_acuerdo: c.numeroAcuerdo || "",
    clave_programatica_presupuestal: c.claveProgramaticaPresupuestal || "",
    fondo_aportacion: c.fondoAportacion || "",
    fecha_inicio: fecha(c.fechaInicio),
    fecha_termino: fecha(c.fechaTermino),
    plazo_ejecucion: c.plazoEjecucion || "",
    // CapturaAvanceFisico/Financiero validan `dias_naturales`, no
    // `plazo_ejecucion` — son el mismo dato en el contrato real.
    dias_naturales: c.plazoEjecucion || "",
  };
}

/* Trae la carátula real (obra + supervisión, si ya está vinculada) desde
   ps_sicops_final y la escribe en el mismo localStorage que ya lee
   getCaratulaContrato/getCaratulaSupervisionDeObra — así
   CapturaAvanceFisico, CapturaAvanceFinanciero y el Informe de
   Supervisión Externa dejan de pedir una carátula capturada a mano: la
   real ya existe, migrada, del lado de Contratos. No hace nada si la
   sesión no es PS real o si la obra no tiene `id` numérico (no migrada
   todavía a ps_sicops_final). Idempotente — se puede llamar cada vez que
   se abre la Bandeja sin duplicar registros. */
export async function hidratarCaratulaDesdeServidor(obraKey, obraId) {
  if (!esSesionReal() || !obraId) return;
  try {
    const { obras } = await obtenerVinculados();
    const familia = obras?.find((o) => o.obraId === obraId);
    if (!familia) return; // esta obra no tiene ningún vínculo todavía

    // `contratoObra` puede venir null (obra que solo tiene supervisión/
    // servicios/adquisiciones, sin contrato de obra propio todavía — ver
    // obrasController.js#contratosVinculados) — antes esto cortaba la
    // función completa aquí, así que una obra en ese estado se quedaba SIN
    // hidratar ni siquiera su supervisión. Bug real encontrado 2026-08-21
    // al construir "Frentes de trabajo supervisados".
    let idObraLocal = null;
    if (familia.contratoObra) {
      idObraLocal = idLocalDeContratoServidor(familia.contratoObra.id);
      guardarContrato(idObraLocal, { ...CONTRATO_VACIO, ...aFormatoLocal(familia.contratoObra, TIPO_CONTRATO_OBRA) }, "sistema:sync");
      vincularObraContrato(idObraLocal, obraKey);
    }

    // El resolver de compatibilidad (getCaratulaSupervisionDeObra) solo
    // soporta una supervisión por obra — si hay varias, se hidrata la
    // primera; las demás ya son visibles en la pestaña "Vinculaciones".
    if (familia.supervisiones?.length) {
      const contratoSupervision = familia.supervisiones[0];
      const idSupLocal = idLocalDeContratoServidor(contratoSupervision.id);
      // "Frentes de trabajo supervisados" (pedido real del área, 2026-08-21):
      // todas las obras — de TODA la respuesta, no solo la actual — que
      // comparten este mismo contrato de supervisión. `obras` ya viene
      // scopeada al alcance real del usuario (para Supervisión Externa,
      // solo las suyas), así que recorrer la respuesta completa es seguro.
      const frentesSupervisados = (obras || [])
        .filter((o) => o.supervisiones?.some((s) => s.id === contratoSupervision.id))
        .map((o) => ({ obraId: o.obraId, nombreObra: o.nombreObra }));
      guardarContrato(
        idSupLocal,
        { ...CONTRATO_VACIO, ...aFormatoLocal(contratoSupervision, TIPO_CONTRATO_SUPERVISION), frentes_supervisados: frentesSupervisados },
        "sistema:sync"
      );
      // Límite conocido: si esta obra NO tiene contrato de obra propio
      // (idObraLocal null), getCaratulaSupervisionDeObra(obraKey) no podrá
      // resolver esta supervisión — esa cadena de compatibilidad viaja
      // obra→contrato de obra→contrato de supervisión, no tiene un enlace
      // directo obra→supervisión sin pasar por el de obra. El registro
      // local de la supervisión (con frentes_supervisados ya completo)
      // igual queda guardado arriba, solo falta el enlace para este caso.
      // No se ha visto en datos reales (las obras de Supervisión Externa
      // hasta ahora siempre tienen también su propio contrato de obra),
      // pero si aparece, aquí es donde arreglarlo.
      if (idObraLocal) vincularContratoSupervision(idObraLocal, idSupLocal, "sistema:sync");
    }
  } catch {
    // sin conexión o error del servidor: se queda con lo que ya hubiera
    // en cache local, no bloquea la pantalla por esto
  }
}
