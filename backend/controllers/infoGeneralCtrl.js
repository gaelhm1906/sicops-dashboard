/**
 * controllers/infoGeneralCtrl.js
 * Módulo: Información General de Obras
 *
 * GET  /api/info-general/catalogo?programa=X[&area=Y]
 * GET  /api/info-general/obra?clave_unica=X
 * POST /api/info-general/conteos        { claves: [] }  → batch count (1 query)
 * POST /api/info-general/guardar-ficha  (transaccional)
 * PUT  /api/info-general/limpiar/:id    (solo ADMIN — nullifica valor)
 */

const { pool, query, SCHEMA } = require("../config/pg");

/* ════════════════════════════════════════════════
   GET /api/info-general/catalogo
   Indicadores activos del programa (y area para OBRAS ADICIONALES)
════════════════════════════════════════════════ */
exports.getCatalogo = async (req, res) => {
  const { programa, area } = req.query;
  if (!programa) return res.status(400).json({ success: false, message: "programa requerido" });

  try {
    const result = await query(`
      SELECT id, indicador, unidad_medida, tipo_dato, orden,
             obligatorio, visible_en_ficha
      FROM "${SCHEMA}".catalogo_indicadores_programa
      WHERE programa = $1
        AND activo   = TRUE
        AND ($2::text IS NULL OR area = $2)
      ORDER BY orden ASC, indicador ASC
    `, [programa, area || null]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   GET /api/info-general/obra
   Valores ya capturados para una clave_unica
════════════════════════════════════════════════ */
exports.getObra = async (req, res) => {
  const { clave_unica } = req.query;
  if (!clave_unica) return res.status(400).json({ success: false, message: "clave_unica requerida" });

  const t0 = Date.now();
  try {
    const result = await query(`
      SELECT id, indicador, valor, valor_texto, unidad_medida,
             usuario_actualizacion, fecha_captura,
             usuario_edicion,       fecha_edicion
      FROM "${SCHEMA}".informacion_general_obras
      WHERE clave_unica = $1
      ORDER BY indicador ASC
    `, [clave_unica]);

    console.log(`[InfoGeneral] getObra ${clave_unica}: ${Date.now() - t0}ms`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   POST /api/info-general/conteos
   Conteo batch: N claves en 1 sola query (= ANY).
   Reemplaza N llamadas individuales a getObra.
   Body: { claves: ["clave1", "clave2", ...] }
   Response: { data: { "clave1": 2, "clave2": 0, ... } }
════════════════════════════════════════════════ */
exports.getConteos = async (req, res) => {
  const { claves } = req.body;
  if (!Array.isArray(claves) || claves.length === 0) {
    return res.status(400).json({ success: false, message: "claves requeridas" });
  }

  const t0 = Date.now();
  try {
    const result = await query(`
      SELECT
        clave_unica,
        COUNT(*) FILTER (WHERE valor IS NOT NULL OR valor_texto IS NOT NULL) AS capturados
      FROM "${SCHEMA}".informacion_general_obras
      WHERE clave_unica = ANY($1::text[])
      GROUP BY clave_unica
    `, [claves]);

    /* Construir mapa { clave → capturados } */
    const data = {};
    for (const r of result.rows) {
      data[r.clave_unica] = Number(r.capturados);
    }

    console.log(`[InfoGeneral] getConteos ${claves.length} claves: ${Date.now() - t0}ms`);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ════════════════════════════════════════════════
   POST /api/info-general/guardar-ficha
   UPSERT transaccional de todos los indicadores de la ficha
   Body: {
     clave_unica, nombre_obra, programa, area, dg,
     usuario_actualizacion,
     indicadores: [ { indicador, valor, valor_texto, unidad_medida } ]
   }
════════════════════════════════════════════════ */
exports.guardarFicha = async (req, res) => {
  const { clave_unica, nombre_obra, programa, area, dg,
          usuario_actualizacion, indicadores } = req.body;

  if (!clave_unica) return res.status(400).json({ success: false, message: "clave_unica requerida" });
  if (!Array.isArray(indicadores) || indicadores.length === 0) {
    return res.status(400).json({ success: false, message: "indicadores requeridos" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const ind of indicadores) {
      if (!ind.indicador) continue;
      await client.query(`
        INSERT INTO "${SCHEMA}".informacion_general_obras (
          clave_unica, nombre_obra, programa, area, dg,
          indicador, valor, valor_texto, unidad_medida,
          usuario_actualizacion, fecha_captura
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (clave_unica, indicador) DO UPDATE SET
          valor                 = EXCLUDED.valor,
          valor_texto           = EXCLUDED.valor_texto,
          unidad_medida         = EXCLUDED.unidad_medida,
          usuario_edicion       = EXCLUDED.usuario_actualizacion,
          fecha_edicion         = NOW()
      `, [
        clave_unica,
        nombre_obra  || null,
        programa     || null,
        area         || null,
        dg           || null,
        ind.indicador,
        ind.valor        != null ? ind.valor        : null,
        ind.valor_texto  != null ? ind.valor_texto  : null,
        ind.unidad_medida || null,
        usuario_actualizacion || "sistema",
      ]);
    }

    await client.query("COMMIT");

    /* Devolver los valores actualizados */
    const updated = await client.query(`
      SELECT id, indicador, valor, valor_texto, unidad_medida,
             usuario_actualizacion, fecha_captura,
             usuario_edicion,       fecha_edicion
      FROM "${SCHEMA}".informacion_general_obras
      WHERE clave_unica = $1
      ORDER BY indicador ASC
    `, [clave_unica]);

    res.json({ success: true, data: updated.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

/* ════════════════════════════════════════════════
   PUT /api/info-general/limpiar/:id
   Nullifica valor + valor_texto con trazabilidad (solo ADMIN)
════════════════════════════════════════════════ */
exports.limpiarValor = async (req, res) => {
  const { id } = req.params;
  const { usuario_edicion } = req.body;

  try {
    const result = await query(`
      UPDATE "${SCHEMA}".informacion_general_obras
      SET valor         = NULL,
          valor_texto   = NULL,
          usuario_edicion = $1,
          fecha_edicion   = NOW()
      WHERE id = $2
      RETURNING id, indicador, clave_unica
    `, [usuario_edicion || "sistema", id]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Registro no encontrado" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
