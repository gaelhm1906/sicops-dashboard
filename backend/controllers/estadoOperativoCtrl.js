/**
 * controllers/estadoOperativoCtrl.js
 * Centro de Estado Operativo — diagnóstico consolidado del ecosistema.
 *
 * GET /api/admin/estado-operativo
 *   · Sistema (abierto/cerrado, semana activa)
 *   · Módulos (estado, última actividad, usuario, totales)
 *   · Integridad de datos (5 validaciones automáticas)
 */

const { query, SCHEMA } = require("../config/pg");

/* ── Helper: consulta segura que devuelve null si falla ── */
async function safeQuery(sql, params = []) {
  try {
    const r = await query(sql, params);
    return r.rows;
  } catch (err) {
    console.error("[safeQuery]", err.message, "|", sql.trim().substring(0, 80));
    return null;
  }
}

/* ── Normaliza fecha a string legible ── */
function fmtFecha(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Determina estado del módulo según habilitado + sistema ── */
function calcEstado(habilitado, sistemaActivo, requiereSistema = false) {
  if (habilitado === false)                   return "CERRADO";
  if (requiereSistema && !sistemaActivo)      return "CERRADO";
  if (habilitado === null || habilitado === undefined) return "DISPONIBLE";
  return "DISPONIBLE";
}

/* ════════════════════════════════════════════════
   GET /api/admin/estado-operativo
════════════════════════════════════════════════ */
exports.getEstadoOperativo = async (req, res) => {
  try {
    /* ── Consultas en paralelo para minimizar latencia ── */
    const [
      sistemaRows,
      semanaRows,
      modulosRows,

      /* Actualización de Obras */
      obrasUltimaRows,
      obrasTotalRows,

      /* Alcances */
      alcancesModuloRows,
      alcancesUltimaRows,
      alcancesTotalRows,

      /* Información General */
      infoGeneralUltimaRows,
      infoGeneralTotalRows,
      infoGeneralCatalogoRows,

      /* Cobertura */
      coberturaTotalRows,
      coberturaConRows,

      /* UTOPÍAS */
      utopiasModuloRows,
      utopiasUltimaRows,
      utopiasTotalRows,

      /* Geoestadística */
      geoUltimaRows,
      geoTotalRows,
      geoAuditoriaRows,

      /* Integridad — claves nulas */
      integClavesNulasRows,
      /* Integridad — claves duplicadas */
      integDuplicadasRows,
      /* Integridad — geometrías */
      integGeomRows,
      /* Integridad — programas vacíos */
      integProgramasRows,
      /* Integridad — seguimientos vacíos */
      integSeguimientosRows,
    ] = await Promise.all([

      /* sistema_estado */
      safeQuery(`SELECT activo FROM "${SCHEMA}".sistema_estado ORDER BY id LIMIT 1`),

      /* semana_control */
      safeQuery(`SELECT semana, anio FROM "${SCHEMA}".semana_control ORDER BY id DESC LIMIT 1`),

      /* modulos_control */
      safeQuery(`SELECT modulo, habilitado FROM "${SCHEMA}".modulos_control`),

      /* Obras — última actualización */
      safeQuery(`
        SELECT MAX(t) AS ultima, MAX(u) AS usuario FROM (
          SELECT MAX("FECHA ACTUALIZACION") AS t, MAX("USUARIO ACTUALIZACION") AS u FROM "${SCHEMA}".obras_puntos
          UNION ALL
          SELECT MAX("FECHA ACTUALIZACION"), MAX("USUARIO ACTUALIZACION") FROM "${SCHEMA}".obras_lineas
          UNION ALL
          SELECT MAX("FECHA ACTUALIZACION"), MAX("USUARIO ACTUALIZACION") FROM "${SCHEMA}".obras_poligonos
        ) sub
      `),

      /* Obras — total activas */
      safeQuery(`
        SELECT (
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos    WHERE COALESCE(estatus_registro,'ACTIVO')='ACTIVO') +
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas    WHERE COALESCE(estatus_registro,'ACTIVO')='ACTIVO') +
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos WHERE COALESCE(estatus_registro,'ACTIVO')='ACTIVO')
        ) AS total
      `),

      /* Alcances — módulo */
      safeQuery(`SELECT habilitado FROM "${SCHEMA}".modulos_control WHERE modulo = 'ALCANCES' LIMIT 1`),

      /* Alcances — última captura */
      safeQuery(`
        SELECT MAX(fecha_captura) AS ultima,
               (ARRAY_AGG(usuario_actualizacion ORDER BY fecha_captura DESC))[1] AS usuario
        FROM "${SCHEMA}".alcances_obras
      `),

      /* Alcances — total */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".alcances_obras`),

      /* Información General — última captura */
      safeQuery(`
        SELECT MAX(fecha_captura) AS ultima,
               (ARRAY_AGG(usuario_actualizacion ORDER BY fecha_captura DESC))[1] AS usuario
        FROM "${SCHEMA}".informacion_general_obras
      `),

      /* Información General — total registros */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".informacion_general_obras`),

      /* Información General — indicadores configurados */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".catalogo_indicadores_programa WHERE activo = TRUE`),

      /* Cobertura — total obras */
      safeQuery(`
        SELECT (
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos)    +
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas)    +
          (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos)
        ) AS total
      `),
      /* Cobertura — con alcances */
      safeQuery(`
        SELECT COUNT(DISTINCT BTRIM(clave_unica::TEXT)) AS con_alcances
        FROM "${SCHEMA}".alcances_obras
        WHERE clave_unica IS NOT NULL
      `),

      /* UTOPÍAS — módulo */
      safeQuery(`SELECT habilitado FROM "${SCHEMA}".modulos_control WHERE modulo = 'UTOPIAS' LIMIT 1`),

      /* UTOPÍAS — última actualización (sin ARRAY_AGG para evitar NULL issues) */
      safeQuery(`
        SELECT MAX(fecha_actualizacion) AS ultima
        FROM "${SCHEMA}".uto_2025
      `),

      /* UTOPÍAS — total frentes */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".uto_2025`),

      /* Geoestadística — última alta */
      safeQuery(`
        SELECT MAX(fecha_creacion) AS ultima,
               (ARRAY_AGG(creado_por ORDER BY fecha_creacion DESC NULLS LAST))[1] AS usuario
        FROM "${SCHEMA}".catalogo_obras
      `),

      /* Geoestadística — total obras activas */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".catalogo_obras WHERE estatus_registro = 'ACTIVO'`),

      /* Geoestadística — auditoría reciente */
      safeQuery(`SELECT COUNT(*) AS total FROM "${SCHEMA}".obras_auditoria`),

      /* ── INTEGRIDAD: claves nulas ── */
      safeQuery(`
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE') AS nombre_obra,
                COALESCE("PROGRAMA",'?') AS programa, COALESCE("ALCALDIA",'?') AS alcaldia,
                'obras_puntos' AS tabla
         FROM "${SCHEMA}".obras_puntos WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_lineas'
         FROM "${SCHEMA}".obras_lineas WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_poligonos'
         FROM "${SCHEMA}".obras_poligonos WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '' LIMIT 5)
      `),

      /* ── INTEGRIDAD: claves duplicadas ── */
      safeQuery(`
        WITH todas AS (
          SELECT BTRIM(clave_unica::TEXT) AS clave, "NOMBRE_OBRA" AS nombre,
                 "PROGRAMA" AS programa, 'obras_puntos' AS tabla
          FROM "${SCHEMA}".obras_puntos WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
          UNION ALL
          SELECT BTRIM(clave_unica::TEXT), "NOMBRE_OBRA", "PROGRAMA", 'obras_lineas'
          FROM "${SCHEMA}".obras_lineas WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
          UNION ALL
          SELECT BTRIM(clave_unica::TEXT), "NOMBRE_OBRA", "PROGRAMA", 'obras_poligonos'
          FROM "${SCHEMA}".obras_poligonos WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
        ),
        dupes AS (SELECT clave FROM todas GROUP BY clave HAVING COUNT(*) > 1)
        SELECT t.clave AS clave_unica, t.nombre AS nombre_obra,
               t.programa, t.tabla, COUNT(*) OVER (PARTITION BY t.clave) AS ocurrencias
        FROM todas t JOIN dupes d ON d.clave = t.clave
        ORDER BY ocurrencias DESC, t.clave
        LIMIT 10
      `),

      /* ── INTEGRIDAD: geometrías vacías o inválidas ── */
      safeQuery(`
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE') AS nombre_obra,
                COALESCE("PROGRAMA",'?') AS programa, COALESCE("ALCALDIA",'?') AS alcaldia,
                'obras_puntos' AS tabla
         FROM "${SCHEMA}".obras_puntos WHERE geom IS NULL OR ST_IsValid(geom)=FALSE LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_lineas'
         FROM "${SCHEMA}".obras_lineas WHERE geom IS NULL OR ST_IsValid(geom)=FALSE LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_poligonos'
         FROM "${SCHEMA}".obras_poligonos WHERE geom IS NULL OR ST_IsValid(geom)=FALSE LIMIT 5)
      `),

      /* ── INTEGRIDAD: programas vacíos ── */
      safeQuery(`
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE') AS nombre_obra,
                COALESCE("ALCALDIA",'?') AS alcaldia, 'obras_puntos' AS tabla
         FROM "${SCHEMA}".obras_puntos WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("ALCALDIA",'?'), 'obras_lineas'
         FROM "${SCHEMA}".obras_lineas WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("ALCALDIA",'?'), 'obras_poligonos'
         FROM "${SCHEMA}".obras_poligonos WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='' LIMIT 5)
      `),

      /* ── INTEGRIDAD: seguimientos vacíos ── */
      safeQuery(`
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE') AS nombre_obra,
                COALESCE("PROGRAMA",'?') AS programa, COALESCE("ALCALDIA",'?') AS alcaldia,
                'obras_puntos' AS tabla
         FROM "${SCHEMA}".obras_puntos WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_lineas'
         FROM "${SCHEMA}".obras_lineas WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='' LIMIT 5)
        UNION ALL
        (SELECT id, COALESCE("NOMBRE_OBRA",'SIN NOMBRE'),
                COALESCE("PROGRAMA",'?'), COALESCE("ALCALDIA",'?'), 'obras_poligonos'
         FROM "${SCHEMA}".obras_poligonos WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='' LIMIT 5)
      `),
    ]);

    /* ── Extraer valores ── */
    const sistemaActivo = sistemaRows?.[0]?.activo ?? true;
    const semana = semanaRows?.[0] || { semana: null, anio: null };

    /* Mapa de módulos desde modulos_control */
    const modMap = {};
    (modulosRows || []).forEach((m) => { modMap[m.modulo] = m.habilitado; });

    const alcancesHab = alcancesModuloRows?.[0]?.habilitado ?? true;
    const utopiasHab  = utopiasModuloRows?.[0]?.habilitado  ?? true;

    /* ── Construir módulos ── */
    const modulos = [
      {
        id: "actualizacion_obras",
        nombre: "Actualización de Obras",
        estado: calcEstado(true, sistemaActivo, true),
        ultima_actividad: fmtFecha(obrasUltimaRows?.[0]?.ultima),
        ultimo_usuario:   obrasUltimaRows?.[0]?.usuario || null,
        total:   parseInt(obrasTotalRows?.[0]?.total || 0, 10),
        detalle: `${parseInt(obrasTotalRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} obras activas`,
        error: obrasUltimaRows === null,
      },
      {
        id: "alcances",
        nombre: "Alcances Operativos",
        estado: calcEstado(alcancesHab, sistemaActivo, true),
        ultima_actividad: fmtFecha(alcancesUltimaRows?.[0]?.ultima),
        ultimo_usuario:   alcancesUltimaRows?.[0]?.usuario || null,
        total:   parseInt(alcancesTotalRows?.[0]?.total || 0, 10),
        detalle: `${parseInt(alcancesTotalRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} registros`,
        error: alcancesUltimaRows === null,
      },
      {
        id: "informacion_general",
        nombre: "Información General de la Obra",
        estado: calcEstado(true, true, false),
        ultima_actividad: fmtFecha(infoGeneralUltimaRows?.[0]?.ultima),
        ultimo_usuario:   infoGeneralUltimaRows?.[0]?.usuario || null,
        total:   parseInt(infoGeneralTotalRows?.[0]?.total || 0, 10),
        detalle: `${parseInt(infoGeneralCatalogoRows?.[0]?.total || 0, 10)} indicadores config. · ${parseInt(infoGeneralTotalRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} registros`,
        error: infoGeneralUltimaRows === null,
      },
      {
        id: "cobertura",
        nombre: "Cobertura de Alcances",
        estado: "DISPONIBLE",
        ultima_actividad: null,
        ultimo_usuario:   null,
        total:   parseInt(coberturaTotalRows?.[0]?.total || 0, 10),
        detalle: (() => {
          const t = parseInt(coberturaTotalRows?.[0]?.total || 0, 10);
          const c = parseInt(coberturaConRows?.[0]?.con_alcances || 0, 10);
          const pct = t > 0 ? ((c / t) * 100).toFixed(1) : 0;
          return `${pct}% cobertura · ${c.toLocaleString("es-MX")} / ${t.toLocaleString("es-MX")} obras`;
        })(),
        error: coberturaTotalRows === null && coberturaConRows === null,
      },
      {
        id: "utopias",
        nombre: "UTOPÍAS",
        estado: calcEstado(utopiasHab, true, false),
        ultima_actividad: fmtFecha(utopiasUltimaRows?.[0]?.ultima),
        ultimo_usuario:   null,
        total:   parseInt(utopiasTotalRows?.[0]?.total || 0, 10),
        detalle: `${parseInt(utopiasTotalRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} frentes`,
        error: utopiasUltimaRows === null,
      },
      {
        id: "geoestadistica",
        nombre: "Gestión de Obras (Geoestadística)",
        estado: geoTotalRows !== null ? "DISPONIBLE" : "ERROR",
        ultima_actividad: fmtFecha(geoUltimaRows?.[0]?.ultima),
        ultimo_usuario:   geoUltimaRows?.[0]?.usuario || null,
        total:   parseInt(geoTotalRows?.[0]?.total || 0, 10),
        detalle: `${parseInt(geoTotalRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} obras · ${parseInt(geoAuditoriaRows?.[0]?.total || 0, 10).toLocaleString("es-MX")} registros en auditoría`,
        error: geoTotalRows === null,
      },
    ];

    /* ── Integridad de datos ── */
    const contarTotal = (rows) => rows?.length ?? 0;

    /* Para claves nulas y duplicadas necesitamos el COUNT total, no solo la muestra */
    const [clavesNulasCount, duplicadasCount, geomCount, programasCount, seguimientosCount] =
      await Promise.all([
        safeQuery(`
          SELECT (
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos    WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas    WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos WHERE clave_unica IS NULL OR BTRIM(clave_unica::TEXT) = '')
          ) AS total
        `),
        safeQuery(`
          WITH todas AS (
            SELECT BTRIM(clave_unica::TEXT) AS c FROM "${SCHEMA}".obras_puntos WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
            UNION ALL SELECT BTRIM(clave_unica::TEXT) FROM "${SCHEMA}".obras_lineas WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
            UNION ALL SELECT BTRIM(clave_unica::TEXT) FROM "${SCHEMA}".obras_poligonos WHERE clave_unica IS NOT NULL AND BTRIM(clave_unica::TEXT)<>''
          )
          SELECT COUNT(*) AS total FROM (SELECT c FROM todas GROUP BY c HAVING COUNT(*)>1) sub
        `),
        safeQuery(`
          SELECT (
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos    WHERE geom IS NULL OR ST_IsValid(geom)=FALSE) +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas    WHERE geom IS NULL OR ST_IsValid(geom)=FALSE) +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos WHERE geom IS NULL OR ST_IsValid(geom)=FALSE)
          ) AS total
        `),
        safeQuery(`
          SELECT (
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos    WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas    WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos WHERE "PROGRAMA" IS NULL OR BTRIM("PROGRAMA")='')
          ) AS total
        `),
        safeQuery(`
          SELECT (
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_puntos    WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_lineas    WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='') +
            (SELECT COUNT(*) FROM "${SCHEMA}".obras_poligonos WHERE "SEGUIMIENTO" IS NULL OR BTRIM("SEGUIMIENTO")='')
          ) AS total
        `),
      ]);

    const validaciones = [
      {
        clave:  "claves_nulas",
        label:  "Claves únicas nulas",
        nivel:  "CRITICO",
        total:  parseInt(clavesNulasCount?.[0]?.total || 0, 10),
        muestra: (integClavesNulasRows || []).slice(0, 5),
      },
      {
        clave:  "claves_duplicadas",
        label:  "Claves únicas duplicadas",
        nivel:  "CRITICO",
        total:  parseInt(duplicadasCount?.[0]?.total || 0, 10),
        muestra: (integDuplicadasRows || []).slice(0, 5),
      },
      {
        clave:  "geometrias_invalidas",
        label:  "Geometrías vacías o inválidas",
        nivel:  "CRITICO",
        total:  parseInt(geomCount?.[0]?.total || 0, 10),
        muestra: (integGeomRows || []).slice(0, 5),
      },
      {
        clave:  "programas_vacios",
        label:  "Programas vacíos",
        nivel:  "ADVERTENCIA",
        total:  parseInt(programasCount?.[0]?.total || 0, 10),
        muestra: (integProgramasRows || []).slice(0, 5),
      },
      {
        clave:  "seguimientos_vacios",
        label:  "Seguimientos vacíos",
        nivel:  "ADVERTENCIA",
        total:  parseInt(seguimientosCount?.[0]?.total || 0, 10),
        muestra: (integSeguimientosRows || []).slice(0, 5),
      },
    ];

    const hayErrorCritico = validaciones
      .some((v) => v.nivel === "CRITICO" && v.total > 0);
    const hayAdvertencia = validaciones
      .some((v) => v.nivel === "ADVERTENCIA" && v.total > 0);

    const resumenIntegridad = hayErrorCritico
      ? "PROBLEMAS"
      : hayAdvertencia
        ? "ADVERTENCIA"
        : "INTEGRA";

    res.json({
      success: true,
      generado_en: new Date().toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
      sistema: {
        activo: sistemaActivo,
        semana: semana.semana,
        anio:   semana.anio,
      },
      modulos,
      integridad: {
        resumen:      resumenIntegridad,
        validaciones,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/admin/estado/programas-modo
   Lista todos los programas con conteo de obras
   por modo de cálculo de avance.
════════════════════════════════════════════════ */
exports.getProgramasModo = async (req, res) => {
  try {
    // Consulta por tabla independiente para que un fallo en una no bloquee las demás
    const queryTabla = (tabla) => safeQuery(`
      SELECT
        UPPER(TRIM(COALESCE("PROGRAMA", '')))                                                AS programa,
        COUNT(*) FILTER (WHERE COALESCE(modo_calculo_avance, 'GENERAL') = 'FRENTES')::int   AS n_frentes,
        COUNT(*) FILTER (WHERE COALESCE(modo_calculo_avance, 'GENERAL') = 'GENERAL')::int   AS n_general,
        COUNT(*)::int                                                                         AS total
      FROM "${SCHEMA}"."${tabla}"
      WHERE "PROGRAMA" IS NOT NULL AND TRIM("PROGRAMA") <> ''
      GROUP BY UPPER(TRIM(COALESCE("PROGRAMA", '')))
    `);

    const [rPuntos, rLineas, rPoligonos] = await Promise.all([
      queryTabla("obras_puntos"),
      queryTabla("obras_lineas"),
      queryTabla("obras_poligonos"),
    ]);

    // Agregar resultados por programa
    const map = new Map();
    for (const row of [...(rPuntos || []), ...(rLineas || []), ...(rPoligonos || [])]) {
      if (!row.programa) continue;
      const prev = map.get(row.programa) || { programa: row.programa, n_frentes: 0, n_general: 0, total: 0 };
      map.set(row.programa, {
        programa:   prev.programa,
        n_frentes:  prev.n_frentes + Number(row.n_frentes || 0),
        n_general:  prev.n_general + Number(row.n_general || 0),
        total:      prev.total     + Number(row.total     || 0),
      });
    }

    const programas = [...map.values()].sort((a, b) => a.programa.localeCompare(b.programa));
    return res.json({ ok: true, programas });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/* ── Rebaselínea snapshots y AVANCE REAL al promedio de frentes.
   Se llama cuando una tabla de obras cambia a modo FRENTES para
   evitar que el cambio de método aparezca como un retroceso. ── */
async function rebasearModoFrentes(tabla, rows, usuario) {
  if (!rows || rows.length === 0) return;
  const ids = rows.map((r) => r.id);

  // 1. Actualizar AVANCE REAL a promedio simple de frentes
  await safeQuery(
    `UPDATE "${SCHEMA}"."${tabla}" t
     SET "AVANCE REAL" = sub.avg_avance
     FROM (
       SELECT t2.id,
              ROUND(AVG(REPLACE(REPLACE(f.avance::text,'%',''),',','')::numeric), 2) AS avg_avance
       FROM "${SCHEMA}"."${tabla}" t2
       INNER JOIN "${SCHEMA}".frentes_obra f
         ON BTRIM(f.clave_unica::text) = BTRIM(t2.clave_unica::text)
       WHERE t2.id = ANY($1::int[])
         AND f.avance IS NOT NULL AND BTRIM(f.avance::text) <> ''
         AND REPLACE(REPLACE(f.avance::text,'%',''),',','') ~ '^-?[0-9]+(\\.[0-9]+)?$'
       GROUP BY t2.id
     ) sub
     WHERE t.id = sub.id`,
    [ids]
  );

  // 2. Rebaselínear los 2 últimos snapshots: 3 queries simples en lugar de CTE complejo.
  const frentesAvg = await safeQuery(
    `SELECT t.id AS obra_id,
            ROUND(AVG(REPLACE(REPLACE(f.avance::text,'%',''),',','')::numeric), 2) AS avg_avance
     FROM "${SCHEMA}"."${tabla}" t
     INNER JOIN "${SCHEMA}".frentes_obra f
       ON BTRIM(f.clave_unica::text) = BTRIM(t.clave_unica::text)
     WHERE t.id = ANY($1::int[])
       AND f.avance IS NOT NULL AND BTRIM(f.avance::text) <> ''
       AND REPLACE(REPLACE(f.avance::text,'%',''),',','') ~ '^-?[0-9]+(\\.[0-9]+)?$'
     GROUP BY t.id`,
    [ids]
  );
  if (frentesAvg && frentesAvg.length > 0) {
    for (const { obra_id, avg_avance } of frentesAvg) {
      const snaps = await safeQuery(
        `SELECT id FROM "${SCHEMA}".snapshots_semanales
         WHERE tabla = $1 AND obra_id = $2
         ORDER BY anio DESC,
                  CASE WHEN semana ~ '^[0-9]+$' THEN semana::int ELSE 0 END DESC
         LIMIT 2`,
        [tabla, obra_id]
      );
      if (!snaps || snaps.length === 0) continue;
      await safeQuery(
        `UPDATE "${SCHEMA}".snapshots_semanales
         SET avance = $1
         WHERE id = ANY($2::int[])`,
        [avg_avance, snaps.map((s) => s.id)]
      );
    }
  }

  // 3. Registrar hito en auditoria para la bitácora
  await safeQuery(
    `INSERT INTO "${SCHEMA}".auditoria (tabla, obra_id, accion, usuario, motivo)
     SELECT $2, id, 'CAMBIO_MODO', $3, 'Cambio a seguimiento por frentes'
     FROM "${SCHEMA}"."${tabla}"
     WHERE id = ANY($1::int[])`,
    [ids, tabla, usuario]
  );
}

/* ════════════════════════════════════════════════
   PATCH /api/admin/estado/programa-modo
   Cambia modo_calculo_avance para TODAS las obras
   de un programa en las 3 tablas.
   Body: { programa: string, modo: "GENERAL"|"FRENTES" }
════════════════════════════════════════════════ */
exports.setProgramaModo = async (req, res) => {
  const { programa, modo } = req.body || {};
  if (!programa || !["GENERAL", "FRENTES"].includes(modo)) {
    return res.status(400).json({ ok: false, error: "programa y modo (GENERAL|FRENTES) requeridos" });
  }

  const usuario = req.user?.username || req.user?.email || "sistema";
  const progNorm = programa.trim().toUpperCase();

  try {
    const [rPuntos, rLineas, rPoligonos] = await Promise.all([
      safeQuery(
        `UPDATE "${SCHEMA}".obras_puntos
         SET modo_calculo_avance = $1, "USUARIO ACTUALIZACION" = $2, "FECHA ACTUALIZACION" = NOW()
         WHERE UPPER(TRIM("PROGRAMA")) = $3
         RETURNING id`,
        [modo, usuario, progNorm]
      ),
      safeQuery(
        `UPDATE "${SCHEMA}".obras_lineas
         SET modo_calculo_avance = $1, "USUARIO ACTUALIZACION" = $2, "FECHA ACTUALIZACION" = NOW()
         WHERE UPPER(TRIM("PROGRAMA")) = $3
         RETURNING id`,
        [modo, usuario, progNorm]
      ),
      safeQuery(
        `UPDATE "${SCHEMA}".obras_poligonos
         SET modo_calculo_avance = $1, "USUARIO ACTUALIZACION" = $2, "FECHA ACTUALIZACION" = NOW()
         WHERE UPPER(TRIM("PROGRAMA")) = $3
         RETURNING id`,
        [modo, usuario, progNorm]
      ),
    ]);

    // Al cambiar a FRENTES: rebaselínear snapshots y AVANCE REAL
    if (modo === "FRENTES") {
      await Promise.all([
        rebasearModoFrentes("obras_puntos",   rPuntos   || [], usuario),
        rebasearModoFrentes("obras_lineas",   rLineas   || [], usuario),
        rebasearModoFrentes("obras_poligonos", rPoligonos || [], usuario),
      ]);
    }

    const total =
      (rPuntos?.length ?? 0) +
      (rLineas?.length  ?? 0) +
      (rPoligonos?.length ?? 0);

    return res.json({ ok: true, obras_actualizadas: total, modo, programa: progNorm });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
