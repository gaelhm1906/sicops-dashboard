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

const ObraContext = createContext(null);

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
    const dg = user?.rol === "ADMIN" ? null : (user?.dg || null);
    try {
      const res = await obrasNuevoAPI.getAll(dg);
      setObras(res.data || []);
      setFuente("postgresql");
    } catch (pgErr) {
      if (pgErr.code === "TOKEN_MISSING" || pgErr.status === 401) {
        console.warn("[SICOPS] Token inválido — activando fallback local");
      } else {
        console.warn("[SICOPS] PostgreSQL no disponible, usando datos locales:", pgErr.message);
      }
      try {
        const res = await obrasAPI.getAll({ limite: 100 });
        setObras(res.data || []);
        setFuente("local");
      } catch (err) {
        setError(err.message || "Error al cargar las obras");
      }
    } finally {
      setLoading(false);
    }
  }, [user?.dg, user?.rol]);

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

  /* Ocultar obras canceladas del listado local (solo frontend, no elimina de BD) */
  const filterCanceladas = useCallback(() => {
    setObras((prev) =>
      prev.filter((o) => {
        const est = String(o.estatus || o.estado || "").toUpperCase();
        return est !== "CANCELADA" && est !== "CANCELADO";
      })
    );
  }, []);

  /* Recargar lista completa desde el backend */
  const refreshObras = useCallback(() => loadObras(), [loadObras]);

  /* Filtrado + ordenamiento memoizados */
  const obrasFiltradas = useMemo(() => {
    let lista = [...obras];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((o) => o.nombre?.toLowerCase().includes(q));
    }
    if (filtroProg) lista = lista.filter((o) => o.programa === filtroProg);
    // Filtra por estatus (soporta nombres nuevos y legacy)
    if (filtroEst)  lista = lista.filter((o) =>
      (o.estatus || o.estado || "") === filtroEst
    );

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

  /* Estadísticas */
  const stats = useMemo(() => {
    const total      = obrasFiltradas.length;
    const est        = (o) => String(o.estatus || o.estado || "").toUpperCase();
    const terminadas = obrasFiltradas.filter((o) =>
      est(o) === "TERMINADO" || est(o) === "ENTREGADO" || est(o) === "ACTUALIZADA"
    ).length;
    const pendientes = obrasFiltradas.filter((o) =>
      est(o) === "SIN INICIAR" || est(o) === "PENDIENTE"
    ).length;
    const enProgreso = obrasFiltradas.filter((o) =>
      est(o) === "EN PROCESO" || est(o) === "EN_PROGRESO"
    ).length;
    const pct = total > 0 ? Math.round((terminadas / total) * 100) : 0;
    return { total, actualizadas: terminadas, pendientes, enProgreso, pct };
  }, [obrasFiltradas]);

  return (
    <ObraContext.Provider
      value={{
        obras: obrasFiltradas,
        obrasFiltradas,
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
