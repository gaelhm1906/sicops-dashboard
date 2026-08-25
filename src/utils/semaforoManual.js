/**
 * utils/semaforoManual.js
 * Ajuste de reunión con el Secretario (12 de agosto, sesión DGCOP):
 * complemento a la semaforización automática (días sin actualización).
 * El propio equipo de desarrollo expuso el límite de la automática — "el
 * sistema puede marcar rojo porque faltan 2 de 10 datos, cuando esos dos
 * datos pueden ser irrelevantes" — así que el Secretario pidió que, al
 * cargar su información, cada funcionario pueda asignar TAMBIÉN su
 * propio semáforo por actividad (criterio humano, no una regla dura).
 *
 * Deliberadamente opcional — no bloquea el guardado si no se elige
 * ninguno — porque es un criterio cualitativo adicional, no un requisito
 * nuevo de captura. Se guarda como un campo más del registro
 * (`utils/seguimiento.js` ya persiste cualquier campo sin necesitar
 * cambios ahí).
 */
export const SEMAFORO_MANUAL = {
  VERDE: "verde",
  AMARILLO: "amarillo",
  ROJO: "rojo",
};

export const SEMAFORO_MANUAL_INFO = {
  [SEMAFORO_MANUAL.VERDE]: { label: "Va bien", color: "var(--verde)", bg: "rgba(0,99,65,0.10)" },
  [SEMAFORO_MANUAL.AMARILLO]: { label: "Con riesgo", color: "var(--naranja)", bg: "rgba(217,119,6,0.10)" },
  [SEMAFORO_MANUAL.ROJO]: { label: "Detenido", color: "var(--rojo)", bg: "rgba(220,38,38,0.10)" },
};
