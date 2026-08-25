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
    /* Calcular avance ponderado por monto (igual que el frontend).
       Si ningún frente tiene monto, cae a promedio simple. */
    const resCalculo = await query(
      `SELECT ROUND(AVG(avance_real)::numeric, 4) AS avance_final
       FROM ${TABLA_UTOPIAS}
       WHERE clave_unica = $1 AND avance_real IS NOT NULL`,
      [clave_unica]
    );

    const { avance_final } = resCalculo.rows[0] || {};
    if (avance_final === null || avance_final === undefined) return;

    const avanceFinal = safeNum(avance_final, 0);

    /* obras_puntos usa nombres de columna con mayúsculas y espacios (tabla legacy).
       Actualizamos SOLO obras del programa CONSTRUCCION DE UTOPIAS. */
    const updateRes = await query(
      `UPDATE ${TABLA_OBRAS}
       SET "AVANCE REAL"           = $1,
           "USUARIO ACTUALIZACION" = $2,
           "FECHA ACTUALIZACION"   = NOW()
       WHERE clave_unica = $3
         AND UPPER(TRIM("PROGRAMA")) = $4
       RETURNING id`,
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
         SUM(CASE WHEN fuerza_de_trabajo ~ '^[0-9]+(\.[0-9]+)?$' THEN fuerza_de_trabajo::numeric ELSE 0 END) AS fuerza_total,
         SUM(COALESCE(monto_con_iva, 0))                   AS monto_total,
         MIN(fecha_de_inicio)                              AS fecha_inicio_min,
         MAX(fecha_de_termino)                             AS fecha_termino_max,
         ARRAY_AGG(DISTINCT empresa ORDER BY empresa)     AS empresas,
         ARRAY_AGG(DISTINCT jud_responsable ORDER BY jud_responsable) FILTER (WHERE jud_responsable IS NOT NULL) AS juds,
         BOOL_AND(estatus = 'ENTREGADO')                  AS entregada
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
      entregada:                row.entregada || false,
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
         SUM(CASE WHEN fuerza_de_trabajo ~ '^[0-9]+(\.[0-9]+)?$' THEN fuerza_de_trabajo::numeric ELSE 0 END) AS fuerza_total,
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
  const claveNorm = String(clave || "").trim();

  try {
    const [resumenRes, frentesRes] = await Promise.all([
      query(
        `SELECT
           clave_unica, nombre_obra,
           COUNT(*)                                         AS total_frentes,
           ROUND(AVG(avance_real)::numeric, 2)             AS avance_promedio,
           ROUND(AVG(avance_programado)::numeric, 2)       AS avance_programado,
           ROUND(AVG(COALESCE(atraso, 0))::numeric, 2)     AS atraso_promedio,
           SUM(CASE WHEN fuerza_de_trabajo ~ '^[0-9]+(\.[0-9]+)?$' THEN fuerza_de_trabajo::numeric ELSE 0 END) AS fuerza_total,
           SUM(COALESCE(monto_con_iva, 0))                  AS monto_total,
           MIN(fecha_de_inicio)                             AS fecha_inicio,
           MAX(fecha_de_termino)                            AS fecha_termino
         FROM ${TABLA_UTOPIAS}
         WHERE BTRIM(COALESCE(clave_unica::text, '')) = $1
         GROUP BY clave_unica, nombre_obra`,
        [claveNorm]
      ),
      query(
        `SELECT
           id, clave_unica, nombre_obra, frente, empresa, contrato,
           monto_con_iva, avance_programado, avance_real, avance_semanal,
           atraso, jud_responsable, fecha_de_inicio, fecha_de_termino,
           observaciones, fuerza_de_trabajo, estatus, updated_at
         FROM ${TABLA_UTOPIAS}
         WHERE BTRIM(COALESCE(clave_unica::text, '')) = $1
         ORDER BY frente`,
        [claveNorm]
      ),
    ]);

    if (!resumenRes.rows[0]) {
      return res.json({
        success: true,
        resumen: null,
        frentes: [],
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
  const { id, avance_real, avance_semanal, atraso, observaciones, fuerza_de_trabajo, estatus } = req.body;
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
    if (estatus           !== undefined) { campos.push(`estatus = $${idx++}`);           valores.push(String(estatus).toUpperCase()); }

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
                 atraso, observaciones, fuerza_de_trabajo, estatus, updated_at`,
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

/* ═══════════════════════════════════════
   POST /api/utopias/importar
   Importa frentes desde Excel vía el sistema PHP de UTOPÍAS.

   Matchea cada frente por (clave_unica, frente) — el Excel semanal de avance
   nunca trae "contrato", así que ya NO se usa como parte de la llave de
   coincidencia (antes esto creaba una fila fantasma con contrato=NULL cada
   vez que un frente se sincronizaba por primera vez, porque el ON CONFLICT
   exigía que también coincidiera el contrato).

   Si un mismo frente tiene más de un contrato registrado (caso real, ej.
   "DEMOLICIONES" con dos licitaciones distintas) y el Excel no especifica
   a cuál pertenece, esa fila se omite y se reporta para revisión manual —
   no se adivina a cuál contrato aplicar el avance.

   Body: {
     utopia_id:   string   — mapea a clave_unica
     nombre_obra: string
     semana:      string   — ej. "Semana 18 / 2026"
     usuario:     string
     frentes: [{
       frente, avance_real, avance_programado, avance_semanal, atraso,
       jud_responsable, fecha_de_inicio, fecha_de_termino,
       fuerza_de_trabajo, estatus, observaciones
     }]
   }
═══════════════════════════════════════ */
async function importarDesdeExcel(req, res) {
  const { utopia_id, nombre_obra, semana, frentes, usuario } = req.body;
  const usuarioAudit = String(usuario || req.user?.email || "importador").trim().slice(0, 100);

  if (!utopia_id || !Array.isArray(frentes) || frentes.length === 0) {
    return res.status(400).json({
      success: false,
      message: "utopia_id y frentes[] son requeridos.",
      code: "PARAMETROS_INVALIDOS",
    });
  }

  const clave     = String(utopia_id).trim();
  const nombreObra = String(nombre_obra || clave).trim().slice(0, 255);
  const resultado  = { insertados: 0, actualizados: 0, omitidos: 0, ambiguos: 0, errores: [] };

  /* Convierte porcentaje a decimal: 85.5 → 0.855 — 0.855 queda igual */
  function toDecimal(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(/[%$,\s]/g, ""));
    if (!Number.isFinite(n)) return null;
    const d = n > 1 ? n / 100 : n;
    return Math.max(0, Math.min(1, d));
  }

  /* Normaliza fecha a YYYY-MM-DD: acepta string ISO, dd/mm/yyyy, serial Excel */
  function toDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const n = Number(s);
    if (Number.isFinite(n) && n > 40000) {
      const d = new Date((n - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) return `${parts[3]}-${parts[2].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  /* Monto en pesos, NO porcentaje — a diferencia de toDecimal() no se acota a 0-1 */
  function toMonto(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  for (const f of frentes) {
    const frenteNom = String(f.frente || "").trim();
    if (!frenteNom) { resultado.omitidos++; continue; }

    const avanceReal       = toDecimal(f.avance_real);
    const avanceProgramado = toDecimal(f.avance_programado);
    const avanceSemanal    = toDecimal(f.avance_semanal);
    const atrasoVal        = toDecimal(f.atraso);
    const judVal           = f.jud_responsable ? String(f.jud_responsable).slice(0, 200) : null;
    const inicioVal        = toDate(f.fecha_de_inicio);
    const terminoVal       = toDate(f.fecha_de_termino);
    const fuerzaVal        = f.fuerza_de_trabajo != null ? String(f.fuerza_de_trabajo).slice(0, 50) : null;
    const estatusVal       = f.estatus ? String(f.estatus).toUpperCase().slice(0, 50) : "EN PROCESO";
    const observacionesVal = f.observaciones ? String(f.observaciones).slice(0, 1000) : null;
    const empresaVal       = f.empresa ? String(f.empresa).slice(0, 255) : null;
    const contratoVal      = f.contrato ? String(f.contrato).slice(0, 100) : null;
    const montoVal         = toMonto(f.monto_con_iva);

    try {
      /* 1) ¿Ya existe este frente para esta utopía? (sin importar contrato) */
      const existing = await query(
        `SELECT id FROM ${TABLA_UTOPIAS} WHERE clave_unica = $1 AND frente = $2`,
        [clave, frenteNom]
      );

      if (existing.rows.length > 1) {
        /* Más de un contrato registrado para el mismo frente — el Excel no
           distingue a cuál pertenece esta fila. No se toca nada. */
        resultado.ambiguos++;
        resultado.errores.push({
          frente: frenteNom,
          error: `Frente con ${existing.rows.length} contratos distintos en BD — omitido, requiere revisión manual.`,
        });
        continue;
      }

      if (existing.rows.length === 1) {
        /* 2) Ya existe una sola fila — actualizar avance/estatus, preservando
              contrato/empresa/monto existentes si el Excel no los trae.
              Reglas de estatus:
                - ENTREGADO nunca se degrada (protección manual).
                - avance_real >= 1 (100%) → TERMINADO automático.
                - Cualquier otro caso → usar el valor del Excel o el existente. */
        await query(
          `UPDATE ${TABLA_UTOPIAS} SET
             avance_real       = $1,
             avance_programado = $2,
             avance_semanal    = $3,
             atraso            = $4,
             observaciones     = $5,
             jud_responsable   = COALESCE($6, jud_responsable),
             fecha_de_inicio   = COALESCE($7, fecha_de_inicio),
             fecha_de_termino  = COALESCE($8, fecha_de_termino),
             fuerza_de_trabajo = COALESCE($9, fuerza_de_trabajo),
             estatus           = CASE
                                   WHEN estatus = 'ENTREGADO' THEN 'ENTREGADO'
                                   WHEN $1 >= 1              THEN 'TERMINADO'
                                   ELSE $10
                                 END,
             empresa           = COALESCE($11, empresa),
             contrato          = COALESCE($12, contrato),
             monto_con_iva     = COALESCE($13, monto_con_iva),
             updated_at        = NOW()
           WHERE id = $14`,
          [
            avanceReal, avanceProgramado, avanceSemanal, atrasoVal,
            observacionesVal, judVal, inicioVal, terminoVal, fuerzaVal,
            estatusVal, empresaVal, contratoVal, montoVal,
            existing.rows[0].id,
          ]
        );
        resultado.actualizados++;
        continue;
      }

      /* 3) No existe ninguna fila todavía — frente realmente nuevo, insertar.
            Aplicar la misma regla: avance >= 1 → TERMINADO desde el inicio. */
      const estatusInsert = (avanceReal != null && avanceReal >= 1) ? 'TERMINADO' : estatusVal;
      await query(
        `INSERT INTO ${TABLA_UTOPIAS}
           (clave_unica, nombre_obra, frente,
            avance_real, avance_programado, avance_semanal, atraso,
            jud_responsable, fecha_de_inicio, fecha_de_termino,
            fuerza_de_trabajo, estatus, observaciones,
            empresa, contrato, monto_con_iva,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW(), NOW())`,
        [
          clave, nombreObra, frenteNom,
          avanceReal, avanceProgramado, avanceSemanal, atrasoVal,
          judVal, inicioVal, terminoVal,
          fuerzaVal, estatusInsert, observacionesVal,
          empresaVal, contratoVal, montoVal,
        ]
      );
      resultado.insertados++;
    } catch (err) {
      resultado.errores.push({ frente: frenteNom, error: err.message });
      logger.warn("utopias-import", `Error frente "${frenteNom}": ${err.message}`);
    }
  }

  /* Sincronizar avance global en obras_puntos (no bloquea respuesta) */
  sincronizarConObrasPuntos(clave, nombreObra, usuarioAudit);

  logger.info(
    "utopias-import",
    `utopia=${clave} semana="${semana || "?"}" ` +
    `insertados=${resultado.insertados} actualizados=${resultado.actualizados} ` +
    `omitidos=${resultado.omitidos} ambiguos=${resultado.ambiguos} errores=${resultado.errores.length} por=${usuarioAudit}`
  );

  return res.json({
    success: true,
    utopia_id: clave,
    semana: semana || null,
    procesados:   frentes.length,
    insertados:   resultado.insertados,
    actualizados: resultado.actualizados,
    omitidos:     resultado.omitidos,
    ambiguos:     resultado.ambiguos,
    errores:      resultado.errores,
  });
}

module.exports = {
  listarUtopias,
  resumenGlobal,
  listarFrente,
  detalleUtopia,
  actualizarFrente,
  importarDesdeExcel,
};
