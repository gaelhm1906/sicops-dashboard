/**
 * routes/frentes.js
 * Frentes de obra normales — tabla frentes_obra.
 * Montado en /api/frentes — independiente de /api/utopias.
 *
 * GET /api/frentes/debug          → diagnóstico de claves presentes
 * GET /api/frentes/avance         → avance ponderado bulk (?claves=c1,c2,...)
 * GET /api/frentes/:clave         → filas completas de frentes_obra para esa clave_unica
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { authRequired } = require('../middleware/auth');

const SCHEMA = process.env.DB_SCHEMA || 'sig_sobse';

// GET /api/frentes/debug — lista claves presentes en frentes_obra (diagnóstico)
router.get('/debug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT BTRIM(COALESCE(clave_unica::text, '')) AS clave_unica,
              COUNT(*)::int AS registros
         FROM "${SCHEMA}".frentes_obra
        WHERE clave_unica IS NOT NULL
          AND BTRIM(clave_unica::text) <> ''
        GROUP BY BTRIM(COALESCE(clave_unica::text, ''))
        ORDER BY clave_unica
        LIMIT 200`
    );
    return res.json({ ok: true, total: result.rows.length, claves: result.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/frentes/avance?claves=c1,c2,c3
 *
 * Calcula el avance efectivo desde frentes_obra para un lote de obras.
 * Para cada clave_unica devuelve:
 *   { clave_unica, avance_ponderado, n_frentes }
 *
 * Fórmula: promedio simple de avances de frentes con avance capturado.
 * Solo se incluyen en el resultado claves que tienen ≥ 1 frente
 * con avance capturado (null/vacío se omiten).
 * Máximo 100 claves por llamada.
 */
router.get('/avance', async (req, res) => {
  const raw = String(req.query.claves || '').trim();
  if (!raw) {
    return res.json([]);
  }

  const claves = raw.split(',').map(c => c.trim()).filter(Boolean).slice(0, 100);
  if (claves.length === 0) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT
         BTRIM(clave_unica::text)                                                     AS clave_unica,
         COUNT(*)::int                                                                 AS n_frentes,
         ROUND(
           AVG(REPLACE(REPLACE(avance::text, '%', ''), ',', '')::numeric)
         , 2)                                                                          AS avance_ponderado
       FROM "${SCHEMA}".frentes_obra
       WHERE BTRIM(clave_unica::text) = ANY($1::text[])
         AND avance IS NOT NULL
         AND BTRIM(avance::text) <> ''
         AND REPLACE(REPLACE(avance::text, '%', ''), ',', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
       GROUP BY BTRIM(clave_unica::text)`,
      [claves]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('Error avance frentes bulk:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/frentes/batch-avance
 * Actualiza el avance de cada frente en frentes_obra y recalcula avance_real de la obra.
 * Body: { clave_unica: string, updates: [{id: number, avance: number}] }
 */
router.patch('/batch-avance', authRequired, async (req, res) => {
  const { clave_unica, updates } = req.body || {};
  if (!clave_unica || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ ok: false, error: 'clave_unica y updates[] requeridos' });
  }

  const usuario = req.user?.username || req.user?.email || 'sistema';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar avance de cada frente
    for (const upd of updates) {
      const avanceNum = Number(upd.avance);
      if (!Number.isFinite(avanceNum) || avanceNum < 0 || avanceNum > 100) continue;
      await client.query(
        `UPDATE "${SCHEMA}".frentes_obra SET avance = $1 WHERE id = $2`,
        [String(avanceNum), Number(upd.id)]
      );
    }

    // 2. Recalcular promedio simple de avances de frentes
    const avgRes = await client.query(
      `SELECT
         ROUND(AVG(REPLACE(REPLACE(avance::text, '%', ''), ',', '')::numeric), 2) AS avance_ponderado
       FROM "${SCHEMA}".frentes_obra
       WHERE BTRIM(clave_unica::text) = $1
         AND avance IS NOT NULL
         AND BTRIM(avance::text) <> ''
         AND REPLACE(REPLACE(avance::text, '%', ''), ',', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'`,
      [clave_unica.trim()]
    );

    const avance_calculado = avgRes.rows[0]?.avance_ponderado ?? null;

    // 3. Buscar tabla de la obra en catalogo_obras
    const catRes = await client.query(
      `SELECT tabla_actual FROM "${SCHEMA}".catalogo_obras WHERE clave_unica = $1 LIMIT 1`,
      [clave_unica.trim()]
    );
    const tabla_actual = catRes.rows[0]?.tabla_actual;

    let obra_actualizada = false;
    if (tabla_actual && avance_calculado !== null) {
      const upRes = await client.query(
        `UPDATE "${SCHEMA}"."${tabla_actual}"
         SET "AVANCE REAL"           = $1,
             "USUARIO ACTUALIZACION" = $2,
             "FECHA ACTUALIZACION"   = NOW()
         WHERE clave_unica = $3`,
        [avance_calculado, usuario, clave_unica.trim()]
      );
      obra_actualizada = upRes.rowCount > 0;
    }

    await client.query('COMMIT');
    return res.json({ ok: true, avance_calculado, frentes_actualizados: updates.length, obra_actualizada });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error batch-avance frentes:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/frentes/:clave — filas completas de frentes_obra para una obra
router.get('/:clave', async (req, res) => {
  const claveNorm = String(req.params.clave || '').trim();

  if (!claveNorm) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT * FROM "${SCHEMA}".frentes_obra
       WHERE BTRIM(COALESCE(clave_unica::text, '')) = $1
       ORDER BY id`,
      [claveNorm]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error frentes_obra:', err.message);
    return res.status(500).json([]);
  }
});

module.exports = router;
