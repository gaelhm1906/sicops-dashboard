import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { obrasAPI, pgObrasAPI } from "../utils/api";
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

  /* Cargar obras: intenta PostgreSQL primero, cae a JSON local si falla */
  const loadObras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pgObrasAPI.getAll({ limite: 10000 });
      setObras(res.data || []);
      setFuente("postgresql");
    } catch (pgErr) {
      // Loggear motivo de falla PG antes de activar fallback
      if (pgErr.code === "TOKEN_MISSING" || pgErr.status === 401) {
        console.warn("[SICOPS] Token inválido o no presente — activando fallback local");
      } else {
        console.warn("[SICOPS] PostgreSQL no disponible, usando datos locales:", pgErr.message);
      }

      // Fallback a la API JSON local
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
  }, []);

  /* Cargar al montar */
  useEffect(() => { loadObras(); }, [loadObras]);

  /* Actualizar una obra en el estado local (tras confirmar cambio en el modal) */
  const updateObraLocal = useCallback((updatedObra) => {
    if (!updatedObra?.id) return;
    setObras((prev) =>
      prev.map((o) => (o.id === updatedObra.id ? { ...o, ...updatedObra } : o))
    );
  }, []);

  /* Recargar lista completa desde el backend */
  const refreshObras = useCallback(() => loadObras(), [loadObras]);

  /* Filtrado + ordenamiento memoizados */
  const obrasFiltradas = useMemo(() => {
    let lista = [...obras];
    const dgUsuario = user?.dg ? String(user.dg).toUpperCase() : null;

    if (user?.rol === "ADMIN") {
      // ADMIN ve todas las obras sin filtro
    } else if (dgUsuario) {
      lista = lista.filter((o) => String(o.direccion_general || "").toUpperCase() === dgUsuario);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((o) => o.nombre?.toLowerCase().includes(q));
    }
    if (filtroProg) lista = lista.filter((o) => o.programa === filtroProg);
    if (filtroEst)  lista = lista.filter((o) => o.estado   === filtroEst);

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
  }, [obras, busqueda, filtroProg, filtroEst, orden, user]);

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
    const total        = obrasFiltradas.length;
    const actualizadas = obrasFiltradas.filter((o) => o.estado === "actualizada").length;
    const pendientes   = obrasFiltradas.filter((o) => o.estado === "pendiente").length;
    const enProgreso   = obrasFiltradas.filter((o) => o.estado === "en_progreso").length;
    const pct          = total > 0 ? Math.round((actualizadas / total) * 100) : 0;
    return { total, actualizadas, pendientes, enProgreso, pct };
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
