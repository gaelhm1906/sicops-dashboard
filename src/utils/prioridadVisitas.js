/**
 * utils/prioridadVisitas.js
 * Ajuste de minuta (sesión de revisión #1): el Secretario puede marcar
 * obras como prioritarias — esas visitas siguen contando dentro de la
 * cuota obligatoria del rol, solo se destacan para señalar qué obras
 * quiere revisar personalmente. Un solo listado global de claves de
 * obra, namespaced junto al resto de utils de seguimiento.
 */
const KEY = "obras_prioritarias_visita";

export function getObrasPrioritarias() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function esObraPrioritaria(obraKey) {
  return getObrasPrioritarias().includes(obraKey);
}

export function toggleObraPrioritaria(obraKey) {
  const actuales = getObrasPrioritarias();
  const next = actuales.includes(obraKey)
    ? actuales.filter((k) => k !== obraKey)
    : [...actuales, obraKey];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // no bloquea la UI si falla la persistencia local
  }
  return next;
}
