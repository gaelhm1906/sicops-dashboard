/**
 * controllers/utopiasController.js
 * Lógica de negocio para el subsistema especializado UTOPÍAS.
 *
 * Opera sobre sig_sobse.uto_2025 (tabla hija operativa por frente).
 * Al actualizar un frente, sincroniza automáticamente obras_puntos.avance_real
 * SOLO para el programa "CONSTRUCCION DE UTOPIAS".
 *
 * Endpoints expuestos por routes/utopias.js:
 *   GET  /api/utopias              → listarUtopias   (agrupado por obra)
 *   GET  /api/utopias/resumen      → resumenGlobal
 *   GET  /api/utopias/frentes      → listarFrente    (tabla plana con filtros)
 *   GET  /api/utopias/:clave       → detalleUtopia   (frentes de una utopía)
 *   PUT  /api/utopias/frentes/update → actualizarFrente
 */

const { query, SCHEMA } = require("../config/pg");
const logger            = require("../middleware/logger");

const TABLA_UTOPIAS    = `${SCHEMA}.uto_2025`;
const TABLA_OBRAS      = `${SCHEMA}.obras_puntos`;
const PROGRAMA_UTOPIAS = "CONSTRUCCION DE UTOPIAS";

/* ── Helpers ── */

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildFiltros(query_params) {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (query_params.empresa) {
    conditions.push(`UPPER(empresa) LIKE UPPER($${idx++})`);
    values.push(`%${query_params.empresa}%`);
  }
  if (query_params.frente) {
    conditions.push(`UPPER(frente) LIKE UPPER($${idx++})`);
    values.push(`%${query_params.frente}%`);
  }
  if (query_params.contrato) {
    conditions.push(`UPPER(contrato) LIKE UPPER($${idx++})`);
    values.push(`%${query_params.contrato}%`);
  }
  if (query_params.jud) {
    conditions.push(`UPPER(jud_responsable) LIKE UPPER($${idx++})`);
    values.push(`%${query_params.jud}%`);
  }
  if (query_params.clave) {
    conditions.push(`clave_unica = $${idx++}`);
    values.push(query_params.clave);
  }
  if (query_params.avance_min !== undefined) {
    conditions.push(`avance_real >= $${idx++}`);
    values.push(safeNum(query_params.avance_min));
  }
  if (query_params.avance_max !== undefined) {
    conditions.push(`avance_real <= $${idx++}`);
    values.push(safeNum(query_params.avance_max));
  }

  return { conditions, values };
}

/* ── Sincronización automática con obras_puntos ── */
async function sincronizarConObrasPuntos(clave_unica, nombre_obra, usuario) {
  try {
    /* Calcular promedio de avance_real de todos los frentes de la utopía */
    const resCalculo = await query(
      `SELECT
         ROUND(AVG(avance_real)::numeric, 2)          AS avance_promedio,
         ROUND(AVG(COALESCE(atraso, 0))::numeric, 2)  AS atraso_promedio,
         SUM(COALESCE(fuerza_de_trabajo, 0))           AS fuerza_total,
         COUNT(*)                                       AS total_frentes
       FROM ${TABLA_UTOPIAS}
       WHERE clave_unica = $1`,
      [clave_unica]
    );

    const { avance_promedio, atraso_promedio } = resCalculo.rows[0] || {};
    if (avance_promedio === null || avance_promedio === undefined) return;

    const avanceFinal = safeNum(avance_promedio, 0);

    /* Actualizar obras_puntos SOLO si existe la obra y es del programa correcto */
    const updateRes = await query(
      `UPDATE ${TABLA_OBRAS}
       SET avance_real             = $1,
           usuario_actualizacion  = $2,
           fecha_actualizacion    = NOW()
       WHERE clave_unica = $3
         AND UPPER(TRIM(programa)) = $4
       RETURNING id, nombre_obra, avance_real`,
      [avanceFinal, usuario, clave_unica, PROGRAMA_UTOPIAS]
    );

    if (updateRes.rowCount > 0) {
      logger.info(
        "utopias",
        `Sincronizado obras_puntos: clave=${clave_unica} avance=${avanceFinal}% por ${usuario}`
      );
    } else {
      /* La clave no existe en obras_puntos — no es un error, puede estar solo en uto_2025 */
      logger.warn(
        "utopias",
        `clave_unica ${clave_unica} no encontrada en obras_puntos o programa no coincide`
      );
    }
  } catch (err) {
    /* No propagamos el error para no bloquear la actualización del frente */
    logger.error("utopias", `Error al sincronizar obras_puntos: ${err.message}`);
  }
}

/* ═══════════════════════════════════════
   GET /api/utopias
   Lista utopías agrupadas por clave_unica con su resumen ejecutivo.
═══════════════════════════════════════ */
async function listarUtopias(req, res) {
  try {
    const result = await query(
      `SELECT
         clave_unica,
         nombre_obra,
         COUNT(*)                                          AS total_frentes,
         ROUND(AVG(avance_real)::numeric, 2)              AS avance_promedio,
         ROUND(AVG(avance_programado)::numeric, 2)        AS avance_programado_promedio,
         ROUND(AVG(COALESCE(atraso, 0))::numeric, 2)      AS atraso_promedio,
         SUM(COALESCE(fuerza_de_trabajo, 0))               AS fuerza_total,
         SUM(COALESCE(monto_con_iva, 0))                   AS monto_total,
         MIN(fecha_de_inicio)                              AS fecha_inicio_min,
         MAX(fecha_de_termino)                             AS fecha_termino_max,
         ARRAY_AGG(DISTINCT empresa ORDER BY empresa)     AS empresas,
         ARRAY_AGG(DISTINCT jud_responsable ORDER BY jud_responsable) FILTER (WHERE jud_responsable IS NOT NULL) AS juds
       FROM ${TABLA_UTOPIAS}
       GROUP BY clave_unica, nombre_obra
       ORDER BY nombre_obra`
    );

    const utopias = result.rows.map((row) => ({
      clave_unica:              row.clave_unica,
      nombre_obra:              row.nombre_obra,
      total_frentes:            Number(row.total_frentes),
      avance_promedio:          safeNum(row.avance_promedio),
      avance_programado:        safeNum(row.avance_programado_promedio),
      atraso_promedio:          safeNum(row.atraso_promedio),
      fuerza_total:             safeNum(row.fuerza_total),
      monto_total:              safeNum(row.monto_total),
      fecha_inicio:             row.fecha_inicio_min,
      fecha_termino:            row.fecha_termino_max,
      empresas:                 row.empresas || [],
      juds:                     row.juds || [],
    }));

    return res.json({ success: true, data: utopias, total: utopias.length });
  } catch (err) {
    logger.error("utopias", `Error en listarUtopias: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al obtener utopías.", detail: err.message });
  }
}

/* ═══════════════════════════════════════
   GET /api/utopias/resumen
   KPIs globales de todo el subsistema.
═══════════════════════════════════════ */
async function resumenGlobal(req, res) {
  try {
    const result = await query(
      `SELECT
         COUNT(DISTINCT clave_unica)                       AS total_utopias,
         COUNT(*)                                          AS total_frentes,
         ROUND(AVG(avance_real)::numeric, 2)              AS avance_global,
         ROUND(AVG(COALESCE(atraso, 0))::numeric, 2)      AS atraso_global,
         SUM(COALESCE(fuerza_de_trabajo, 0))               AS fuerza_total,
         SUM(COALESCE(monto_con_iva, 0))                   AS monto_total,
         COUNT(*) FILTER (WHERE avance_real >= 100)        AS frentes_terminados,
         COUNT(*) FILTER (WHERE avance_real > 0 AND avance_real < 100) AS frentes_en_proceso,
         COUNT(*) FILTER (WHERE COALESCE(avance_real, 0) = 0)          AS frentes_sin_iniciar
       FROM ${TABLA_UTOPIAS}`
    );

    const row = result.rows[0] || {};

    return res.json({
      success: true,
      data: {
        total_utopias:      Number(row.total_utopias  || 0),
        total_frentes:      Number(row.total_frentes   || 0),
        avance_global:      safeNum(row.avance_global),
        atraso_global:      safeNum(row.atraso_global),
        fuerza_total:       safeNum(row.fuerza_total),
        monto_total:        safeNum(row.monto_total),
        frentes_terminados: Number(row.frentes_terminados   || 0),
        frentes_en_proceso: Number(row.frentes_en_proceso   || 0),
        frentes_sin_iniciar:Number(row.frentes_sin_iniciar  || 0),
      },
    });
  } catch (err) {
    logger.error("utopias", `Error en resumenGlobal: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al obtener resumen.", detail: err.message });
  }
}

/* ═══════════════════════════════════════
   GET /api/utopias/frentes
   Tabla plana de todos los frentes con filtros opcionales.
   Query: ?empresa=&frente=&contrato=&jud=&clave=&avance_min=&avance_max=
═══════════════════════════════════════ */
async function listarFrente(req, res) {
  try {
    const { conditions, values } = buildFiltros(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const pagina = Math.max(1, Number(req.query.pagina || 1));
    const limite = Math.min(200, Math.max(1, Number(req.query.limite || 50)));
    const offset = (pagina - 1) * limite;

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM ${TABLA_UTOPIAS} ${where}`,
      values
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const dataResult = await query(
      `SELECT
         id, clave_unica, nombre_obra, frente, empresa, contrato,
         monto_con_iva, avance_programado, avance_real, avance_semanal,
         atraso, jud_responsable, fecha_de_inicio, fecha_de_termino,
         observaciones, fuerza_de_trabajo, updated_at
       FROM ${TABLA_UTOPIAS} ${where}
       ORDER BY nombre_obra, frente
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limite, offset]
    );

    return res.json({
      success: true,
      data:    dataResult.rows,
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    });
  } catch (err) {
    logger.error("utopias", `Error en listarFrente: ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al obtener frentes.", detail: err.message });
  }
}

/* ═══════════════════════════════════════
   GET /api/utopias/:clave
   Detalle de una utopía: sus frentes + resumen ejecutivo.
═══════════════════════════════════════ */
async function detalleUtopia(req, res) {
  const { clave } = req.params;

  try {
    const [resumenRes, frentesRes] = await Promise.all([
      query(
        `SELECT
           clave_unica, nombre_obra,
           COUNT(*)                                         AS total_frentes,
           ROUND(AVG(avance_real)::numeric, 2)             AS avance_promedio,
           ROUND(AVG(avance_programado)::numeric, 2)       AS avance_programado,
           ROUND(AVG(COALESCE(atraso, 0))::numeric, 2)     AS atraso_promedio,
           SUM(COALESCE(fuerza_de_trabajo, 0))              AS fuerza_total,
           SUM(COALESCE(monto_con_iva, 0))                  AS monto_total,
           MIN(fecha_de_inicio)                             AS fecha_inicio,
           MAX(fecha_de_termino)                            AS fecha_termino
         FROM ${TABLA_UTOPIAS}
         WHERE clave_unica = $1
         GROUP BY clave_unica, nombre_obra`,
        [clave]
      ),
      query(
        `SELECT
           id, clave_unica, nombre_obra, frente, empresa, contrato,
           monto_con_iva, avance_programado, avance_real, avance_semanal,
           atraso, jud_responsable, fecha_de_inicio, fecha_de_termino,
           observaciones, fuerza_de_trabajo, updated_at
         FROM ${TABLA_UTOPIAS}
         WHERE clave_unica = $1
         ORDER BY frente`,
        [clave]
      ),
    ]);

    if (!resumenRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: `Utopía con clave ${clave} no encontrada.`,
        code:    "UTOPIA_NOT_FOUND",
      });
    }

    const r = resumenRes.rows[0];
    return res.json({
      success: true,
      resumen: {
        clave_unica:       r.clave_unica,
        nombre_obra:       r.nombre_obra,
        total_frentes:     Number(r.total_frentes),
        avance_promedio:   safeNum(r.avance_promedio),
        avance_programado: safeNum(r.avance_programado),
        atraso_promedio:   safeNum(r.atraso_promedio),
        fuerza_total:      safeNum(r.fuerza_total),
        monto_total:       safeNum(r.monto_total),
        fecha_inicio:      r.fecha_inicio,
        fecha_termino:     r.fecha_termino,
      },
      frentes: frentesRes.rows,
    });
  } catch (err) {
    logger.error("utopias", `Error en detalleUtopia (${clave}): ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al obtener detalle.", detail: err.message });
  }
}

/* ═══════════════════════════════════════
   PUT /api/utopias/frentes/update
   Actualiza un frente de utopía y sincroniza obras_puntos.

   Body: { id, avance_real, avance_semanal, atraso, observaciones, fuerza_de_trabajo }
═══════════════════════════════════════ */
async function actualizarFrente(req, res) {
  const { id, avance_real, avance_semanal, atraso, observaciones, fuerza_de_trabajo } = req.body;
  const usuario = req.user?.email || req.user?.username || "sistema";

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'El campo "id" es requerido.',
      code:    "ID_REQUERIDO",
    });
  }

  const avanceReal    = safeNum(avance_real, null);
  const avanceSemanal = safeNum(avance_semanal, null);
  const atrasoVal     = safeNum(atraso, null);
  const fuerzaVal     = safeNum(fuerza_de_trabajo, null);

  if (avanceReal !== null && (avanceReal < 0 || avanceReal > 100)) {
    return res.status(400).json({
      success: false,
      message: "avance_real debe estar entre 0 y 100.",
      code:    "AVANCE_FUERA_RANGO",
    });
  }

  try {
    /* Construir SET dinámico solo con campos enviados */
    const campos  = [];
    const valores = [];
    let   idx     = 1;

    if (avance_real    !== undefined) { campos.push(`avance_real = $${idx++}`);         valores.push(avanceReal); }
    if (avance_semanal !== undefined) { campos.push(`avance_semanal = $${idx++}`);      valores.push(avanceSemanal); }
    if (atraso         !== undefined) { campos.push(`atraso = $${idx++}`);              valores.push(atrasoVal); }
    if (observaciones  !== undefined) { campos.push(`observaciones = $${idx++}`);       valores.push(observaciones); }
    if (fuerza_de_trabajo !== undefined) { campos.push(`fuerza_de_trabajo = $${idx++}`); valores.push(fuerzaVal); }

    if (campos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se enviaron campos a actualizar.",
        code:    "SIN_CAMPOS",
      });
    }

    campos.push(`updated_at = NOW()`);
    valores.push(id);

    const updateResult = await query(
      `UPDATE ${TABLA_UTOPIAS}
       SET ${campos.join(", ")}
       WHERE id = $${idx}
       RETURNING id, clave_unica, nombre_obra, frente, avance_real, avance_semanal,
                 atraso, observaciones, fuerza_de_trabajo, updated_at`,
      valores
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Frente con id ${id} no encontrado.`,
        code:    "FRENTE_NOT_FOUND",
      });
    }

    const frenteActualizado = updateResult.rows[0];

    logger.info(
      "utopias",
      `Frente actualizado: id=${id} clave=${frenteActualizado.clave_unica} avance=${frenteActualizado.avance_real}% por ${usuario}`
    );

    /* Sincronizar obras_puntos de forma asíncrona (no bloquea la respuesta) */
    sincronizarConObrasPuntos(frenteActualizado.clave_unica, frenteActualizado.nombre_obra, usuario);

    return res.json({
      success:  true,
      data:     frenteActualizado,
      message:  `Frente "${frenteActualizado.frente}" actualizado correctamente.`,
    });
  } catch (err) {
    logger.error("utopias", `Error en actualizarFrente (id=${id}): ${err.message}`);
    return res.status(500).json({ success: false, message: "Error al actualizar frente.", detail: err.message });
  }
}

module.exports = {
  listarUtopias,
  resumenGlobal,
  listarFrente,
  detalleUtopia,
  actualizarFrente,
};
