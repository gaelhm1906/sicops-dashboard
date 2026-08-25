const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const obrasUpdateCtrl = require('../controllers/obrasUpdateCtrl');
const { authRequired, requireRole } = require('../middleware/auth');

const SCHEMA = process.env.DB_SCHEMA || 'sig_sobse';

const OBRAS_TABLES_CENTRAL = ['obras_puntos', 'obras_lineas', 'obras_poligonos'];
const MODOS_VALIDOS = ['GENERAL', 'FRENTES'];

function normalizeTableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/* ────────────────────────────────────────────────────────────
   GET /api/obras
   Sin ?tabla → FeatureCollection GeoJSON (compatible con Centro de Mando).
   Con ?tabla=XXX → registros tabulares de esa tabla (máx 500).
──────────────────────────────────────────────────────────── */
const OBRAS_TABLES    = ['obras_puntos', 'obras_lineas', 'obras_poligonos'];
const OBRAS_GEOM_TYPE = { obras_puntos: 'POINT', obras_lineas: 'LINESTRING', obras_poligonos: 'POLYGON' };

router.get('/', async (req, res) => {
  const { tabla } = req.query;

  if (!tabla) {
    try {
      const features = [];
      for (const t of OBRAS_TABLES) {
        const result = await pool.query(
          `SELECT *,
             CASE WHEN geom IS NULL THEN NULL
                  ELSE ST_AsGeoJSON(ST_Simplify(ST_CurveToLine(geom), 0.00001))::json
             END AS _geometry
           FROM "${SCHEMA}"."${t}"`
        );
        for (const row of result.rows) {
          const { _geometry, geom, ...props } = row;
          features.push({
            type: 'Feature',
            geometry: _geometry ?? null,
            properties: { ...props, geometry_type: OBRAS_GEOM_TYPE[t] },
          });
        }
      }
      return res.json({ type: 'FeatureCollection', features, total: features.length, success: true });
    } catch (err) {
      console.error('Error GeoJSON all obras:', err);
      return res.status(500).json({ success: false, message: 'Error al obtener obras.', detail: err.message });
    }
  }

  console.log('Tabla solicitada:', tabla);

  try {
    /* Validar que la tabla existe en el schema sig_sobse */
    const tablesResult = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [SCHEMA]
    );

    const validTables = tablesResult.rows.map(r => r.tablename);
    console.log(`Tablas disponibles en ${SCHEMA}:`, validTables.length);

    const tablaReal =
      validTables.find((tableName) => tableName === tabla) ||
      validTables.find((tableName) => normalizeTableName(tableName) === normalizeTableName(tabla));

    if (!tablaReal) {
      return res.status(400).json({
        success: false,
        message: `La tabla "${tabla}" no existe en el esquema ${SCHEMA}.`,
        code:    'TABLA_INVALIDA',
        tablas_disponibles: validTables.length
      });
    }

    /* Sanitizar: escapar comillas dobles dentro del nombre */
    const safeTabla = tablaReal.replace(/"/g, '""');

    const result = await pool.query(
      `SELECT * FROM ${SCHEMA}."${safeTabla}" LIMIT 500`
    );

    console.log(`${tablaReal}: ${result.rows.length} registros devueltos`);

    return res.json({
      success: true,
      tabla: tablaReal,
      total: result.rows.length,
      data:  result.rows
    });
  } catch (err) {
    console.error('Error DB:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar la tabla.',
      detail:  err.message
    });
  }
});

/* ────────────────────────────────────────────────────────────
   PUT /api/obras/update
   Actualiza avance de una obra en PostgreSQL.
   Body: { tabla, id, nombre, avance, usuario, motivo }
──────────────────────────────────────────────────────────── */
router.put('/update', authRequired, obrasUpdateCtrl.actualizarObra);
router.put('/inaugurar', authRequired, obrasUpdateCtrl.inaugurarObra);
router.put('/cancelar', authRequired, obrasUpdateCtrl.cancelarObra);
router.put('/fecha-inauguracion', authRequired, obrasUpdateCtrl.agregarFechaInauguracion);

/* ────────────────────────────────────────────────────────────
   Flujo de edición en 3 pasos (genera cambio_id)
──────────────────────────────────────────────────────────── */
router.post('/:id/editar',          authRequired, obrasUpdateCtrl.iniciarEdicionPg);
router.post('/:id/confirmar/step1', authRequired, obrasUpdateCtrl.confirmarStep1Pg);
router.post('/:id/confirmar/step2', authRequired, obrasUpdateCtrl.confirmarStep2Pg);

/* ────────────────────────────────────────────────────────────
   PATCH /api/obras/:clave_unica/modo-avance
   Cambia el modo de cálculo de avance de una obra.
   Body: { modo: 'GENERAL' | 'FRENTES' }
   Solo ADMIN y GEOESTADÍSTICA pueden usar este endpoint.
──────────────────────────────────────────────────────────── */
router.patch(
  '/:clave_unica/modo-avance',
  authRequired,
  requireRole('ADMIN', 'GEOESTADISTICA'),
  async (req, res) => {
    const { clave_unica } = req.params;
    const { modo } = req.body;
    const usuario = req.user?.email || req.user?.username || 'sistema';

    if (!modo || !MODOS_VALIDOS.includes(modo)) {
      return res.status(400).json({
        success: false,
        message: `modo inválido. Valores aceptados: ${MODOS_VALIDOS.join(', ')}.`,
        code: 'MODO_INVALIDO',
      });
    }

    const claveNorm = String(clave_unica || '').trim();
    if (!claveNorm) {
      return res.status(400).json({ success: false, message: 'clave_unica requerida.', code: 'CLAVE_REQUERIDA' });
    }

    try {
      let actualizado = false;
      for (const tabla of OBRAS_TABLES_CENTRAL) {
        const r = await pool.query(
          `UPDATE "${SCHEMA}"."${tabla}"
              SET modo_calculo_avance = $1
            WHERE BTRIM(clave_unica::text) = $2
            RETURNING id`,
          [modo, claveNorm]
        );
        if (r.rowCount > 0) {
          actualizado = true;
          console.info(`[modo-avance] ${claveNorm} → ${modo} en ${tabla} por ${usuario}`);
          break;
        }
      }

      if (!actualizado) {
        return res.status(404).json({
          success: false,
          message: `Obra "${claveNorm}" no encontrada en ninguna tabla centralizada.`,
          code: 'OBRA_NO_ENCONTRADA',
        });
      }

      return res.json({ success: true, clave_unica: claveNorm, modo });
    } catch (err) {
      console.error('[modo-avance] Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
