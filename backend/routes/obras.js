const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const obrasUpdateCtrl = require('../controllers/obrasUpdateCtrl');
const { authRequired } = require('../middleware/auth');

const SCHEMA = process.env.DB_SCHEMA || 'sig_sobse';

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
   GET /api/obras?tabla=XXX
   Devuelve todos los registros de la tabla indicada (máx 500).
   Valida la tabla contra pg_tables antes de ejecutar.
──────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const { tabla } = req.query;

  if (!tabla) {
    return res.status(400).json({
      success: false,
      message: 'Parámetro "tabla" es requerido. Ejemplo: /api/obras?tabla=ALBERGUES'
    });
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

/* ────────────────────────────────────────────────────────────
   Flujo de edición en 3 pasos (genera cambio_id)
──────────────────────────────────────────────────────────── */
router.post('/:id/editar',          authRequired, obrasUpdateCtrl.iniciarEdicionPg);
router.post('/:id/confirmar/step1', authRequired, obrasUpdateCtrl.confirmarStep1Pg);
router.post('/:id/confirmar/step2', authRequired, obrasUpdateCtrl.confirmarStep2Pg);

module.exports = router;
