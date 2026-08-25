import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { obrasAPI, obrasNuevoAPI } from "../utils/api";
import { useAuth } from "./AuthContext";
import { listarTodasMisObras } from "../api/psContratosApi";

const ObraContext = createContext(null);

/* Alcance operativo vigente: solo obras activas (en ejecución o por
   iniciar) del ejercicio 2026 — terminadas/inauguradas/canceladas y las
   de ejercicios anteriores dejan de ser "el relajo" del día a día y ya
   no se muestran aquí. */
const ESTATUS_ACTIVOS = new Set(["EN PROCESO", "SIN INICIAR"]);
const ANIO_VIGENTE = "2026";
function soloActivas(lista) {
  const activas = lista.filter((o) => ESTATUS_ACTIVOS.has(String(o.estatus || o.estado || "").toUpperCase().trim()));

  // Si la fuente de datos actual no trae `anio` en ninguna obra (p. ej. el
  // backend real conectado aún no expone esa columna), no se puede aplicar
  // el corte por ejercicio — mejor mostrar todas las activas que vaciar
  // la app en silencio. Con `anio` presente, si acota a 2026.
  const conAnio = activas.filter((o) => String(o.anio || "").trim() !== "");
  if (conAnio.length === 0) return activas;

  return activas.filter((o) => String(o.anio || "").trim() === ANIO_VIGENTE);
}

export function ObraProvider({ children }) {
  const { user } = useAuth();
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [fuente,  setFuente]  = useState(null); // 'postgresql' | 'local'

  const [busqueda,   setBusqueda]   = useState("");
  const [filtroProg, setFiltroProg] = useState("");
  const [filtroEst,  setFiltroEst]  = useState("");
  const [pagina,     setPagina]     = useState(1);
  const [orden,      setOrden]      = useState({ campo: "nombre", dir: "asc" });

  const POR_PAGINA = 10;

  /* Cargar obras desde obras_centralizadas, filtradas por DG si aplica */
  const loadObras = useCallback(async () => {
    setLoading(true);
    setError(null);

    /* Cuentas de PS_SICOPS_FINAL: universo real de su propia DG, desde el
       backend nuevo — no pasa por obrasNuevoAPI/obrasAPI (sistema viejo)
       ni por el filtro `soloActivas` (pensado para el ciclo "en ejecución"
       del modelo anterior; aquí el trabajo pendiente de Concursos y
       Contratos no depende del estatus físico de la obra). */
    if (user?.sistema === "ps_sicops_final") {
      try {
        const res = await listarTodasMisObras();
        setObras(res.obras || []);
        setFuente("ps_sicops_final");
      } catch (err) {
        setError(err.message || "Error al cargar las obras");
      } finally {
        setLoading(false);
      }
      return;
    }

    const dg = user?.rol === "ADMIN" ? null : (user?.dg || null);
    try {
      const res = await obrasNuevoAPI.getAll(dg);
      setObras(soloActivas(res.data || []));
      setFuente("postgresql");
    } catch (pgErr) {
      if (pgErr.code === "TOKEN_MISSING" || pgErr.status === 401) {
        console.warn("[SICOPS] Token inválido — activando fallback local");
      } else {
        console.warn("[SICOPS] PostgreSQL no disponible, usando datos locales:", pgErr.message);
      }
      try {
        const res = await obrasAPI.getAll({ limite: 100 });
        setObras(soloActivas(res.data || []));
        setFuente("local");
      } catch (err) {
        setError(err.message || "Error al cargar las obras");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.dg, user?.rol, user?.sistema]);

  /* Cargar al montar */
  useEffect(() => { loadObras(); }, [loadObras]);

  /* Actualizar una obra en el estado local (tras confirmar cambio en el modal) */
  const updateObraLocal = useCallback((updatedObra) => {
    if (!updatedObra) return;
    setObras((prev) =>
      prev.map((o) => {
        // Matching preciso por uid (tabla::id) para evitar colisiones entre tablas
        if (updatedObra.uid && o.uid) return o.uid === updatedObra.uid ? { ...o, ...updatedObra } : o;
        if (updatedObra.id)           return o.id  === updatedObra.id  ? { ...o, ...updatedObra } : o;
        return o;
      })
    );
  }, []);

  /* Compatibilidad: canceladas ya no se ocultan; permanecen visibles con estado real */
  const filterCanceladas = useCallback(() => {
    setObras((prev) => prev);
  }, []);

  /* Recargar lista completa desde el backend */
  const refreshObras = useCallback(() => loadObras(), [loadObras]);

  /* Filtrado + ordenamiento memoizados */
  const obrasFiltradas = useMemo(() => {
    let lista = [...obras];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((o) =>
        o.nombre_obra?.toLowerCase().includes(q) ||
        o.nombre?.toLowerCase().includes(q) ||
        o.clave_unica?.toLowerCase().includes(q) ||
        o.programa?.toLowerCase().includes(q) ||
        o.dg?.toLowerCase().includes(q) ||
        o.alcaldia?.toLowerCase().includes(q) ||
        o.colonia?.toLowerCase().includes(q) ||
        o.calle_domicilio?.toLowerCase().includes(q)
      );
    }
    if (filtroProg) lista = lista.filter((o) => o.programa === filtroProg);
    if (filtroEst)  lista = lista.filter((o) => (o.estatus || "") === filtroEst);

    lista.sort((a, b) => {
      let va = a[orden.campo];
      let vb = b[orden.campo];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return orden.dir === "asc" ? -1 : 1;
      if (va > vb) return orden.dir === "asc" ? 1  : -1;
      return 0;
    });

    return lista;
  }, [obras, busqueda, filtroProg, filtroEst, orden]);

  /* Paginación */
  const totalPaginas   = Math.max(1, Math.ceil(obrasFiltradas.length / POR_PAGINA));
  const obrasPaginadas = useMemo(
    () => obrasFiltradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [obrasFiltradas, pagina]
  );

  /* Resetear página al cambiar filtros */
  useEffect(() => { setPagina(1); }, [busqueda, filtroProg, filtroEst]);

  /* Togglear orden de columna */
  const toggleOrden = useCallback((campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { campo, dir: "asc" }
    );
  }, []);

  /* Estadísticas — basadas en ESTATUS explícito, calculadas sobre obras brutas */
  const stats = useMemo(() => {
    const total = obras.length;
    const av  = (o) => Number(o.avance_real ?? o.avance ?? o.porcentaje ?? 0);
    const est = (o) => String(o.estatus || "").toUpperCase().trim();
    const esCancelada = (o) => est(o).includes("CANCELAD");

    const canceladas   = obras.filter(esCancelada).length;
    const noCanceladas = obras.filter((o) => !esCancelada(o));

    const inauguradas = noCanceladas.filter((o) =>
      est(o).includes("INAUGURAD") || est(o).includes("ENTREGAD")
    ).length;
    const terminadas = noCanceladas.filter((o) =>
      est(o) === "TERMINADO" || est(o) === "TERMINADA"
    ).length;
    const enProceso  = noCanceladas.filter((o) => est(o) === "EN PROCESO").length;
    const sinIniciarBase = noCanceladas.filter((o) =>
      est(o) === "SIN INICIAR" || est(o) === ""
    ).length;
    const sinIniciar = sinIniciarBase + canceladas;

    const actualizadas = noCanceladas.filter((o) => av(o) > 0).length;
    const pendientes   = sinIniciar;
    const enProgreso   = enProceso;

    const sumAvance = noCanceladas.reduce((acc, o) => acc + av(o), 0);
    const pct = noCanceladas.length > 0 ? Math.round(sumAvance / noCanceladas.length) : 0;

    return { total, inauguradas, terminadas, enProceso, enProgreso, sinIniciar, actualizadas, pendientes, canceladas, pct };
  }, [obras]);

  return (
    <ObraContext.Provider
      value={{
        obras: obrasFiltradas,
        obrasFiltradas,
        obrasRaw: obras,
        obrasPaginadas,
        loading,
        error,
        busqueda,     setBusqueda,
        filtroProg,   setFiltroProg,
        filtroEst,    setFiltroEst,
        pagina,       setPagina,
        totalPaginas,
        orden,        toggleOrden,
        updateObraLocal,
        filterCanceladas,
        refreshObras,
        stats,
        fuente,
        POR_PAGINA,
      }}
    >
      {children}
    </ObraContext.Provider>
  );
}

export function useObras() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObras debe usarse dentro de ObraProvider");
  return ctx;
}
